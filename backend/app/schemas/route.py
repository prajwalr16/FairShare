from typing import Literal

from uuid import UUID

from pydantic import BaseModel, Field


class RoutePoint(BaseModel):
    stop_id: str
    sequence: int
    day_number: int
    latitude: float
    longitude: float
    name: str
    stop_type: Literal['start', 'stop', 'destination']


class RouteGeometryPoint(BaseModel):
    latitude: float
    longitude: float


class RouteSnappedStop(BaseModel):
    stop_id: UUID
    latitude: float
    longitude: float


class TripRouteResponse(BaseModel):
    day_number: int | None = None
    distance_meters: float = Field(ge=0)
    duration_seconds: float = Field(ge=0)
    stops: list[RoutePoint]
    geometry: list[RouteGeometryPoint] = Field(min_length=2)
    snapped_stops: list[RouteSnappedStop] = Field(default_factory=list)
