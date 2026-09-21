from __future__ import annotations

import threading
import time
from typing import Any

import httpx
from fastapi import HTTPException

from ..core.config import get_settings

_MIN_INTERVAL_SECONDS = 1.05
_CACHE_TTL_SECONDS = 86_400
_CACHE_MAX = 256
_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}
_cache_lock = threading.Lock()
_request_lock = threading.Lock()
_last_request_at = 0.0


def _clean(value: Any) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None


def _make_result(item: dict[str, Any]) -> dict[str, Any] | None:
    try:
        lat = float(item["lat"])
        lon = float(item["lon"])
    except (KeyError, TypeError, ValueError):
        return None

    address_data = item.get("address") or {}
    name = (
        _clean(item.get("name"))
        or _clean(address_data.get("tourism"))
        or _clean(address_data.get("city"))
        or _clean(address_data.get("town"))
        or _clean(address_data.get("village"))
        or "Selected place"
    )
    display_name = _clean(item.get("display_name")) or name
    osm_type = _clean(item.get("osm_type")) or ""
    osm_id = _clean(item.get("osm_id")) or _clean(item.get("place_id")) or display_name

    return {
        "place_id": f"{osm_type}{osm_id}",
        "name": name,
        "display_name": display_name,
        "address": display_name,
        "latitude": lat,
        "longitude": lon,
        "category": _clean(item.get("category")),
        "type": _clean(item.get("type")),
    }


def search_places(query: str, limit: int = 6) -> list[dict[str, Any]]:
    normalized = " ".join(query.strip().split())
    if len(normalized) < 2:
        raise HTTPException(status_code=422, detail="Enter at least 2 characters to search for a place.")

    key = normalized.casefold()
    now = time.monotonic()
    with _cache_lock:
        cached = _cache.get(key)
        if cached and now - cached[0] < _CACHE_TTL_SECONDS:
            return cached[1]
        if cached:
            _cache.pop(key, None)

    settings = get_settings()
    global _last_request_at
    with _request_lock:
        wait_for = _MIN_INTERVAL_SECONDS - (time.monotonic() - _last_request_at)
        if wait_for > 0:
            time.sleep(wait_for)
        try:
            with httpx.Client(
                timeout=8.0,
                headers={
                    "User-Agent": f"FairShare/{settings.app_version} place-search",
                    "Accept": "application/json",
                },
                follow_redirects=True,
            ) as client:
                response = client.get(
                    f"{settings.geocoding_base_url.rstrip('/')}/search",
                    params={
                        "q": normalized,
                        "format": "jsonv2",
                        "limit": min(max(limit, 1), 10),
                        "addressdetails": 1,
                        "accept-language": "en",
                    },
                )
                response.raise_for_status()
                raw = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise HTTPException(status_code=502, detail="Place search is temporarily unavailable.") from exc
        finally:
            _last_request_at = time.monotonic()

    results = [result for item in raw if (result := _make_result(item)) is not None]
    with _cache_lock:
        if len(_cache) >= _CACHE_MAX:
            oldest = min(_cache, key=lambda cache_key: _cache[cache_key][0])
            _cache.pop(oldest, None)
        _cache[key] = (time.monotonic(), results)
    return results
