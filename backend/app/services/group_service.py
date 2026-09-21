from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Group, GroupMember, User
from ..repositories.group_repository import get_member_by_email, list_groups_for_user, list_members as list_group_members
from .balance_service import compute_balances
from .permissions import get_group_and_role, require_permission

SUPPORTED_GROUP_TYPES = {"Trip", "Home", "Friends", "Office", "Other"}
SUPPORTED_ROLES = {"admin", "member", "viewer"}


def create_group(
    session: Session,
    caller: User,
    name: str,
    group_type: str,
    currency: str,
    description: str | None,
) -> Group:
    clean_name = name.strip()
    clean_type = group_type.strip()
    clean_currency = currency.strip().upper()
    clean_description = description.strip() if description else None
    if not clean_name:
        raise HTTPException(status_code=400, detail="Group name is required.")
    if clean_type not in SUPPORTED_GROUP_TYPES:
        raise HTTPException(status_code=400, detail="Invalid group type.")
    if len(clean_currency) != 3 or not clean_currency.isalpha():
        raise HTTPException(status_code=400, detail="Currency must be a valid 3-letter code.")

    group = Group(
        owner_id=caller.id,
        name=clean_name,
        type=clean_type,
        currency=clean_currency,
        description=clean_description or None,
    )
    session.add(group)
    session.flush()

    owner_membership = session.scalar(
        select(GroupMember).where(
            GroupMember.group_id == group.id,
            GroupMember.user_id == caller.id,
        )
    )
    if owner_membership is None:
        session.add(
            GroupMember(
                group_id=group.id,
                user_id=caller.id,
                email=(caller.email or "").strip().lower(),
                role="owner",
                status="active",
            )
        )

    session.commit()
    return group


def list_groups(session: Session, user_id: UUID) -> list[Group]:
    return list_groups_for_user(session, user_id)


def get_settings(session: Session, group_id: UUID, user_id: UUID) -> dict:
    group, role = get_group_and_role(session, group_id, user_id)
    return {
        "id": group.id,
        "owner_id": group.owner_id,
        "name": group.name,
        "type": group.type,
        "currency": group.currency,
        "description": group.description,
        "created_at": group.created_at,
        "is_owner": group.owner_id == user_id,
        "role": role,
    }


def update_settings(
    session: Session,
    group_id: UUID,
    user_id: UUID,
    name: str,
    group_type: str,
    currency: str,
    description: str | None,
) -> Group:
    group, role = get_group_and_role(session, group_id, user_id)
    require_permission(role, "settings", "Only the group owner can edit group settings.")

    clean_name = name.strip()
    clean_type = group_type.strip()
    clean_currency = currency.strip().upper()
    clean_description = description.strip() if description else None
    if not clean_name:
        raise HTTPException(status_code=400, detail="Group name is required.")
    if len(clean_name) > 80:
        raise HTTPException(status_code=400, detail="Group name must be 80 characters or less.")
    if clean_type not in SUPPORTED_GROUP_TYPES:
        raise HTTPException(status_code=400, detail="Invalid group type.")
    if len(clean_currency) != 3 or not clean_currency.isalpha():
        raise HTTPException(status_code=400, detail="Currency must be a valid 3-letter code.")
    if clean_description and len(clean_description) > 500:
        raise HTTPException(status_code=400, detail="Group description must be 500 characters or less.")

    if clean_currency != (group.currency or "INR").upper():
        from ..models import Expense, Settlement
        has_financial = session.scalar(
            select(Expense.id).where(Expense.group_id == group_id).limit(1)
        ) is not None
        has_financial = has_financial or session.scalar(
            select(Settlement.id).where(Settlement.group_id == group_id).limit(1)
        ) is not None
        if has_financial:
            raise HTTPException(
                status_code=409,
                detail="Base currency cannot be changed after expenses or settlements have been recorded.",
            )

    group.name = clean_name
    group.type = clean_type
    group.currency = clean_currency
    group.description = clean_description or None
    session.commit()
    return group


def list_members(session: Session, group_id: UUID, user_id: UUID) -> list[dict]:
    get_group_and_role(session, group_id, user_id)
    rows = session.execute(
        select(GroupMember, User)
        .outerjoin(User, User.id == GroupMember.user_id)
        .where(GroupMember.group_id == group_id)
        .order_by(GroupMember.created_at.asc())
    ).all()
    response = [
        {
            "id": member.id,
            "group_id": member.group_id,
            "user_id": member.user_id,
            "email": member.email,
            "full_name": user.full_name if user else None,
            "role": member.role,
            "status": member.status,
            "created_at": member.created_at,
        }
        for member, user in rows
    ]
    response.sort(
        key=lambda item: (
            0 if item["role"] == "owner" else 1 if item["role"] == "admin" else 2 if item["role"] == "member" else 3,
            item["created_at"],
        )
    )
    return response


def update_role(session: Session, group_id: UUID, target_user_id: UUID, role: str, user_id: UUID) -> dict:
    group, caller_role = get_group_and_role(session, group_id, user_id)
    require_permission(caller_role, "roles", "Only the group owner can change member roles.")
    normalized = role.strip().lower()
    if normalized not in SUPPORTED_ROLES:
        raise HTTPException(status_code=400, detail="Role must be admin, member, or viewer.")
    if target_user_id == group.owner_id:
        raise HTTPException(status_code=400, detail="The group owner must keep the owner role.")
    member = session.scalar(select(GroupMember).where(
        GroupMember.group_id == group_id,
        GroupMember.user_id == target_user_id,
        GroupMember.status == "active",
    ))
    if member is None:
        raise HTTPException(status_code=404, detail="The target user is not an active group member.")
    member.role = normalized
    session.commit()
    user = session.get(User, member.user_id)
    return {
        "id": member.id,
        "group_id": member.group_id,
        "user_id": member.user_id,
        "email": member.email,
        "full_name": user.full_name if user else None,
        "role": member.role,
        "status": member.status,
        "created_at": member.created_at,
    }


def remove_member(session: Session, group_id: UUID, member_id: UUID, user_id: UUID) -> None:
    group, caller_role = get_group_and_role(session, group_id, user_id)
    require_permission(caller_role, "members", "You do not have permission to remove members.")
    member = session.scalar(select(GroupMember).where(GroupMember.id == member_id, GroupMember.group_id == group_id))
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found.")
    if member.user_id == group.owner_id:
        raise HTTPException(status_code=400, detail="The group owner cannot be removed.")
    if caller_role == "admin" and member.role not in {"member", "viewer"}:
        raise HTTPException(status_code=403, detail="Admins cannot remove owners or other admins.")
    if member.user_id:
        balances = compute_balances(session, group_id)
        target = next((b for b in balances if b["user_id"] == member.user_id), None)
        if target and abs(target["net_balance"]) > 0.005:
            raise HTTPException(status_code=409, detail="This member has an outstanding balance and cannot be removed yet.")
    session.delete(member)
    session.commit()


def leave_group(session: Session, group_id: UUID, user_id: UUID) -> None:
    group, _ = get_group_and_role(session, group_id, user_id)
    if group.owner_id == user_id:
        raise HTTPException(status_code=400, detail="The group owner cannot leave the group. Delete the group or transfer ownership first.")
    balances = compute_balances(session, group_id, user_id)
    current = next((b for b in balances if b["user_id"] == user_id), None)
    if current and abs(current["net_balance"]) > 0.005:
        raise HTTPException(status_code=409, detail="Settle your balance before leaving the group.")
    member = session.scalar(select(GroupMember).where(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id,
        GroupMember.status == "active",
    ))
    if member is None:
        raise HTTPException(status_code=404, detail="Membership not found.")
    session.delete(member)
    session.commit()


def delete_group(session: Session, group_id: UUID, user_id: UUID) -> None:
    group, role = get_group_and_role(session, group_id, user_id)
    require_permission(role, "delete_group", "Only the group owner can delete the group.")
    session.delete(group)
    session.commit()
