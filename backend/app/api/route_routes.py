from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..core.database import get_read_db
from ..core.security import CurrentUser, get_current_user
from ..schemas.route import TripRouteResponse
from ..services.route_service import get_trip_route

route_router = APIRouter(prefix='/api/v1')


@route_router.get('/groups/{group_id}/trip/route', response_model=TripRouteResponse)
def trip_route(
    group_id: UUID,
    day: int | None = Query(default=None, ge=1, le=366),
    user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_read_db),
):
    return get_trip_route(session, group_id, user.id, day_number=day)
