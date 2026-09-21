from __future__ import annotations

from pydantic import BaseModel, Field


class PlaceSearchResult(BaseModel):
    place_id: str
    name: str
    display_name: str
    address: str | None = None
    latitude: float
    longitude: float
    category: str | None = None
    type: str | None = None


class PlaceSearchResponse(BaseModel):
    query: str
    results: list[PlaceSearchResult] = Field(default_factory=list)
    attribution: str = "© OpenStreetMap contributors"
