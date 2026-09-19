from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from .common import APIModel


class SplitEntry(BaseModel):
    user_id: UUID
    value: Decimal = Field(ge=0)


class ExpenseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    amount: Decimal = Field(gt=0)
    paid_by: UUID
    split_type: str = "Equal"
    splits: list[SplitEntry] = Field(min_length=1)

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


class ExpenseSummary(APIModel):
    id: UUID
    group_id: UUID
    title: str
    amount: Decimal
    split_type: str
    paid_by: UUID
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
