
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import lru_cache
from math import atan2, cos, radians, sin, sqrt
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
PAIR_CACHE_MAX = 256
ROUTE_TIMEOUT_SECONDS = 8.0
MAX_PARALLEL_LEGS = 4
ENDPOINT_VALIDATION_METERS = 2_000.0
SNAP_CONNECTOR_METERS = 20.0


def _cache_key(
    coordinates: list[tuple[float, float]],
) -> tuple[tuple[float, float], ...]:
    return tuple(
        (round(lat, 6), round(lon, 6))
        for lat, lon in coordinates
    )


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


def _parse_line_string(
    geometry: Any,
) -> list[dict[str, float]]:
    coordinates = (
        geometry.get("coordinates")
        if isinstance(geometry, dict)
        else None
    )

    if not isinstance(coordinates, list):
        return []

    parsed: list[dict[str, float]] = []

    for pair in coordinates:
        if (
            not isinstance(pair, list)
            or len(pair) < 2
        ):
            continue

        try:
            point = {
                "latitude": float(pair[1]),
                "longitude": float(pair[0]),
            }
        except (TypeError, ValueError):
            continue

        _append_points(
            parsed,
            [point],
        )

    return parsed


def _parse_leg_geometries(
    geometry: Any,
) -> list[list[dict[str, float]]]:
    """
    Backward-compatible parser for older by-legs responses.

    The new route implementation does not split a multi-stop overview.
    This helper remains available for the existing regression tests and
    future provider adapters.
    """
    if not isinstance(geometry, dict):
        return []

    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates")

    if (
        geometry_type == "MultiLineString"
        and isinstance(coordinates, list)
    ):
        return [
            _parse_line_string(
                {"coordinates": line}
            )
            for line in coordinates
            if isinstance(line, list)
        ]

    if geometry_type == "LineString":
        points = _parse_line_string(
            geometry
        )
        return [points] if points else []

    if geometry_type == "GeometryCollection":
        result: list[list[dict[str, float]]] = []

        for child in (
            geometry.get("geometries") or []
        ):
            result.extend(
                _parse_leg_geometries(
                    child
                )
            )

        return result

    if (
        isinstance(coordinates, list)
        and coordinates
        and all(
            isinstance(item, list)
            and item
            and isinstance(item[0], list)
            for item in coordinates
        )
    ):
        return [
            _parse_line_string(
                {"coordinates": line}
            )
            for line in coordinates
            if isinstance(line, list)
        ]

    return []


def _snap_points(
    payload: dict[str, Any],
) -> list[dict[str, float] | None]:
    result: list[dict[str, float] | None] = []

    for waypoint in (
        payload.get("waypoints") or []
    ):
        location = (
            waypoint.get("location")
            if isinstance(waypoint, dict)
            else None
        )

        if (
            not isinstance(location, list)
            or len(location) < 2
        ):
            result.append(None)
            continue

        try:
            result.append(
                {
                    "latitude": float(location[1]),
                    "longitude": float(location[0]),
                }
            )
        except (TypeError, ValueError):
            result.append(None)

    return result


def _haversine_meters(
    left: dict[str, float],
    right: dict[str, float],
) -> float:
    earth_radius = 6_371_000.0

    lat1 = radians(left["latitude"])
    lon1 = radians(left["longitude"])
    lat2 = radians(right["latitude"])
    lon2 = radians(right["longitude"])

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = (
        sin(dlat / 2) ** 2
        + cos(lat1)
        * cos(lat2)
        * sin(dlon / 2) ** 2
    )

    return 2 * earth_radius * atan2(
        sqrt(a),
        sqrt(max(0.0, 1.0 - a)),
    )


def _empty_pair(
    start: dict[str, float] | None = None,
    end: dict[str, float] | None = None,
) -> dict[str, Any]:
    return {
        "points": (
            [dict(start), dict(end)]
            if start is not None
            and end is not None
            else []
        ),
        "distance_meters": 0.0,
        "duration_seconds": 0.0,
        "routed": False,
        "fallback": False,
        "snapped_start": None,
        "snapped_end": None,
        "snap_distance_start_meters": 0.0,
        "snap_distance_end_meters": 0.0,
    }


def _request_http(
    client: httpx.Client,
    url: str,
    params: dict[str, Any],
) -> dict[str, Any] | None:
    try:
        response = client.get(
            url,
            params=params,
        )

        if response.status_code >= 500:
            return None

        payload = response.json()

        return (
            payload
            if isinstance(payload, dict)
            else None
        )
    except (
        httpx.HTTPError,
        ValueError,
    ):
        return None


def _route_candidate(
    payload: dict[str, Any] | None,
    requested_start: dict[str, float],
    requested_end: dict[str, float],
    fallback: bool,
    snap_distance_start: float = 0.0,
    snap_distance_end: float = 0.0,
) -> dict[str, Any]:
    if not payload:
        return _empty_pair()

    if payload.get("code") != "Ok":
        return _empty_pair()

    routes = payload.get("routes") or []

    if (
        not routes
        or not isinstance(routes[0], dict)
    ):
        return _empty_pair()

    route = routes[0]

    points = _parse_line_string(
        route.get("geometry")
    )

    if len(points) < 2:
        return _empty_pair()

    snapped = _snap_points(payload)

    snapped_start = (
        snapped[0]
        if len(snapped) >= 1
        and snapped[0] is not None
        else dict(requested_start)
    )

    snapped_end = (
        snapped[1]
        if len(snapped) >= 2
        and snapped[1] is not None
        else dict(requested_end)
    )

    # Route geometry must begin and end near the routing engine's own
    # snapped waypoints. This prevents accepting a malformed/partial
    # geometry that starts in the middle of the road leg.
    if (
        _haversine_meters(
            points[0],
            snapped_start,
        ) > ENDPOINT_VALIDATION_METERS
        or _haversine_meters(
            points[-1],
            snapped_end,
        ) > ENDPOINT_VALIDATION_METERS
    ):
        return _empty_pair()

    distance = float(
        route.get("distance") or 0.0
    )

    duration = float(
        route.get("duration") or 0.0
    )

    # A distinct pair should not silently become a zero-distance routed leg.
    # Same-coordinate stops are handled explicitly by _request_pair_route.
    if distance <= 0.0:
        return _empty_pair()

    return {
        "points": _with_endpoints(
            points,
            snapped_start,
            snapped_end,
        ),
        "distance_meters": distance,
        "duration_seconds": duration,
        "routed": True,
        "fallback": fallback,
        "snapped_start": snapped_start,
        "snapped_end": snapped_end,
        "snap_distance_start_meters": (
            snap_distance_start
        ),
        "snap_distance_end_meters": (
            snap_distance_end
        ),
    }


def _request_nearest(
    coordinate: tuple[float, float],
) -> dict[str, Any]:
    settings = get_settings()
    base_url = (
        settings.routing_base_url
        .rstrip("/")
    )

    url = (
        f"{base_url}/nearest/v1/driving/"
        f"{coordinate[1]:.6f},"
        f"{coordinate[0]:.6f}"
    )

    try:
        with httpx.Client(
            timeout=ROUTE_TIMEOUT_SECONDS,
            headers={
                "User-Agent": (
                    f"FairShare/"
                    f"{settings.app_version} "
                    "route-planner"
                )
            },
            follow_redirects=True,
        ) as client:
            payload = _request_http(
                client,
                url,
                {"number": 1},
            )
    except httpx.HTTPError:
        payload = None

    if (
        not payload
        or payload.get("code") != "Ok"
    ):
        return {
            "point": None,
            "distance_meters": 0.0,
        }

    waypoints = (
        payload.get("waypoints") or []
    )

    if (
        not waypoints
        or not isinstance(
            waypoints[0],
            dict,
        )
    ):
        return {
            "point": None,
            "distance_meters": 0.0,
        }

    location = waypoints[0].get(
        "location"
    )

    if (
        not isinstance(location, list)
        or len(location) < 2
    ):
        return {
            "point": None,
            "distance_meters": 0.0,
        }

    try:
        return {
            "point": {
                "latitude": float(location[1]),
                "longitude": float(location[0]),
            },
            "distance_meters": float(
                waypoints[0].get(
                    "distance"
                ) or 0.0
            ),
        }
    except (
        TypeError,
        ValueError,
    ):
        return {
            "point": None,
            "distance_meters": 0.0,
        }


@lru_cache(maxsize=PAIR_CACHE_MAX)
def _request_pair_route(
    start: tuple[float, float],
    end: tuple[float, float],
) -> dict[str, Any]:
    requested_start = {
        "latitude": start[0],
        "longitude": start[1],
    }

    requested_end = {
        "latitude": end[0],
        "longitude": end[1],
    }

    # Two identical consecutive stops are valid itinerary entries and should
    # not be rendered as an artificial "unroutable" road.
    if _same_point(
        requested_start,
        requested_end,
        tolerance=1e-6,
    ):
        return {
            "points": [
                dict(requested_start),
                dict(requested_end),
            ],
            "distance_meters": 0.0,
            "duration_seconds": 0.0,
            "routed": True,
            "fallback": False,
            "snapped_start": dict(requested_start),
            "snapped_end": dict(requested_end),
            "snap_distance_start_meters": 0.0,
            "snap_distance_end_meters": 0.0,
        }

    settings = get_settings()
    base_url = (
        settings.routing_base_url
        .rstrip("/")
    )

    coordinate_path = (
        f"{start[1]:.6f},{start[0]:.6f};"
        f"{end[1]:.6f},{end[0]:.6f}"
    )

    route_url = (
        f"{base_url}/route/v1/"
        f"driving/{coordinate_path}"
    )

    route_params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "false",
    }

    try:
        with httpx.Client(
            timeout=ROUTE_TIMEOUT_SECONDS,
            headers={
                "User-Agent": (
                    f"FairShare/"
                    f"{settings.app_version} "
                    "route-planner"
                )
            },
            follow_redirects=True,
        ) as client:
            payload = _request_http(
                client,
                route_url,
                route_params,
            )

            direct = _route_candidate(
                payload,
                requested_start,
                requested_end,
                fallback=False,
            )

            if direct["routed"]:
                return direct

    except httpx.HTTPError:
        pass

    # Second chance for arbitrary POIs such as lakes, monuments or viewpoints:
    # snap both endpoints to the nearest drivable road and route the snapped pair.
    nearest_start = _request_nearest(
        start
    )
    nearest_end = _request_nearest(
        end
    )

    snapped_start = (
        nearest_start["point"]
        or requested_start
    )

    snapped_end = (
        nearest_end["point"]
        or requested_end
    )

    # If nearest snapping made no meaningful change and the direct request
    # already failed, there is no value in repeating exactly the same request.
    if (
        _same_point(
            snapped_start,
            requested_start,
            tolerance=1e-7,
        )
        and _same_point(
            snapped_end,
            requested_end,
            tolerance=1e-7,
        )
    ):
        return _empty_pair(
            requested_start,
            requested_end,
        )

    snapped_path = (
        f"{snapped_start['longitude']:.6f},"
        f"{snapped_start['latitude']:.6f};"
        f"{snapped_end['longitude']:.6f},"
        f"{snapped_end['latitude']:.6f}"
    )

    snapped_url = (
        f"{base_url}/route/v1/"
        f"driving/{snapped_path}"
    )

    try:
        with httpx.Client(
            timeout=ROUTE_TIMEOUT_SECONDS,
            headers={
                "User-Agent": (
                    f"FairShare/"
                    f"{settings.app_version} "
                    "route-planner"
                )
            },
            follow_redirects=True,
        ) as client:
            snapped_payload = _request_http(
                client,
                snapped_url,
                route_params,
            )
    except httpx.HTTPError:
        snapped_payload = None

    recovered = _route_candidate(
        snapped_payload,
        snapped_start,
        snapped_end,
        fallback=True,
        snap_distance_start=float(
            nearest_start[
                "distance_meters"
            ]
        ),
        snap_distance_end=float(
            nearest_end[
                "distance_meters"
            ]
        ),
    )

    if recovered["routed"]:
        return recovered

    return _empty_pair(
        requested_start,
        requested_end,
    )


def _route_pairs_in_parallel(
    input_points: list[dict[str, float]],
) -> list[dict[str, Any]]:
    pair_count = (
        len(input_points) - 1
    )

    if pair_count <= 0:
        return []

    # For one leg, avoid creating a worker thread.
    if pair_count == 1:
        return [
            _request_pair_route(
                (
                    input_points[0][
                        "latitude"
                    ],
                    input_points[0][
                        "longitude"
                    ],
                ),
                (
                    input_points[1][
                        "latitude"
                    ],
                    input_points[1][
                        "longitude"
                    ],
                ),
            )
        ]

    results: list[dict[str, Any] | None] = [
        None
    ] * pair_count

    with ThreadPoolExecutor(
        max_workers=min(
            MAX_PARALLEL_LEGS,
            pair_count,
        )
    ) as executor:
        futures = {
            executor.submit(
                _request_pair_route,
                (
                    input_points[index][
                        "latitude"
                    ],
                    input_points[index][
                        "longitude"
                    ],
                ),
                (
                    input_points[index + 1][
                        "latitude"
                    ],
                    input_points[index + 1][
                        "longitude"
                    ],
                ),
            ): index
            for index in range(pair_count)
        }

        for future in as_completed(futures):
            index = futures[future]

            try:
                results[index] = future.result()
            except Exception:
                results[index] = _empty_pair(
                    input_points[index],
                    input_points[index + 1],
                )

    return [
        result
        if result is not None
        else _empty_pair(
            input_points[index],
            input_points[index + 1],
        )
        for index, result in enumerate(
            results
        )
    ]


def _combine_leg_geometries(
    legs: list[dict[str, Any]],
) -> list[dict[str, float]]:
    combined: list[dict[str, float]] = []

    for leg in legs:
        _append_points(
            combined,
            leg.get("points") or [],
        )

    return combined


@lru_cache(maxsize=ROUTE_CACHE_MAX)
def _request_route(
    coordinates_key: tuple[tuple[float, float], ...],
) -> dict[str, Any]:
    """
    Calculate routes strictly as independent consecutive pairs.

    N stops always produces N-1 route legs. There is intentionally no
    multi-stop geometry splitting in the normal routing path.
    """
    if len(coordinates_key) < 2:
        return {
            "distance_meters": 0.0,
            "duration_seconds": 0.0,
            "geometry": [],
            "snapped_stops": [],
            "legs": [],
            "has_fallback_legs": False,
            "has_non_routed_legs": False,
            "warning": None,
        }

    input_points = [
        {
            "latitude": lat,
            "longitude": lon,
        }
        for lat, lon in coordinates_key
    ]

    raw_legs = _route_pairs_in_parallel(
        input_points
    )

    legs: list[dict[str, Any]] = []

    snapped_by_index: dict[int, dict[str, Any]] = {}

    for index, raw in enumerate(
        raw_legs
    ):
        if raw.get("snapped_start"):
            snapped_by_index.setdefault(
                index,
                {
                    "point": raw[
                        "snapped_start"
                    ],
                    "distance_meters": float(
                        raw.get(
                            "snap_distance_start_meters"
                        )
                        or 0.0
                    ),
                },
            )

        if raw.get("snapped_end"):
            snapped_by_index.setdefault(
                index + 1,
                {
                    "point": raw[
                        "snapped_end"
                    ],
                    "distance_meters": float(
                        raw.get(
                            "snap_distance_end_meters"
                        )
                        or 0.0
                    ),
                },
            )

        legs.append(
            {
                "points": raw.get(
                    "points"
                )
                or [
                    dict(input_points[index]),
                    dict(input_points[index + 1]),
                ],
                "distance_meters": float(
                    raw.get(
                        "distance_meters"
                    )
                    or 0.0
                ),
                "duration_seconds": float(
                    raw.get(
                        "duration_seconds"
                    )
                    or 0.0
                ),
                "routed": bool(
                    raw.get(
                        "routed",
                        False,
                    )
                ),
                "fallback": bool(
                    raw.get(
                        "fallback",
                        False,
                    )
                ),
                "status": (
                    "routed"
                    if raw.get("routed")
                    and not raw.get("fallback")
                    else (
                        "fallback"
                        if raw.get(
                            "routed"
                        )
                        else "unroutable"
                    )
                ),
            }
        )

    routed_distance = sum(
        leg["distance_meters"]
        for leg in legs
        if leg["routed"]
    )

    routed_duration = sum(
        leg["duration_seconds"]
        for leg in legs
        if leg["routed"]
    )

    any_fallback = any(
        leg["fallback"]
        for leg in legs
    )

    any_unrouted = any(
        not leg["routed"]
        for leg in legs
    )

    snapped_stops = []

    for index, data in sorted(
        snapped_by_index.items()
    ):
        point = data["point"]
        input_point = input_points[index]

        if (
            _haversine_meters(
                input_point,
                point,
            )
            >= SNAP_CONNECTOR_METERS
        ):
            snapped_stops.append(
                {
                    "index": index,
                    "latitude": point[
                        "latitude"
                    ],
                    "longitude": point[
                        "longitude"
                    ],
                    "distance_meters": float(
                        data[
                            "distance_meters"
                        ]
                        or 0.0
                    ),
                }
            )

    warning = None

    if any_unrouted:
        warning = (
            "One or more consecutive stops could not be connected "
            "to the drivable road network. Those sections are shown "
            "as dashed connectors."
        )
    elif any_fallback:
        warning = (
            "Some stops were snapped to the nearest drivable road "
            "before routing."
        )

    return {
        "distance_meters": routed_distance,
        "duration_seconds": routed_duration,
        "geometry": _combine_leg_geometries(
            legs
        ),
        "snapped_stops": snapped_stops,
        "legs": legs,
        "has_fallback_legs": any_fallback,
        "has_non_routed_legs": any_unrouted,
        "warning": warning,
    }



def _build_route_response(
    calculated: dict[str, Any],
    route_stops: list[dict[str, Any]],
    day_number: int | None,
) -> dict[str, Any]:
    """Build a fresh API response without mutating the LRU-cached route object."""
    response = dict(calculated)
    response["day_number"] = day_number
    response["stops"] = route_stops

    normalized_snapped: list[dict[str, Any]] = []
    for item in calculated.get("snapped_stops") or []:
        if not isinstance(item, dict):
            continue

        index_value = item.get("index")
        if index_value is None and item.get("stop_id") is not None:
            stop_id = str(item.get("stop_id"))
            index_value = next(
                (i for i, stop in enumerate(route_stops)
                 if str(stop.get("stop_id")) == stop_id),
                None,
            )

        try:
            index = int(index_value)
        except (TypeError, ValueError):
            continue

        if not 0 <= index < len(route_stops):
            continue

        latitude = item.get("latitude")
        longitude = item.get("longitude")
        if latitude is None or longitude is None:
            continue

        normalized_snapped.append({
            "stop_id": route_stops[index]["stop_id"],
            "latitude": float(latitude),
            "longitude": float(longitude),
            "distance_meters": float(item.get("distance_meters") or 0.0),
        })

    normalized_legs: list[dict[str, Any]] = []
    for index, raw_leg in enumerate(calculated.get("legs") or []):
        if index >= len(route_stops) - 1:
            break
        if not isinstance(raw_leg, dict):
            continue
        leg = dict(raw_leg)
        leg["from_stop_id"] = route_stops[index]["stop_id"]
        leg["to_stop_id"] = route_stops[index + 1]["stop_id"]
        normalized_legs.append(leg)

    response["snapped_stops"] = normalized_snapped
    response["legs"] = normalized_legs
    return response

def get_trip_route(
    session: Session,
    group_id: UUID,
    user_id: UUID,
    day_number: int | None = None,
) -> dict[str, Any]:
    _require_trip_access(
        session,
        group_id,
        user_id,
    )

    trip = _get_trip(
        session,
        group_id,
    )

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
        .where(
            TripStop.trip_id == trip.id
        )
        .order_by(
            TripStop.day_number.asc(),
            TripStop.sequence.asc(),
        )
    )

    if day_number is not None:
        query = query.where(
            TripStop.day_number == day_number
        )

    stops = list(
        session.scalars(query)
    )

    if len(stops) < 2:
        if day_number is not None:
            detail = (
                f"Add at least two stops to Day "
                f"{day_number} before calculating a route."
            )
        else:
            detail = (
                "Add at least two itinerary stops "
                "before calculating a route."
            )

        raise HTTPException(
            status_code=422,
            detail=detail,
        )

    missing = [
        stop.name
        for stop in stops
        if stop.latitude is None
        or stop.longitude is None
    ]

    if missing:
        preview = ", ".join(
            missing[:3]
        )
        suffix = (
            "…"
            if len(missing) > 3
            else ""
        )

        raise HTTPException(
            status_code=422,
            detail=(
                "Add coordinates to every itinerary stop "
                f"before calculating a route. Missing: "
                f"{preview}{suffix}"
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
        (
            item["latitude"],
            item["longitude"],
        )
        for item in route_stops
    ]

    calculated = _request_route(
        _cache_key(coordinates)
    )

    return _build_route_response(
        calculated=calculated,
        route_stops=route_stops,
        day_number=day_number,
    )
