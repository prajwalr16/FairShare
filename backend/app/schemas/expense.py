from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from .common import APIModel

SUPPORTED_EXPENSE_CATEGORIES = {
    "Food", "Fuel", "Stay", "Transport", "Activities", "Shopping", "Bills", "Other"
}


class SplitEntry(BaseModel):
    user_id: UUID
    value: Decimal = Field(ge=0)


class ExpenseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    amount: Decimal = Field(gt=0)
    paid_by: UUID
    split_type: str = "Equal"
    category: str = "Other"
    splits: list[SplitEntry] = Field(min_length=1)

    # Optional location.
    location_name: str | None = Field(default=None, max_length=200)
    journey_stop_id: UUID | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Expense title is required.")
        return value

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: Decimal) -> Decimal:
        if value != value.quantize(Decimal("0.01")):
            raise ValueError("Expense amount supports up to 2 decimal places.")
        return value

    @field_validator("split_type")
    @classmethod
    def normalize_split_type(cls, value: str) -> str:
        normalized = value.strip().capitalize()
        if normalized not in {"Equal", "Exact", "Percentage", "Shares"}:
            raise ValueError("Unsupported split type.")
        return normalized

    @field_validator("category")
    @classmethod
    def normalize_category(cls, value: str) -> str:
        normalized = value.strip().title()
        if normalized not in SUPPORTED_EXPENSE_CATEGORIES:
            raise ValueError("Unsupported expense category.")
        return normalized

    @field_validator("location_name")
    @classmethod
    def clean_location_name(cls, value: str | None) -> str | None:
        value = value.strip() if value else None
        return value or None

    @model_validator(mode="after")
    def validate_location_coordinates(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Latitude and longitude must be provided together.")
        return self


class ExpenseSummary(APIModel):
    id: UUID
    group_id: UUID
    title: str
    amount: Decimal
    split_type: str
    category: str
    paid_by: UUID
    location_name: str | None = None
    journey_stop_id: UUID | None = None
    latitude: float | None = None
    longitude: float | None = None
    created_at: datetime


class ExpenseSplitResponse(APIModel):
    id: UUID
    expense_id: UUID
    user_id: UUID
    amount: Decimal
    created_at: datetime


class ExpenseDetails(APIModel):
    expense: ExpenseSummary
    splits: list[ExpenseSplitResponse]
