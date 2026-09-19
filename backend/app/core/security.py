from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import httpx
from fastapi import Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import User
from .config import get_settings


@dataclass(frozen=True)
class CurrentUser:
    id: UUID
    email: str | None
    full_name: str | None


def get_current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    """Validate a Supabase access token without exposing database access to mobile."""

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    settings = get_settings()
    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/user"
    headers = {
        "apikey": settings.supabase_publishable_key,
        "Authorization": f"Bearer {token}",
    }

    try:
        response = httpx.get(url, headers=headers, timeout=settings.auth_timeout_seconds)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is unavailable.",
        ) from exc

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session.",
        )

    try:
        payload = response.json()
        user_id = UUID(str(payload["id"]))
    except (ValueError, TypeError, KeyError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication response.",
        ) from exc

    metadata = payload.get("user_metadata") or {}
    raw_name = metadata.get("full_name")
    full_name = raw_name.strip() if isinstance(raw_name, str) and raw_name.strip() else None
    email = payload.get("email")
    return CurrentUser(id=user_id, email=email, full_name=full_name)


def ensure_user(session: Session, current_user: CurrentUser) -> User:
    user = session.get(User, current_user.id)
    normalized_email = (current_user.email or "").strip().lower() or None

    if user is None:
        user = User(id=current_user.id, email=normalized_email, full_name=current_user.full_name)
        session.add(user)
    else:
        if normalized_email:
            user.email = normalized_email
        if current_user.full_name:
            user.full_name = current_user.full_name

    session.commit()
    session.refresh(user)
    return user
