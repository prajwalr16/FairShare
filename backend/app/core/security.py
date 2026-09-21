from __future__ import annotations

import atexit
from dataclasses import dataclass
from uuid import UUID

import jwt
from fastapi import Header, HTTPException, status
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientError, PyJWTError
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..models import User
from .config import get_settings


@dataclass(frozen=True)
class CurrentUser:
    id: UUID
    email: str | None
    full_name: str | None


# Supabase asymmetric JWT verification: the public keys are safe to cache.
# PyJWKClient refreshes JWKS when it encounters a new kid, supporting key rotation
# without putting the Supabase Auth /user endpoint back into the request path.
_jwks_client: PyJWKClient | None = None
_jwks_url: str | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client, _jwks_url

    settings = get_settings()
    issuer = settings.supabase_url.rstrip("/") + "/auth/v1"
    jwks_url = issuer + "/.well-known/jwks.json"

    if _jwks_client is None or _jwks_url != jwks_url:
        _jwks_client = PyJWKClient(
            jwks_url,
            cache_jwk_set=True,
            lifespan=600,
            cache_keys=True,
            timeout=5.0,
        )
        _jwks_url = jwks_url

    return _jwks_client


@atexit.register
def _close_jwks_client() -> None:
    global _jwks_client
    if _jwks_client is not None:
        shutdown = getattr(_jwks_client, "shutdown", None)
        if callable(shutdown):
            shutdown()
        _jwks_client = None


def warm_jwks_cache() -> None:
    """Best-effort warm-up so the first authenticated request has no JWKS wait."""
    try:
        _get_jwks_client().fetch_data()
    except Exception:
        # Requests will retry through PyJWKClient if the first warm-up failed.
        pass


def get_current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    """Verify a Supabase user JWT locally with the project's public JWKS."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    settings = get_settings()
    issuer = settings.supabase_url.rstrip("/") + "/auth/v1"

    try:
        header = jwt.get_unverified_header(token)
        algorithm = header.get("alg")
        if algorithm not in {"ES256", "RS256"}:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unsupported authentication token.",
            )

        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=[algorithm],
            issuer=issuer,
            audience="authenticated",
            options={"require": ["exp", "iat", "sub", "iss", "aud"]},
        )
    except HTTPException:
        raise
    except PyJWKClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Authentication keys are unavailable. Enable an asymmetric "
                "Supabase JWT signing key (ES256 or RS256) for FairShare."
            ),
        ) from exc
    except PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session.",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication verification service is temporarily unavailable.",
        ) from exc

    if payload.get("role") != "authenticated":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication role.",
        )

    try:
        user_id = UUID(str(payload["sub"]))
    except (ValueError, TypeError, KeyError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication subject.",
        ) from exc

    metadata = payload.get("user_metadata") or {}
    raw_name = metadata.get("full_name")
    full_name = (
        raw_name.strip()
        if isinstance(raw_name, str) and raw_name.strip()
        else None
    )
    email = payload.get("email")
    normalized_email = (
        email.strip().lower()
        if isinstance(email, str) and email.strip()
        else None
    )

    return CurrentUser(id=user_id, email=normalized_email, full_name=full_name)


def ensure_user(session: Session, current_user: CurrentUser) -> User:
    user = session.get(User, current_user.id)
    normalized_email = (current_user.email or "").strip().lower() or None

    if user is None:
        user = User(
            id=current_user.id,
            email=normalized_email,
            full_name=current_user.full_name,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user

    changed = False
    if normalized_email and user.email != normalized_email:
        user.email = normalized_email
        changed = True
    if current_user.full_name and user.full_name != current_user.full_name:
        user.full_name = current_user.full_name
        changed = True

    if changed:
        session.commit()
        session.refresh(user)

    return user


def set_database_user_context(session: Session, user_id: UUID) -> None:
    session.execute(
        text("select set_config('request.jwt.claim.sub', :user_id, true)"),
        {"user_id": str(user_id)},
    )
