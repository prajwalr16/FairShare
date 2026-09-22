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
    stop_type: Literal["start", "stop", "destination"]


class RouteGeometryPoint(BaseModel):
    latitude: float
    longitude: float


class RouteSnappedStop(BaseModel):
    stop_id: UUID
    latitude: float
    longitude: float


class RouteLeg(BaseModel):
    from_stop_id: str
    to_stop_id: str
    distance_meters: float = Field(default=0.0, ge=0)
    duration_seconds: float = Field(default=0.0, ge=0)
    points: list[RouteGeometryPoint] = Field(min_length=2)
    routed: bool = True
    fallback: bool = False


class TripRouteResponse(BaseModel):
    day_number: int | None = None
    distance_meters: float = Field(ge=0)
    duration_seconds: float = Field(ge=0)
    stops: list[RoutePoint]
    geometry: list[RouteGeometryPoint] = Field(min_length=2)
    snapped_stops: list[RouteSnappedStop] = Field(default_factory=list)
    legs: list[RouteLeg] = Field(default_factory=list)
    has_fallback_legs: bool = False
    has_non_routed_legs: bool = False
    warning: str | None = None
