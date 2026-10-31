from __future__ import annotations

import hashlib
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def get_request_identifier(request: Request) -> str:
    """
    Returns an identifier for rate limiting:
    - If user has an Authorization bearer token, use a short SHA-256 hash of it.
    - Otherwise fallback to client IP via get_remote_address.
    """
    auth = request.headers.get("authorization")
    if auth:
        return hashlib.sha256(auth.encode("utf-8")).hexdigest()[:16]
    return get_remote_address(request)


limiter = Limiter(
    key_func=get_request_identifier,
    headers_enabled=False,
)
