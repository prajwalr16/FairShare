from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import jwt
from cryptography.hazmat.primitives.asymmetric import ec

from app.core import security


def _token(private_key, *, audience: str = "authenticated") -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "iss": "https://example.supabase.co/auth/v1",
            "aud": audience,
            "exp": int((now + timedelta(minutes=10)).timestamp()),
            "iat": int(now.timestamp()),
            "sub": str(uuid4()),
            "role": "authenticated",
            "email": "user@example.com",
            "user_metadata": {"full_name": "Test User"},
        },
        private_key,
        algorithm="ES256",
        headers={"kid": "test-key"},
    )


def test_supabase_jwt_is_verified_locally(monkeypatch):
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()

    class FakeSigningKey:
        key = public_key

    class FakeJWKClient:
        def get_signing_key_from_jwt(self, token):
            return FakeSigningKey()

    monkeypatch.setattr(security, "_get_jwks_client", lambda: FakeJWKClient())
    monkeypatch.setattr(
        security,
        "get_settings",
        lambda: SimpleNamespace(supabase_url="https://example.supabase.co"),
    )

    current_user = security.get_current_user("Bearer " + _token(private_key))

    assert current_user.email == "user@example.com"
    assert current_user.full_name == "Test User"


def test_supabase_jwt_rejects_wrong_audience(monkeypatch):
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()

    class FakeSigningKey:
        key = public_key

    class FakeJWKClient:
        def get_signing_key_from_jwt(self, token):
            return FakeSigningKey()

    monkeypatch.setattr(security, "_get_jwks_client", lambda: FakeJWKClient())
    monkeypatch.setattr(
        security,
        "get_settings",
        lambda: SimpleNamespace(supabase_url="https://example.supabase.co"),
    )

    try:
        security.get_current_user("Bearer " + _token(private_key, audience="anon"))
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 401
    else:
        raise AssertionError("JWT with the wrong audience was accepted")
