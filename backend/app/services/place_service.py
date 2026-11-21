from __future__ import annotations

import asyncio
import difflib
import time
from typing import Any

import httpx
from fastapi import HTTPException

from ..core.config import get_settings

_MIN_INTERVAL_SECONDS = 1.05
_CACHE_TTL_SECONDS = 86_400
_CACHE_MAX = 512
_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_last_request_at = 0.0
_async_lock: asyncio.Lock | None = None
_client: httpx.AsyncClient | None = None

# Comprehensive destination dictionary for offline fallback, hybrid ranking, and fuzzy typo correction
CURATED_DESTINATIONS: list[dict[str, Any]] = [
    {
        "name": "Bengaluru",
        "aliases": ["bangalore", "bengaluru", "benglore", "banglore", "blore"],
        "display_name": "Bengaluru, Bangalore Urban, Karnataka, India",
        "subtitle": "Karnataka, India",
        "latitude": 12.9716,
        "longitude": 77.5946,
        "category": "place",
        "type": "city",
        "icon_type": "city",
        "city": "Bengaluru",
        "state": "Karnataka",
        "country": "India",
    },
    {
        "name": "Manali",
        "aliases": ["manali", "maanali", "manli", "kullu manali", "old manali"],
        "display_name": "Manali, Kullu, Himachal Pradesh, India",
        "subtitle": "Himachal Pradesh, India",
        "latitude": 32.2396,
        "longitude": 77.1887,
        "category": "place",
        "type": "town",
        "icon_type": "attraction",
        "city": "Manali",
        "state": "Himachal Pradesh",
        "country": "India",
    },
    {
        "name": "Pangong Tso",
        "aliases": ["pangong", "pangong tso", "pangong lake", "pagong lake", "pangog", "pangong tsso"],
        "display_name": "Pangong Tso, Leh Ladakh, Ladakh, India",
        "subtitle": "Leh Ladakh, India",
        "latitude": 33.7595,
        "longitude": 78.6674,
        "category": "natural",
        "type": "lake",
        "icon_type": "attraction",
        "city": "Leh",
        "state": "Ladakh",
        "country": "India",
    },
    {
        "name": "Leh Ladakh",
        "aliases": ["leh", "ladakh", "leh ladakh", "ladak", "leh city"],
        "display_name": "Leh, Ladakh, India",
        "subtitle": "Ladakh, India",
        "latitude": 34.1526,
        "longitude": 77.5771,
        "category": "place",
        "type": "city",
        "icon_type": "city",
        "city": "Leh",
        "state": "Ladakh",
        "country": "India",
    },
    {
        "name": "Rameshwaram",
        "aliases": ["rameshwaram", "rameswaram", "rameshwram", "dhanushkodi", "rameshwaram temple"],
        "display_name": "Rameshwaram, Ramanathapuram, Tamil Nadu, India",
        "subtitle": "Ramanathapuram, Tamil Nadu, India",
        "latitude": 9.2876,
        "longitude": 79.3129,
        "category": "place",
        "type": "city",
        "icon_type": "city",
        "city": "Rameshwaram",
        "state": "Tamil Nadu",
        "country": "India",
    },
    {
        "name": "Goa",
        "aliases": ["goa", "baga beach", "calangute", "panaji", "panjim", "anjuna", "north goa", "south goa"],
        "display_name": "Goa, India",
        "subtitle": "Coastal State, India",
        "latitude": 15.2993,
        "longitude": 74.1240,
        "category": "place",
        "type": "state",
        "icon_type": "attraction",
        "city": "Panaji",
        "state": "Goa",
        "country": "India",
    },
    {
        "name": "Ooty",
        "aliases": ["ooty", "udhagamandalam", "ooti", "otty", "nilgiris"],
        "display_name": "Udhagamandalam (Ooty), Nilgiris, Tamil Nadu, India",
        "subtitle": "Nilgiris, Tamil Nadu, India",
        "latitude": 11.4102,
        "longitude": 76.6950,
        "category": "place",
        "type": "town",
        "icon_type": "attraction",
        "city": "Ooty",
        "state": "Tamil Nadu",
        "country": "India",
    },
    {
        "name": "Kodaikanal",
        "aliases": ["kodaikanal", "kodai", "kodaikanl", "kodaikannal"],
        "display_name": "Kodaikanal, Dindigul, Tamil Nadu, India",
        "subtitle": "Dindigul, Tamil Nadu, India",
        "latitude": 10.2381,
        "longitude": 77.4892,
        "category": "place",
        "type": "town",
        "icon_type": "attraction",
        "city": "Kodaikanal",
        "state": "Tamil Nadu",
        "country": "India",
    },
    {
        "name": "Rishikesh",
        "aliases": ["rishikesh", "hrishikesh", "rishkesh", "rhishikesh"],
        "display_name": "Rishikesh, Dehradun, Uttarakhand, India",
        "subtitle": "Uttarakhand, India",
        "latitude": 30.0869,
        "longitude": 78.2676,
        "category": "place",
        "type": "city",
        "icon_type": "attraction",
        "city": "Rishikesh",
        "state": "Uttarakhand",
        "country": "India",
    },
    {
        "name": "Coorg",
        "aliases": ["coorg", "kodagu", "madikeri"],
        "display_name": "Madikeri (Coorg), Kodagu, Karnataka, India",
        "subtitle": "Kodagu, Karnataka, India",
        "latitude": 12.4244,
        "longitude": 75.7382,
        "category": "place",
        "type": "town",
        "icon_type": "attraction",
        "city": "Madikeri",
        "state": "Karnataka",
        "country": "India",
    },
    {
        "name": "Munnar",
        "aliases": ["munnar", "munar", "idukki munnar"],
        "display_name": "Munnar, Idukki, Kerala, India",
        "subtitle": "Idukki, Kerala, India",
        "latitude": 10.0889,
        "longitude": 77.0595,
        "category": "place",
        "type": "town",
        "icon_type": "attraction",
        "city": "Munnar",
        "state": "Kerala",
        "country": "India",
    },
    {
        "name": "Alleppey",
        "aliases": ["alleppey", "alappuzha", "alappy", "aleppey"],
        "display_name": "Alappuzha (Alleppey), Kerala, India",
        "subtitle": "Kerala, India",
        "latitude": 9.4981,
        "longitude": 76.3388,
        "category": "place",
        "type": "city",
        "icon_type": "attraction",
        "city": "Alappuzha",
        "state": "Kerala",
        "country": "India",
    },
    {
        "name": "Jaipur",
        "aliases": ["jaipur", "pink city", "jaypur", "hawa mahal", "amber fort"],
        "display_name": "Jaipur, Rajasthan, India",
        "subtitle": "Rajasthan, India",
        "latitude": 26.9124,
        "longitude": 75.7873,
        "category": "place",
        "type": "city",
        "icon_type": "city",
        "city": "Jaipur",
        "state": "Rajasthan",
        "country": "India",
    },
    {
        "name": "Udaipur",
        "aliases": ["udaipur", "udaypur", "city of lakes"],
        "display_name": "Udaipur, Rajasthan, India",
        "subtitle": "Rajasthan, India",
        "latitude": 24.5854,
        "longitude": 73.7125,
        "category": "place",
        "type": "city",
        "icon_type": "city",
        "city": "Udaipur",
        "state": "Rajasthan",
        "country": "India",
    },
    {
        "name": "Taj Mahal, Agra",
        "aliases": ["taj mahal", "taj mhal", "tajmahal", "agra taj", "agra"],
        "display_name": "Taj Mahal, Dharmapuri, Forest Colony, Tajganj, Agra, Uttar Pradesh, India",
        "subtitle": "Agra, Uttar Pradesh, India",
        "latitude": 27.1751,
        "longitude": 78.0421,
        "category": "tourism",
        "type": "monument",
        "icon_type": "attraction",
        "city": "Agra",
        "state": "Uttar Pradesh",
        "country": "India",
    },
    {
        "name": "Varanasi",
        "aliases": ["varanasi", "banaras", "kashi", "varnasi", "benares"],
        "display_name": "Varanasi, Uttar Pradesh, India",
        "subtitle": "Uttar Pradesh, India",
        "latitude": 25.3176,
        "longitude": 82.9739,
        "category": "place",
        "type": "city",
        "icon_type": "city",
        "city": "Varanasi",
        "state": "Uttar Pradesh",
        "country": "India",
    },
    {
        "name": "Pondicherry",
        "aliases": ["pondicherry", "puducherry", "pondy", "pondi"],
        "display_name": "Puducherry, India",
        "subtitle": "Union Territory, India",
        "latitude": 11.9416,
        "longitude": 79.8083,
        "category": "place",
        "type": "city",
        "icon_type": "city",
        "city": "Puducherry",
        "state": "Puducherry",
        "country": "India",
    },
    {
        "name": "Andaman Islands",
        "aliases": ["andaman", "port blair", "havelock", "andaman and nicobar"],
        "display_name": "Port Blair, Andaman and Nicobar Islands, India",
        "subtitle": "Andaman and Nicobar Islands, India",
        "latitude": 11.6234,
        "longitude": 92.7265,
        "category": "place",
        "type": "island",
        "icon_type": "attraction",
        "city": "Port Blair",
        "state": "Andaman and Nicobar",
        "country": "India",
    },
    {
        "name": "Spiti Valley",
        "aliases": ["spiti", "spiti valley", "kaza", "tabo"],
        "display_name": "Spiti Valley, Lahaul and Spiti, Himachal Pradesh, India",
        "subtitle": "Himachal Pradesh, India",
        "latitude": 32.2461,
        "longitude": 78.0349,
        "category": "natural",
        "type": "valley",
        "icon_type": "attraction",
        "city": "Kaza",
        "state": "Himachal Pradesh",
        "country": "India",
    },
    {
        "name": "Hampi",
        "aliases": ["hampi", "humpi", "vijayanagara"],
        "display_name": "Hampi, Vijayanagara, Karnataka, India",
        "subtitle": "Karnataka, India",
        "latitude": 15.3350,
        "longitude": 76.4600,
        "category": "tourism",
        "type": "historic",
        "icon_type": "attraction",
        "city": "Hampi",
        "state": "Karnataka",
        "country": "India",
    },
    {
        "name": "Mumbai",
        "aliases": ["mumbai", "bombay", "marine drive"],
        "display_name": "Mumbai, Maharashtra, India",
        "subtitle": "Maharashtra, India",
        "latitude": 19.0760,
        "longitude": 72.8777,
        "category": "place",
        "type": "city",
        "icon_type": "city",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
    },
    {
        "name": "New Delhi",
        "aliases": ["delhi", "new delhi", "delhi ncr"],
        "display_name": "New Delhi, Delhi, India",
        "subtitle": "Delhi, India",
        "latitude": 28.6139,
        "longitude": 77.2090,
        "category": "place",
        "type": "city",
        "icon_type": "city",
        "city": "New Delhi",
        "state": "Delhi",
        "country": "India",
    },
    {
        "name": "Dubai",
        "aliases": ["dubai", "burj khalifa", "dxb"],
        "display_name": "Dubai, United Arab Emirates",
        "subtitle": "United Arab Emirates",
        "latitude": 25.2048,
        "longitude": 55.2708,
        "category": "place",
        "type": "city",
        "icon_type": "city",
        "city": "Dubai",
        "state": "Dubai",
        "country": "United Arab Emirates",
    },
    {
        "name": "Singapore",
        "aliases": ["singapore", "changi", "marina bay"],
        "display_name": "Singapore",
        "subtitle": "Singapore",
        "latitude": 1.3521,
        "longitude": 103.8198,
        "category": "place",
        "type": "city",
        "icon_type": "city",
        "city": "Singapore",
        "state": "Singapore",
        "country": "Singapore",
    },
    {
        "name": "Paris",
        "aliases": ["paris", "eiffel tower"],
        "display_name": "Paris, Île-de-France, France",
        "subtitle": "France",
        "latitude": 48.8566,
        "longitude": 2.3522,
        "category": "place",
        "type": "city",
        "icon_type": "city",
        "city": "Paris",
        "state": "Île-de-France",
        "country": "France",
    },
    {
        "name": "Bali",
        "aliases": ["bali", "denpasar", "ubud", "kuta"],
        "display_name": "Bali, Indonesia",
        "subtitle": "Indonesia",
        "latitude": -8.4095,
        "longitude": 115.1889,
        "category": "place",
        "type": "island",
        "icon_type": "attraction",
        "city": "Denpasar",
        "state": "Bali",
        "country": "Indonesia",
    },
]

# Build lookup table of all aliases to canonical destination
_ALIAS_TO_DESTINATION: dict[str, dict[str, Any]] = {}
for _dest in CURATED_DESTINATIONS:
    for _alias in _dest.get("aliases", []):
        _ALIAS_TO_DESTINATION[_alias.strip().casefold()] = _dest


def _get_async_lock() -> asyncio.Lock:
    global _async_lock
    if _async_lock is None:
        _async_lock = asyncio.Lock()
    return _async_lock


def _get_async_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        settings = get_settings()
        _client = httpx.AsyncClient(
            timeout=8.0,
            headers={
                "User-Agent": f"FairShare/{settings.app_version} place-search",
                "Accept": "application/json",
            },
            follow_redirects=True,
        )
    return _client


def _clean(value: Any) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None


def _classify_icon_type(category: str | None, place_type: str | None) -> str:
    cat = (category or "").lower()
    pt = (place_type or "").lower()

    if any(k in pt or k in cat for k in ("airport", "aerodrome", "station", "subway", "railway", "bus", "terminal", "transit")):
        return "transit"
    if any(k in pt or k in cat for k in ("hotel", "hostel", "motel", "resort", "guest_house", "lodging", "chalet", "camp_site", "bed_and_breakfast")):
        return "lodging"
    if any(k in pt or k in cat for k in ("restaurant", "cafe", "bar", "pub", "food", "fast_food", "bakery", "biergarten")):
        return "food"
    if any(k in pt or k in cat for k in ("tourism", "attraction", "museum", "viewpoint", "beach", "monument", "artwork", "park", "theme_park", "peak", "nature_reserve", "lake", "valley", "historic")):
        return "attraction"
    if any(k in pt or k in cat for k in ("city", "town", "village", "administrative", "state", "island")):
        return "city"
    return "pin"


def _extract_subtitle(address_data: dict[str, Any], name: str, display_name: str) -> str:
    parts: list[str] = []
    district = _clean(address_data.get("suburb")) or _clean(address_data.get("neighbourhood"))
    city_val = _clean(address_data.get("city")) or _clean(address_data.get("town")) or _clean(address_data.get("village")) or _clean(address_data.get("county"))
    state_val = _clean(address_data.get("state")) or _clean(address_data.get("province"))
    country_val = _clean(address_data.get("country"))

    for item in (district, city_val, state_val, country_val):
        if item and item not in parts and item.casefold() != name.casefold():
            parts.append(item)

    return ", ".join(parts) if parts else display_name


def _make_result(item: dict[str, Any], match_type: str = "exact") -> dict[str, Any] | None:
    try:
        lat = float(item["lat"])
        lon = float(item["lon"])
    except (KeyError, TypeError, ValueError):
        return None

    address_data = item.get("address") or {}
    name = (
        _clean(item.get("name"))
        or _clean(address_data.get("tourism"))
        or _clean(address_data.get("amenity"))
        or _clean(address_data.get("leisure"))
        or _clean(address_data.get("city"))
        or _clean(address_data.get("town"))
        or _clean(address_data.get("village"))
        or "Selected place"
    )
    display_name = _clean(item.get("display_name")) or name
    osm_type = _clean(item.get("osm_type")) or ""
    osm_id = _clean(item.get("osm_id")) or _clean(item.get("place_id")) or display_name
    category = _clean(item.get("category"))
    place_type = _clean(item.get("type"))
    icon_type = _classify_icon_type(category, place_type)
    subtitle = _extract_subtitle(address_data, name, display_name)

    return {
        "place_id": f"{osm_type}{osm_id}",
        "name": name,
        "display_name": display_name,
        "subtitle": subtitle,
        "address": display_name,
        "latitude": lat,
        "longitude": lon,
        "category": category,
        "type": place_type,
        "icon_type": icon_type,
        "city": _clean(address_data.get("city") or address_data.get("town") or address_data.get("village")),
        "state": _clean(address_data.get("state")),
        "country": _clean(address_data.get("country")),
        "match_type": match_type,
    }


def find_spelling_suggestion(query: str) -> str | None:
    """Finds a fuzzy or phonetic spelling correction for user's query from known travel destinations."""
    normalized = query.strip().casefold()
    if len(normalized) < 3:
        return None

    # Exact alias match to canonical name
    if normalized in _ALIAS_TO_DESTINATION:
        canonical = _ALIAS_TO_DESTINATION[normalized]["name"]
        if canonical.casefold() != normalized:
            return canonical

    # Fuzzy match on full query
    alias_keys = list(_ALIAS_TO_DESTINATION.keys())
    close_matches = difflib.get_close_matches(normalized, alias_keys, n=1, cutoff=0.72)
    if close_matches:
        canonical = _ALIAS_TO_DESTINATION[close_matches[0]]["name"]
        if canonical.casefold() != normalized:
            return canonical

    # Token-based fuzzy match for multi-word queries (e.g. "hotel manli", "benglore airport")
    tokens = normalized.split()
    if len(tokens) > 1:
        modified = False
        new_tokens: list[str] = []
        for token in tokens:
            if len(token) >= 4:
                token_matches = difflib.get_close_matches(token, alias_keys, n=1, cutoff=0.76)
                if token_matches:
                    new_tokens.append(_ALIAS_TO_DESTINATION[token_matches[0]]["name"])
                    modified = True
                    continue
            new_tokens.append(token)
        if modified:
            return " ".join(new_tokens)

    return None


async def _execute_nominatim_search(query_str: str, limit: int) -> list[dict[str, Any]]:
    settings = get_settings()
    global _last_request_at
    lock = _get_async_lock()
    async with lock:
        wait_for = _MIN_INTERVAL_SECONDS - (time.monotonic() - _last_request_at)
        if wait_for > 0:
            await asyncio.sleep(wait_for)
        try:
            client = _get_async_client()
            response = await client.get(
                f"{settings.geocoding_base_url.rstrip('/')}/search",
                params={
                    "q": query_str,
                    "format": "jsonv2",
                    "limit": min(max(limit, 1), 10),
                    "addressdetails": 1,
                    "accept-language": "en",
                },
            )
            response.raise_for_status()
            return response.json()
        except (httpx.HTTPError, ValueError):
            return []
        finally:
            _last_request_at = time.monotonic()


async def search_places(query: str, limit: int = 6) -> dict[str, Any]:
    normalized = " ".join(query.strip().split())
    if len(normalized) < 2:
        raise HTTPException(status_code=422, detail="Enter at least 2 characters to search for a place.")

    key = normalized.casefold()
    now = time.monotonic()
    cached = _cache.get(key)
    if cached and now - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1]
    if cached:
        _cache.pop(key, None)

    # Step 1: Detect spelling suggestion / did_you_mean
    did_you_mean = find_spelling_suggestion(normalized)

    # Step 2: Try exact search on Nominatim
    raw_results = await _execute_nominatim_search(normalized, limit)
    results = [result for item in raw_results if (result := _make_result(item, match_type="exact")) is not None]

    # Step 3: If 0 results and we have a spelling suggestion, try Nominatim with the corrected term
    if not results and did_you_mean:
        corrected_raw = await _execute_nominatim_search(did_you_mean, limit)
        results = [
            result
            for item in corrected_raw
            if (result := _make_result(item, match_type="fuzzy_corrected")) is not None
        ]

    # Step 4: If still 0 results and multi-word, try relaxed query
    if not results and " " in normalized:
        words = [w for w in normalized.split() if w.lower() not in {"near", "in", "at", "the", "hotel", "resort", "cafe"}]
        if words and len(words) < len(normalized.split()):
            relaxed_q = " ".join(words)
            relaxed_raw = await _execute_nominatim_search(relaxed_q, limit)
            results = [
                result
                for item in relaxed_raw
                if (result := _make_result(item, match_type="semantic_fallback")) is not None
            ]

    # Step 5: If still 0 results, check curated offline destination index
    if not results:
        target = (did_you_mean or normalized).casefold()
        for dest in CURATED_DESTINATIONS:
            if target in dest["name"].casefold() or any(target in alias for alias in dest.get("aliases", [])):
                results.append({
                    "place_id": f"curated_{dest['name'].lower().replace(' ', '_')}",
                    "name": dest["name"],
                    "display_name": dest["display_name"],
                    "subtitle": dest["subtitle"],
                    "address": dest["display_name"],
                    "latitude": dest["latitude"],
                    "longitude": dest["longitude"],
                    "category": dest["category"],
                    "type": dest["type"],
                    "icon_type": dest["icon_type"],
                    "city": dest["city"],
                    "state": dest["state"],
                    "country": dest["country"],
                    "match_type": "fuzzy_corrected" if did_you_mean else "exact",
                })
                break

    payload: dict[str, Any] = {
        "query": normalized,
        "did_you_mean": did_you_mean if results and did_you_mean and did_you_mean.casefold() != normalized.casefold() else None,
        "results": results,
        "attribution": "© OpenStreetMap contributors",
    }

    if len(_cache) >= _CACHE_MAX:
        oldest = min(_cache, key=lambda cache_key: _cache[cache_key][0])
        _cache.pop(oldest, None)
    _cache[key] = (time.monotonic(), payload)

    return payload
