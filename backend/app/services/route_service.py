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


def _cache_key(coordinates: list[tuple[float, float]]) -> tuple[tuple[float, float], ...]:
    return tuple((round(lat, 6), round(lon, 6)) for lat, lon in coordinates)


@lru_cache(maxsize=ROUTE_CACHE_MAX)
def _request_route(coordinates_key: tuple[tuple[float, float], ...]) -> dict[str, Any]:
    settings = get_settings()
    base_url = settings.routing_base_url.rstrip('/')
    coordinate_path = ';'.join(f'{lon:.6f},{lat:.6f}' for lat, lon in coordinates_key)
    url = f'{base_url}/route/v1/driving/{coordinate_path}'

    try:
        with httpx.Client(
            timeout=8.0,
            headers={'User-Agent': f'FairShare/{settings.app_version} route-planner'},
            follow_redirects=True,
        ) as client:
            response = client.get(
                url,
                params={'overview': 'full', 'geometries': 'geojson', 'steps': 'false'},
            )
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail='Route service is temporarily unavailable.') from exc

    if payload.get('code') != 'Ok' or not payload.get('routes'):
        raise HTTPException(status_code=422, detail='No drivable route could be calculated for these stops.')

    route = payload['routes'][0]
    geometry = route.get('geometry', {}).get('coordinates') or []
    waypoints = route.get('waypoints') or []
    if len(geometry) < 2:
        raise HTTPException(status_code=422, detail='The route service returned no usable route geometry.')

    parsed_geometry = [
        {'latitude': float(pair[1]), 'longitude': float(pair[0])}
        for pair in geometry
        if isinstance(pair, list) and len(pair) >= 2
    ]
    if len(parsed_geometry) < 2:
        raise HTTPException(status_code=422, detail='The route service returned no usable route geometry.')

    snapped_stops = []
    for waypoint in waypoints:
        location = waypoint.get('location') if isinstance(waypoint, dict) else None
        if isinstance(location, list) and len(location) >= 2:
            try:
                snapped_stops.append({'latitude': float(location[1]), 'longitude': float(location[0])})
            except (TypeError, ValueError):
                pass

    return {
        'distance_meters': float(route.get('distance') or 0),
        'duration_seconds': float(route.get('duration') or 0),
        'geometry': parsed_geometry,
        'snapped_stops': snapped_stops,
    }


def get_trip_route(
    session: Session,
    group_id: UUID,
    user_id: UUID,
    day_number: int | None = None,
) -> dict[str, Any]:
    _require_trip_access(session, group_id, user_id)
    trip = _get_trip(session, group_id)
    if trip is None:
        raise HTTPException(status_code=404, detail='Trip is not configured for this group.')

    if day_number is not None and day_number < 1:
        raise HTTPException(status_code=422, detail='Day number must be at least 1.')

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
            f'Add at least two stops to Day {day_number} before calculating a route.'
            if day_number is not None
            else 'Add at least two itinerary stops before calculating a route.'
        )
        raise HTTPException(status_code=422, detail=detail)

    missing = [stop.name for stop in stops if stop.latitude is None or stop.longitude is None]
    if missing:
        preview = ', '.join(missing[:3])
        suffix = '…' if len(missing) > 3 else ''
        raise HTTPException(
            status_code=422,
            detail=f'Add coordinates to every itinerary stop before calculating a route. Missing: {preview}{suffix}',
        )

    route_stops = [
        {
            'stop_id': str(stop.id),
            'sequence': stop.sequence,
            'day_number': stop.day_number,
            'latitude': float(stop.latitude),
            'longitude': float(stop.longitude),
            'name': stop.name,
            'stop_type': stop.stop_type,
        }
        for stop in stops
    ]
    coordinates = [(item['latitude'], item['longitude']) for item in route_stops]
    calculated = _request_route(_cache_key(coordinates))
    calculated['day_number'] = day_number
    for index, snapped in enumerate(calculated.get('snapped_stops', [])):
        if index < len(route_stops):
            snapped['stop_id'] = route_stops[index]['stop_id']
    calculated['stops'] = route_stops
    return calculated
