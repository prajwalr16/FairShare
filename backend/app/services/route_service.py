from __future__ import annotations

from functools import lru_cache
from typing import Any
from uuid import UUID

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..models import TripStop
from .trip_service import _get_trip, _require_trip_access

ROUTE_CACHE_MAX = 128
ROUTE_TIMEOUT_SECONDS = 8.0


def _cache_key(coordinates: list[tuple[float, float]]) -> tuple[tuple[float, float], ...]:
    return tuple((round(lat, 6), round(lon, 6)) for lat, lon in coordinates)


def _same_point(
    left: dict[str, float],
    right: dict[str, float],
    tolerance: float = 1e-6,
) -> bool:
    return (
        abs(left["latitude"] - right["latitude"]) <= tolerance
        and abs(left["longitude"] - right["longitude"]) <= tolerance
    )


def _append_points(
    target: list[dict[str, float]],
    points: list[dict[str, float]],
) -> None:
    for point in points:
        if not target or not _same_point(target[-1], point):
            target.append(point)


def _with_endpoints(
    points: list[dict[str, float]],
    start: dict[str, float],
    end: dict[str, float],
) -> list[dict[str, float]]:
    result = [dict(point) for point in points]
    if not result:
        return [dict(start), dict(end)]
    if not _same_point(result[0], start):
        result.insert(0, dict(start))
    if not _same_point(result[-1], end):
        result.append(dict(end))
    return result


def _parse_line_string(geometry: Any) -> list[dict[str, float]]:
    coordinates = geometry.get("coordinates") if isinstance(geometry, dict) else None
    if not isinstance(coordinates, list):
        return []

    parsed: list[dict[str, float]] = []
    for pair in coordinates:
        if not isinstance(pair, list) or len(pair) < 2:
            continue
        try:
            point = {"latitude": float(pair[1]), "longitude": float(pair[0])}
        except (TypeError, ValueError):
            continue
        _append_points(parsed, [point])
    return parsed


def _parse_leg_geometries(geometry: Any) -> list[list[dict[str, float]]]:
    """
    Parse OSRM overview=by_legs GeoJSON.

    Depending on the server version, the geometry may be a MultiLineString,
    a collection-like list of LineStrings, or a plain LineString fallback.
    """
    if not isinstance(geometry, dict):
        return []

    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates")

    if geometry_type == "MultiLineString" and isinstance(coordinates, list):
        result: list[list[dict[str, float]]] = []
        for line in coordinates:
            if not isinstance(line, list):
                result.append([])
                continue
            result.append(_parse_line_string({"coordinates": line}))
        return result

    if geometry_type == "LineString":
        points = _parse_line_string(geometry)
        return [points] if points else []

    if geometry_type == "GeometryCollection":
        result = []
        for child in geometry.get("geometries") or []:
            result.extend(_parse_leg_geometries(child))
        return result

    if isinstance(coordinates, list) and coordinates:
        if all(
            isinstance(item, list)
            and item
            and isinstance(item[0], list)
            for item in coordinates
        ):
            return [
                _parse_line_string({"coordinates": line})
                for line in coordinates
                if isinstance(line, list)
            ]

    return []


def _snap_points(payload: dict[str, Any]) -> list[dict[str, float] | None]:
    points: list[dict[str, float] | None] = []
    for waypoint in payload.get("waypoints") or []:
        location = waypoint.get("location") if isinstance(waypoint, dict) else None
        if not isinstance(location, list) or len(location) < 2:
            points.append(None)
            continue
        try:
            points.append({"latitude": float(location[1]), "longitude": float(location[0])})
        except (TypeError, ValueError):
            points.append(None)
    return points


def _nearest_geometry_index(
    geometry: list[dict[str, float]],
    target: dict[str, float],
    start_index: int,
) -> int:
    if not geometry:
        return start_index

    best_index = min(max(start_index, 0), len(geometry) - 1)
    best_distance = float("inf")

    for index in range(best_index, len(geometry)):
        point = geometry[index]
        distance = (
            (point["latitude"] - target["latitude"]) ** 2
            + (point["longitude"] - target["longitude"]) ** 2
        )
        if distance < best_distance:
            best_distance = distance
            best_index = index

    return best_index


def _build_leg_geometries(
    geometry: list[dict[str, float]],
    waypoint_points: list[dict[str, float]],
    input_points: list[dict[str, float]],
) -> list[list[dict[str, float]]]:
    """
    Split a continuous ordered route geometry into N-1 consecutive legs.

    This helper is intentionally retained because the parser test suite and
    older provider responses still rely on it.
    """
    if len(input_points) < 2 or len(geometry) < 2:
        return []

    boundaries = (
        waypoint_points
        if len(waypoint_points) == len(input_points)
        else input_points
    )

    indices = [0]
    search_start = 0
    for target in boundaries[1:-1]:
        index = _nearest_geometry_index(geometry, target, search_start)
        indices.append(index)
        search_start = index
    indices.append(len(geometry) - 1)

    legs: list[list[dict[str, float]]] = []
    for leg_index in range(len(input_points) - 1):
        start_index = indices[leg_index]
        end_index = max(start_index, indices[leg_index + 1])
        segment = [
            dict(point)
            for point in geometry[start_index : end_index + 1]
        ]
        segment = _with_endpoints(
            segment,
            boundaries[leg_index],
            boundaries[leg_index + 1],
        )

        deduped: list[dict[str, float]] = []
        for point in segment:
            if not deduped or not _same_point(deduped[-1], point):
                deduped.append(point)

        if len(deduped) < 2:
            deduped = [
                dict(boundaries[leg_index]),
                dict(boundaries[leg_index + 1]),
            ]

        legs.append(deduped)

    return legs


def _combine_leg_geometries(
    legs: list[dict[str, Any]],
) -> list[dict[str, float]]:
    combined: list[dict[str, float]] = []
    for leg in legs:
        _append_points(combined, leg.get("points") or [])
    return combined


def _request_http(
    client: httpx.Client,
    url: str,
    params: dict[str, Any],
) -> dict[str, Any] | None:
    try:
        response = client.get(url, params=params)
        if response.status_code >= 500:
            return None
        payload = response.json()
        return payload if isinstance(payload, dict) else None
    except (httpx.HTTPError, ValueError):
        return None


@lru_cache(maxsize=ROUTE_CACHE_MAX)
def _request_pair_route(
    start: tuple[float, float],
    end: tuple[float, float],
) -> dict[str, Any]:
    settings = get_settings()
    base_url = settings.routing_base_url.rstrip("/")
    coordinate_path = (
        f"{start[1]:.6f},{start[0]:.6f};"
        f"{end[1]:.6f},{end[0]:.6f}"
    )
    url = f"{base_url}/route/v1/driving/{coordinate_path}"

    try:
        with httpx.Client(
            timeout=ROUTE_TIMEOUT_SECONDS,
            headers={
                "User-Agent": f"FairShare/{settings.app_version} route-planner"
            },
            follow_redirects=True,
        ) as client:
            payload = _request_http(
                client,
                url,
                {
                    "overview": "full",
                    "geometries": "geojson",
                    "steps": "false",
                    "snapping": "any",
                    "source": "first",
                    "destination": "last",
                },
            )
    except httpx.HTTPError:
        payload = None

    if not payload or payload.get("code") != "Ok" or not payload.get("routes"):
        return {
            "points": [],
            "distance_meters": 0.0,
            "duration_seconds": 0.0,
            "routed": False,
        }

    route = payload["routes"][0]
    points = _parse_line_string(route.get("geometry"))
    if len(points) < 2:
        return {
            "points": [],
            "distance_meters": 0.0,
            "duration_seconds": 0.0,
            "routed": False,
        }

    return {
        "points": points,
        "distance_meters": float(route.get("distance") or 0),
        "duration_seconds": float(route.get("duration") or 0),
        "routed": True,
    }


@lru_cache(maxsize=ROUTE_CACHE_MAX)
def _request_route(
    coordinates_key: tuple[tuple[float, float], ...],
) -> dict[str, Any]:
    """
    Return one explicit route leg for every consecutive input coordinate.

    Provider strategy:
      1. OSRM overview=by_legs when supported.
      2. OSRM full overview + deterministic geometry splitting.
      3. Pair-level OSRM retry for only the missing leg.
      4. Non-road visual connector when the pair is genuinely unroutable.
    """
    settings = get_settings()
    base_url = settings.routing_base_url.rstrip("/")
    coordinate_path = ";".join(
        f"{lon:.6f},{lat:.6f}" for lat, lon in coordinates_key
    )
    url = f"{base_url}/route/v1/driving/{coordinate_path}"
    input_points = [
        {"latitude": lat, "longitude": lon}
        for lat, lon in coordinates_key
    ]

    if len(input_points) < 2:
        return {
            "distance_meters": 0.0,
            "duration_seconds": 0.0,
            "geometry": [],
            "snapped_stops": [],
            "legs": [],
            "has_fallback_legs": False,
            "has_non_routed_legs": False,
        }

    payload: dict[str, Any] | None = None
    try:
        with httpx.Client(
            timeout=ROUTE_TIMEOUT_SECONDS,
            headers={
                "User-Agent": f"FairShare/{settings.app_version} route-planner"
            },
            follow_redirects=True,
        ) as client:
            # Preferred path: one geometry for every actual OSRM route leg.
            by_legs_payload = _request_http(
                client,
                url,
                {
                    "overview": "by_legs",
                    "geometries": "geojson",
                    "steps": "false",
                    "snapping": "any",
                    "source": "first",
                    "destination": "last",
                },
            )

            if (
                by_legs_payload
                and by_legs_payload.get("code") == "Ok"
                and by_legs_payload.get("routes")
            ):
                candidate = by_legs_payload["routes"][0]
                candidate_leg_geometries = _parse_leg_geometries(
                    candidate.get("geometry")
                )
                if len(candidate_leg_geometries) == len(input_points) - 1 and all(
                    len(points) >= 2 for points in candidate_leg_geometries
                ):
                    snapped = _snap_points(by_legs_payload)
                    if len(snapped) != len(input_points):
                        snapped = [None] * len(input_points)

                    legs = []
                    for index, points in enumerate(candidate_leg_geometries):
                        start = snapped[index] or input_points[index]
                        end = snapped[index + 1] or input_points[index + 1]
                        points = _with_endpoints(points, start, end)
                        raw_leg = (
                            candidate.get("legs", [])[index]
                            if index < len(candidate.get("legs", []))
                            and isinstance(candidate.get("legs", [])[index], dict)
                            else {}
                        )
                        legs.append(
                            {
                                "points": points,
                                "distance_meters": float(raw_leg.get("distance") or 0),
                                "duration_seconds": float(raw_leg.get("duration") or 0),
                                "routed": True,
                                "fallback": False,
                            }
                        )

                    combined = _combine_leg_geometries(legs)
                    return {
                        "distance_meters": float(candidate.get("distance") or 0),
                        "duration_seconds": float(candidate.get("duration") or 0),
                        "geometry": combined,
                        "snapped_stops": [
                            point for point in snapped if point is not None
                        ],
                        "legs": legs,
                        "has_fallback_legs": False,
                        "has_non_routed_legs": False,
                    }

            # Compatibility path for older OSRM servers that don't understand
            # overview=by_legs.
            payload = _request_http(
                client,
                url,
                {
                    "overview": "full",
                    "geometries": "geojson",
                    "steps": "false",
                    "snapping": "any",
                    "source": "first",
                    "destination": "last",
                },
            )
    except httpx.HTTPError:
        payload = None

    route_distance = 0.0
    route_duration = 0.0
    full_geometry: list[dict[str, float]] = []
    snapped: list[dict[str, float] | None] = []
    raw_legs: list[dict[str, Any]] = []

    if payload and payload.get("code") == "Ok" and payload.get("routes"):
        route = payload["routes"][0]
        route_distance = float(route.get("distance") or 0)
        route_duration = float(route.get("duration") or 0)
        full_geometry = _parse_line_string(route.get("geometry"))
        snapped = _snap_points(payload)
        raw_legs = [
            leg
            for leg in (route.get("legs") or [])
            if isinstance(leg, dict)
        ]

    boundaries = (
        snapped
        if len(snapped) == len(input_points) and all(snapped)
        else input_points
    )

    sliced_legs = _build_leg_geometries(
        full_geometry,
        [point for point in boundaries if point],
        input_points,
    )

    if len(sliced_legs) != len(input_points) - 1:
        sliced_legs = [[] for _ in range(len(input_points) - 1)]

    legs: list[dict[str, Any]] = []
    for index in range(len(input_points) - 1):
        start_point = boundaries[index]
        end_point = boundaries[index + 1]

        points = sliced_legs[index]
        distance = (
            float(raw_legs[index].get("distance") or 0)
            if index < len(raw_legs)
            else 0.0
        )
        duration = (
            float(raw_legs[index].get("duration") or 0)
            if index < len(raw_legs)
            else 0.0
        )

        fallback = False
        routed = len(points) >= 2

        if not routed:
            pair = _request_pair_route(
                (input_points[index]["latitude"], input_points[index]["longitude"]),
                (
                    input_points[index + 1]["latitude"],
                    input_points[index + 1]["longitude"],
                ),
            )
            if pair["routed"]:
                points = _with_endpoints(
                    pair["points"],
                    start_point,
                    end_point,
                )
                distance = pair["distance_meters"]
                duration = pair["duration_seconds"]
                routed = True
                fallback = True
            else:
                # Keep the Journey visually continuous, but explicitly mark
                # this as non-road so the client never presents it as driving.
                points = [dict(start_point), dict(end_point)]
                distance = 0.0
                duration = 0.0
                routed = False
                fallback = True

        legs.append(
            {
                "points": points,
                "distance_meters": distance,
                "duration_seconds": duration,
                "routed": routed,
                "fallback": fallback,
            }
        )

    road_distance = sum(
        float(leg["distance_meters"])
        for leg in legs
        if leg["routed"]
    )
    road_duration = sum(
        float(leg["duration_seconds"])
        for leg in legs
        if leg["routed"]
    )
    any_fallback = any(bool(leg["fallback"]) for leg in legs)
    any_non_routed = any(not bool(leg["routed"]) for leg in legs)

    # Always build the display geometry from the exact legs the client sees.
    # This prevents an old/top-level provider geometry from disagreeing with
    # the explicit 1→2, 2→3, ... N-1→N route legs.
    display_geometry = _combine_leg_geometries(legs)

    return {
        "distance_meters": (
            route_distance
            if route_distance > 0 and not any_fallback
            else road_distance
        ),
        "duration_seconds": (
            route_duration
            if route_duration > 0 and not any_fallback
            else road_duration
        ),
        "geometry": display_geometry or full_geometry,
        "snapped_stops": [
            point for point in snapped if point is not None
        ],
        "legs": legs,
        "has_fallback_legs": any_fallback,
        "has_non_routed_legs": any_non_routed,
    }


def _route_warning(legs: list[dict[str, Any]]) -> str | None:
    if any(not bool(leg.get("routed", True)) for leg in legs):
        return (
            "One or more stops are off the road network. "
            "A dashed visual connector is shown for those sections."
        )
    if any(bool(leg.get("fallback")) for leg in legs):
        return "Some route sections used a fallback road request."
    return None


def get_trip_route(
    session: Session,
    group_id: UUID,
    user_id: UUID,
    day_number: int | None = None,
) -> dict[str, Any]:
    _require_trip_access(session, group_id, user_id)
    trip = _get_trip(session, group_id)
    if trip is None:
        raise HTTPException(
            status_code=404,
            detail="Trip is not configured for this group.",
        )

    if day_number is not None and day_number < 1:
        raise HTTPException(
            status_code=422,
            detail="Day number must be at least 1.",
        )

    query = (
        select(TripStop)
        .where(TripStop.trip_id == trip.id)
        .order_by(TripStop.day_number.asc(), TripStop.sequence.asc())
    )
    if day_number is not None:
        query = query.where(TripStop.day_number == day_number)

    stops = list(session.scalars(query))
    if len(stops) < 2:
        detail = (
            (
                f"Add at least two stops to Day {day_number} "
                "before calculating a route."
            )
            if day_number is not None
            else "Add at least two itinerary stops before calculating a route."
        )
        raise HTTPException(status_code=422, detail=detail)

    missing = [
        stop.name
        for stop in stops
        if stop.latitude is None or stop.longitude is None
    ]
    if missing:
        preview = ", ".join(missing[:3])
        suffix = "…" if len(missing) > 3 else ""
        raise HTTPException(
            status_code=422,
            detail=(
                "Add coordinates to every itinerary stop before calculating "
                f"a route. Missing: {preview}{suffix}"
            ),
        )

    route_stops = [
        {
            "stop_id": str(stop.id),
            "sequence": stop.sequence,
            "day_number": stop.day_number,
            "latitude": float(stop.latitude),
            "longitude": float(stop.longitude),
            "name": stop.name,
            "stop_type": stop.stop_type,
        }
        for stop in stops
    ]

    coordinates = [
        (item["latitude"], item["longitude"])
        for item in route_stops
    ]
    calculated = _request_route(_cache_key(coordinates))
    calculated["day_number"] = day_number

    snapped_by_index = calculated.get("snapped_stops") or []
    for index, snapped in enumerate(snapped_by_index):
        if index < len(route_stops):
            snapped["stop_id"] = route_stops[index]["stop_id"]

    for index, leg in enumerate(calculated.get("legs") or []):
        if index < len(route_stops) - 1:
            leg["from_stop_id"] = route_stops[index]["stop_id"]
            leg["to_stop_id"] = route_stops[index + 1]["stop_id"]

    calculated["stops"] = route_stops
    calculated["warning"] = _route_warning(calculated.get("legs") or [])
    return calculated
