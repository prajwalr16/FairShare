from __future__ import annotations

from pydantic import BaseModel, Field


class PlaceSearchResult(BaseModel):
    place_id: str
    name: str
    display_name: str
    subtitle: str | None = None
    address: str | None = None
    latitude: float
    longitude: float
    category: str | None = None
    type: str | None = None
    icon_type: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    match_type: str = "exact"


class PlaceSearchResponse(BaseModel):
    query: str
    did_you_mean: str | None = None
    results: list[PlaceSearchResult] = Field(default_factory=list)
    attribution: str = "© OpenStreetMap contributors"

