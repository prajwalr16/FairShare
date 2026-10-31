from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.rate_limit import limiter


def test_security_headers_present():
    client = TestClient(app)
    response = client.get("/")
    assert response.status_code == 200
    headers = response.headers
    assert headers.get("X-Content-Type-Options") == "nosniff"
    assert headers.get("X-Frame-Options") == "DENY"
    assert headers.get("X-XSS-Protection") == "1; mode=block"
    assert "Strict-Transport-Security" in headers
    assert headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "X-Response-Time-Ms" in headers


def test_rate_limiter_exceeded_response():
    # Define a test endpoint on app to test rate limit enforcement reliably
    @app.get("/api/v1/test-rate-limit")
    @limiter.limit("2/minute")
    def limited_route(request: pytest.importorskip("fastapi").Request):
        return {"ok": True}

    client = TestClient(app)
    # Call 1 & 2 succeed
    res1 = client.get("/api/v1/test-rate-limit")
    assert res1.status_code == 200
    res2 = client.get("/api/v1/test-rate-limit")
    assert res2.status_code == 200

    # Call 3 exceeds limit -> 429
    res3 = client.get("/api/v1/test-rate-limit")
    assert res3.status_code == 429
    data = res3.json()
    assert "detail" in data
    assert "Rate limit exceeded" in data["detail"]
    assert "Retry-After" in res3.headers

