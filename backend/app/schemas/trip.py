from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from .common import APIModel

TripStopType = Literal["start", "stop", "destination"]


class TripCreate(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    timezone: str | None = Field(default=None, max_length=64)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("timezone")
    @classmethod
    def clean_timezone(cls, value: str | None) -> str | None:
        value = value.strip() if value else None
        return value or None

    @field_validator("notes")
    @classmethod
    def clean_notes(cls, value: str | None) -> str | None:
        value = value.strip() if value else None
        return value or None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("End date cannot be before start date.")
        return self


class TripUpdate(TripCreate):
    pass


class TripStopCreate(BaseModel):
    stop_type: TripStopType = "stop"
    day_number: int = Field(default=1, ge=1, le=366)
    name: str = Field(min_length=1, max_length=120)
    label: str | None = Field(default=None, max_length=120)
    address: str | None = Field(default=None, max_length=300)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    note: str | None = Field(default=None, max_length=1000)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Stop name is required.")
        return value

    @field_validator("label", "address", "note")
    @classmethod
    def clean_optional_text(cls, value: str | None) -> str | None:
        value = value.strip() if value else None
        return value or None

    @model_validator(mode="after")
    def validate_coordinates(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Latitude and longitude must be provided together.")
        return self


class TripStopUpdate(TripStopCreate):
    pass


class TripStopResponse(APIModel):
    id: UUID
    trip_id: UUID
    sequence: int
    day_number: int
    stop_type: TripStopType
    name: str
    label: str | None
    address: str | None
    latitude: float | None
    longitude: float | None
    note: str | None
    created_at: datetime
    updated_at: datetime


class TripResponse(APIModel):
    id: UUID
    group_id: UUID
    start_date: date | None
    end_date: date | None
    timezone: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    stops: list[TripStopResponse]


class TripStopReorder(BaseModel):
    stop_ids: list[UUID] = Field(min_length=1)

    @field_validator("stop_ids")
    @classmethod
    def unique_stop_ids(cls, value: list[UUID]) -> list[UUID]:
        if len(value) != len(set(value)):
            raise ValueError("Stop IDs must be unique.")
        return value
