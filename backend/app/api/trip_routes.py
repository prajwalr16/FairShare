from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..core.database import get_db, get_read_db
from ..core.security import CurrentUser, get_current_user
from ..schemas.trip import (
    TripCreate,
    TripResponse,
    TripStopCreate,
    TripStopReorder,
    TripStopResponse,
    TripStopUpdate,
    TripUpdate,
)
from ..services.trip_service import (
    add_stop,
    create_trip,
    delete_stop,
    delete_trip,
    get_trip,
    list_stops,
    reorder_stops,
    update_stop,
    update_trip,
)

trip_router = APIRouter(prefix="/api/v1")


@trip_router.get("/groups/{group_id}/trip", response_model=TripResponse)
def get_trip_route(
    group_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_read_db),
):
    return get_trip(session, group_id, user.id)


@trip_router.post("/groups/{group_id}/trip", response_model=TripResponse, status_code=status.HTTP_201_CREATED)
def create_trip_route(
    group_id: UUID,
    payload: TripCreate,
    user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    return create_trip(session, group_id, user.id, payload)


@trip_router.patch("/groups/{group_id}/trip", response_model=TripResponse)
def update_trip_route(
    group_id: UUID,
    payload: TripUpdate,
    user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    return update_trip(session, group_id, user.id, payload)


@trip_router.delete("/groups/{group_id}/trip", status_code=status.HTTP_204_NO_CONTENT)
def delete_trip_route(
    group_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    delete_trip(session, group_id, user.id)
    return None


@trip_router.get("/groups/{group_id}/trip/stops", response_model=list[TripStopResponse])
def list_trip_stops_route(
    group_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_read_db),
):
    return list_stops(session, group_id, user.id)


@trip_router.post("/groups/{group_id}/trip/stops", response_model=TripStopResponse, status_code=status.HTTP_201_CREATED)
def add_trip_stop_route(
    group_id: UUID,
    payload: TripStopCreate,
    user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    return add_stop(session, group_id, user.id, payload)


@trip_router.patch("/groups/{group_id}/trip/stops/{stop_id}", response_model=TripStopResponse)
def update_trip_stop_route(
    group_id: UUID,
    stop_id: UUID,
    payload: TripStopUpdate,
    user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    return update_stop(session, group_id, user.id, stop_id, payload)


@trip_router.delete("/groups/{group_id}/trip/stops/{stop_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trip_stop_route(
    group_id: UUID,
    stop_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    delete_stop(session, group_id, user.id, stop_id)
    return None


@trip_router.put("/groups/{group_id}/trip/stops/reorder", response_model=list[TripStopResponse])
def reorder_trip_stops_route(
    group_id: UUID,
    payload: TripStopReorder,
    user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    return reorder_stops(session, group_id, user.id, payload.stop_ids)
