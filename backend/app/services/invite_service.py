from __future__ import annotations

import re
from urllib.parse import urlparse
from uuid import UUID

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Group, GroupMember, User
from ..repositories.group_repository import get_member_by_email
from .permissions import get_group_and_role, require_permission

INVITE_PATH = "/accept-invite"


def normalize_email(email: str) -> str:
    return email.strip().lower()


def build_invite_redirect_url() -> str:
    from ..core.config import get_settings

    settings = get_settings()
    configured = (settings.fairshare_web_url or "").strip().rstrip("/")

    if not configured:
        raise HTTPException(
            status_code=503,
            detail="FairShare web URL is not configured. Set FAIRSHARE_WEB_URL in the backend environment.",
        )

    parsed = urlparse(configured)

    if parsed.scheme != "https" or not parsed.netloc:
        raise HTTPException(
            status_code=500,
            detail="FAIRSHARE_WEB_URL must be a valid HTTPS URL.",
        )

    return f"{configured}{INVITE_PATH}"


def _auth_headers() -> dict[str, str]:
    from ..core.config import get_settings
    key = get_settings().supabase_admin_key
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def _find_auth_user_by_email(email: str) -> dict | None:
    from ..core.config import get_settings
    settings = get_settings()
    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users"
    page = 1
    while True:
        try:
            response = httpx.get(
                url,
                headers=_auth_headers(),
                params={"page": page, "per_page": 1000},
                timeout=15.0,
            )
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=503,
                detail="Authentication service is unavailable.",
            ) from exc

        if response.status_code >= 400:
            raise HTTPException(
                status_code=502,
                detail="Unable to check the invitation recipient account.",
            )

        payload = response.json()
        users = payload.get("users") or []

        for user in users:
            if normalize_email(user.get("email") or "") == email:
                return user

        if len(users) < 1000:
            return None

        page += 1


def _send_invitation(email: str, group_id: UUID) -> dict:
    from ..core.config import get_settings

    settings = get_settings()
    base = f"{settings.supabase_url.rstrip('/')}/auth/v1/invite"
    redirect_to = build_invite_redirect_url()

    try:
        response = httpx.post(
            base,
            headers=_auth_headers(),
            params={"redirect_to": redirect_to},
            json={
                "email": email,
                "data": {"invited_group_id": str(group_id)},
            },
            timeout=15.0,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=503,
            detail="Unable to send the invitation email.",
        ) from exc

    if response.status_code >= 400:
        try:
            payload = response.json()
            message = (
                payload.get("msg")
                or payload.get("message")
                or "Unable to send the invitation email."
            )
        except ValueError:
            message = "Unable to send the invitation email."

        raise HTTPException(status_code=400, detail=message)

    return response.json()


def _delete_auth_user(user_id: UUID) -> None:
    from ..core.config import get_settings
    settings = get_settings()
    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users/{user_id}"
    try:
        httpx.delete(url, headers=_auth_headers(), timeout=15.0)
    except httpx.HTTPError:
        pass


def get_pending_invitation(session: Session, group_id: UUID, caller: User) -> dict:
    group = session.get(Group, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found.")

    member = session.scalar(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == caller.id,
            GroupMember.status == "pending",
        )
    )

    if member is None:
        raise HTTPException(
            status_code=403,
            detail="There is no pending invitation for this account.",
        )

    return {
        "group_id": group.id,
        "group_name": group.name,
        "email": member.email,
        "member_id": member.id,
        "status": member.status,
    }


def invite_member(
    session: Session,
    group_id: UUID,
    email: str,
    redirect_to: str | None,
    caller: User,
) -> dict:
    del redirect_to  # Invitation destination is controlled by the backend.

    group, role = get_group_and_role(session, group_id, caller.id)
    require_permission(
        role,
        "members",
        "Only the owner or an admin can add group members.",
    )

    normalized = normalize_email(email)

    if normalized == normalize_email(caller.email or ""):
        raise HTTPException(
            status_code=400,
            detail="You are already the group owner.",
        )

    existing_member = get_member_by_email(session, group_id, normalized)
    if existing_member:
        return {
            "ok": True,
            "status": existing_member.status,
            "member": existing_member,
            "message": (
                "An invitation is already pending for this email."
                if existing_member.status == "pending"
                else "This person is already a member of the group."
            ),
        }

    auth_user = _find_auth_user_by_email(normalized)

    if auth_user and auth_user.get("id"):
        user_id = UUID(str(auth_user["id"]))

        if not auth_user.get("email_confirmed_at"):
            raise HTTPException(
                status_code=400,
                detail=(
                    "This email already has a FairShare account that has not "
                    "been verified. Ask them to verify their email first, "
                    "then add them again."
                ),
            )

        app_user = session.get(User, user_id)
        if app_user is None:
            session.add(User(id=user_id, email=normalized))
            session.flush()

        member = GroupMember(
            group_id=group_id,
            user_id=user_id,
            email=normalized,
            role="member",
            status="active",
        )
        session.add(member)

        try:
            session.commit()
            session.refresh(member)
        except Exception as exc:
            session.rollback()
            raise HTTPException(
                status_code=409,
                detail="This user is already a member of the group.",
            ) from exc

        return {
            "ok": True,
            "status": "active",
            "member": member,
            "message": "Member added.",
        }

    invitation = _send_invitation(normalized, group_id)
    invited_user = invitation.get("user") or {}

    if not invited_user.get("id"):
        raise HTTPException(
            status_code=400,
            detail="The invitation account could not be created.",
        )

    user_id = UUID(str(invited_user["id"]))
    app_user = session.get(User, user_id)

    if app_user is None:
        session.add(User(id=user_id, email=normalized))
    else:
        app_user.email = normalized

    member = GroupMember(
        group_id=group_id,
        user_id=user_id,
        email=normalized,
        role="member",
        status="pending",
    )
    session.add(member)

    try:
        session.commit()
        session.refresh(member)
    except Exception as exc:
        session.rollback()
        _delete_auth_user(user_id)
        raise HTTPException(
            status_code=500,
            detail="Invitation was sent, but the group membership could not be saved.",
        ) from exc

    return {
        "ok": True,
        "status": "pending",
        "member": member,
        "message": "Invitation sent.",
    }


def accept_invitation(
    session: Session,
    group_id: UUID,
    full_name: str | None,
    caller: User,
) -> dict:
    member = session.scalar(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == caller.id,
            GroupMember.status == "pending",
        )
    )

    if member is None:
        raise HTTPException(
            status_code=404,
            detail="No pending invitation was found.",
        )

    group = session.get(Group, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found.")

    member.status = "active"
    member.email = normalize_email(caller.email or member.email)

    cleaned_name = (full_name or "").strip()
    if cleaned_name:
        caller.full_name = cleaned_name

    session.commit()

    return {
        "group_id": group.id,
        "group_name": group.name,
        "status": member.status,
    }
