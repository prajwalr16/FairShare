from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Group, Trip, TripStop
from ..schemas.trip import TripCreate, TripStopCreate, TripStopUpdate, TripUpdate
from .permissions import get_group_and_role

TRIP_EDIT_ROLES = {"owner", "admin", "member"}


def _require_trip_access(
    session: Session,
    group_id: UUID,
    user_id: UUID,
    write: bool = False,
) -> tuple[Group, str]:
    group, role = get_group_and_role(session, group_id, user_id)
    if group.type != "Trip":
        raise HTTPException(
            status_code=409,
            detail="Journey planning is available only for Trip groups.",
        )
    if write and role not in TRIP_EDIT_ROLES:
        raise HTTPException(status_code=403, detail="Viewers cannot edit the trip itinerary.")
    return group, role


def _get_trip(session: Session, group_id: UUID) -> Trip | None:
    return session.scalar(select(Trip).where(Trip.group_id == group_id))


def _trip_day_count(trip: Trip) -> int | None:
    if trip.start_date is None or trip.end_date is None:
        return None
    return (trip.end_date - trip.start_date).days + 1


def _validate_day_number(trip: Trip, day_number: int) -> None:
    if day_number < 1:
        raise HTTPException(status_code=422, detail="Day number must be at least 1.")

    day_count = _trip_day_count(trip)
    if day_count is not None and day_number > day_count:
        raise HTTPException(
            status_code=422,
            detail=f"Day {day_number} is outside this trip's {day_count}-day date range.",
        )


def _serialize_stop(stop: TripStop) -> dict:
    return {
        "id": stop.id,
        "trip_id": stop.trip_id,
        "sequence": stop.sequence,
        "day_number": stop.day_number,
        "stop_type": stop.stop_type,
        "name": stop.name,
        "label": stop.label,
        "address": stop.address,
        "latitude": stop.latitude,
        "longitude": stop.longitude,
        "note": stop.note,
        "created_at": stop.created_at,
        "updated_at": stop.updated_at,
    }


def _serialize_trip(trip: Trip) -> dict:
    return {
        "id": trip.id,
        "group_id": trip.group_id,
        "start_date": trip.start_date,
        "end_date": trip.end_date,
        "timezone": trip.timezone,
        "notes": trip.notes,
        "created_at": trip.created_at,
        "updated_at": trip.updated_at,
        "stops": [
            _serialize_stop(stop)
            for stop in sorted(
                trip.stops,
                key=lambda item: (item.day_number, item.sequence),
            )
        ],
    }


def get_trip(session: Session, group_id: UUID, user_id: UUID) -> dict:
    _require_trip_access(session, group_id, user_id)
    trip = _get_trip(session, group_id)
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip is not configured for this group.")
    return _serialize_trip(trip)


def _apply_trip_dates(trip: Trip, payload: TripCreate | TripUpdate) -> None:
    if payload.start_date and payload.end_date and payload.end_date < payload.start_date:
        raise HTTPException(status_code=422, detail="End date cannot be before start date.")

    trip.start_date = payload.start_date
    trip.end_date = payload.end_date
    trip.timezone = payload.timezone
    trip.notes = payload.notes


def create_trip(session: Session, group_id: UUID, user_id: UUID, payload: TripCreate) -> dict:
    _require_trip_access(session, group_id, user_id, write=True)
    existing = _get_trip(session, group_id)
    if existing is not None:
        raise HTTPException(status_code=409, detail="Trip is already configured for this group.")

    trip = Trip(group_id=group_id)
    _apply_trip_dates(trip, payload)
    session.add(trip)
    session.commit()
    session.refresh(trip)
    return _serialize_trip(trip)


def update_trip(session: Session, group_id: UUID, user_id: UUID, payload: TripUpdate) -> dict:
    _require_trip_access(session, group_id, user_id, write=True)
    trip = _get_trip(session, group_id)
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip is not configured for this group.")

    if payload.start_date and payload.end_date and payload.end_date < payload.start_date:
        raise HTTPException(status_code=422, detail="End date cannot be before start date.")

    if payload.start_date and payload.end_date:
        new_day_count = (payload.end_date - payload.start_date).days + 1
        invalid_count = session.scalar(
            select(func.count(TripStop.id)).where(
                TripStop.trip_id == trip.id,
                TripStop.day_number > new_day_count,
            )
        )
        if int(invalid_count or 0) > 0:
            raise HTTPException(
                status_code=409,
                detail="Move itinerary stops to valid days before shortening the trip date range.",
            )

    _apply_trip_dates(trip, payload)
    session.commit()
    session.refresh(trip)
    return _serialize_trip(trip)


def delete_trip(session: Session, group_id: UUID, user_id: UUID) -> None:
    _require_trip_access(session, group_id, user_id, write=True)
    trip = _get_trip(session, group_id)
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip is not configured for this group.")
    session.delete(trip)
    session.commit()


def list_stops(session: Session, group_id: UUID, user_id: UUID) -> list[dict]:
    _require_trip_access(session, group_id, user_id)
    trip = _get_trip(session, group_id)
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip is not configured for this group.")
    return _serialize_trip(trip)["stops"]


def add_stop(session: Session, group_id: UUID, user_id: UUID, payload: TripStopCreate) -> dict:
    _require_trip_access(session, group_id, user_id, write=True)
    trip = _get_trip(session, group_id)
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip is not configured for this group.")

    _validate_day_number(trip, payload.day_number)

    if payload.stop_type in {"start", "destination"}:
        already_exists = session.scalar(
            select(TripStop.id).where(
                TripStop.trip_id == trip.id,
                TripStop.stop_type == payload.stop_type,
            )
        )
        if already_exists is not None:
            raise HTTPException(status_code=409, detail=f"A {payload.stop_type} stop already exists.")

    next_sequence = session.scalar(
        select(func.coalesce(func.max(TripStop.sequence), -1) + 1).where(TripStop.trip_id == trip.id)
    )
    stop = TripStop(
        trip_id=trip.id,
        sequence=int(next_sequence or 0),
        day_number=payload.day_number,
        stop_type=payload.stop_type,
        name=payload.name,
        label=payload.label,
        address=payload.address,
        latitude=payload.latitude,
        longitude=payload.longitude,
        note=payload.note,
    )
    session.add(stop)
    session.commit()
    session.refresh(stop)
    return _serialize_stop(stop)


def update_stop(
    session: Session,
    group_id: UUID,
    user_id: UUID,
    stop_id: UUID,
    payload: TripStopUpdate,
) -> dict:
    _require_trip_access(session, group_id, user_id, write=True)
    trip = _get_trip(session, group_id)
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip is not configured for this group.")

    _validate_day_number(trip, payload.day_number)

    stop = session.scalar(
        select(TripStop).where(
            TripStop.id == stop_id,
            TripStop.trip_id == trip.id,
        )
    )
    if stop is None:
        raise HTTPException(status_code=404, detail="Trip stop not found.")

    if payload.stop_type in {"start", "destination"} and payload.stop_type != stop.stop_type:
        already_exists = session.scalar(
            select(TripStop.id).where(
                TripStop.trip_id == trip.id,
                TripStop.stop_type == payload.stop_type,
                TripStop.id != stop.id,
            )
        )
        if already_exists is not None:
            raise HTTPException(status_code=409, detail=f"A {payload.stop_type} stop already exists.")

    stop.day_number = payload.day_number
    stop.stop_type = payload.stop_type
    stop.name = payload.name
    stop.label = payload.label
    stop.address = payload.address
    stop.latitude = payload.latitude
    stop.longitude = payload.longitude
    stop.note = payload.note
    session.commit()
    session.refresh(stop)
    return _serialize_stop(stop)


def delete_stop(session: Session, group_id: UUID, user_id: UUID, stop_id: UUID) -> None:
    _require_trip_access(session, group_id, user_id, write=True)
    trip = _get_trip(session, group_id)
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip is not configured for this group.")

    stop = session.scalar(
        select(TripStop).where(
            TripStop.id == stop_id,
            TripStop.trip_id == trip.id,
        )
    )
    if stop is None:
        raise HTTPException(status_code=404, detail="Trip stop not found.")

    session.delete(stop)
    session.flush()

    remaining = list(
        session.scalars(
            select(TripStop)
            .where(TripStop.trip_id == trip.id)
            .order_by(TripStop.day_number.asc(), TripStop.sequence.asc())
        )
    )

    # The (trip_id, sequence) unique constraint means we cannot renumber
    # rows directly from e.g. [0, 2] -> [0, 1] on SQLite: row 2 would
    # temporarily collide with the existing row at sequence 1 if the
    # deleted row had sequence 1. Move all rows into a disjoint temporary
    # range first, then assign their final contiguous sequence values.
    for offset, item in enumerate(remaining):
        item.sequence = 1_000_000 + offset
    session.flush()

    for index, item in enumerate(remaining):
        item.sequence = index

    session.commit()


def reorder_stops(session: Session, group_id: UUID, user_id: UUID, stop_ids: list[UUID]) -> list[dict]:
    _require_trip_access(session, group_id, user_id, write=True)
    trip = _get_trip(session, group_id)
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip is not configured for this group.")

    stops = list(session.scalars(select(TripStop).where(TripStop.trip_id == trip.id)))
    actual_ids = {item.id for item in stops}
    requested_ids = set(stop_ids)
    if actual_ids != requested_ids or len(stop_ids) != len(stops):
        raise HTTPException(status_code=400, detail="Reorder must include every stop exactly once.")

    for offset, item in enumerate(stops):
        item.sequence = 1000000 + offset
    session.flush()

    by_id = {item.id: item for item in stops}
    for sequence, stop_id in enumerate(stop_ids):
        by_id[stop_id].sequence = sequence
    session.commit()

    ordered = list(
        session.scalars(
            select(TripStop)
            .where(TripStop.trip_id == trip.id)
            .order_by(TripStop.day_number.asc(), TripStop.sequence.asc())
        )
    )
    return [_serialize_stop(item) for item in ordered]
