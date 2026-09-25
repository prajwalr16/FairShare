from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from .common import APIModel


class SettlementCreate(BaseModel):
    from_user_id: UUID
    to_user_id: UUID
    amount: Decimal = Field(gt=0)
    note: str | None = Field(default=None, max_length=500)


class SettlementUpdate(BaseModel):
    amount: Decimal = Field(gt=0)
    note: str | None = Field(default=None, max_length=500)


class SettlementResponse(APIModel):
    id: UUID
    group_id: UUID
    from_user_id: UUID
    to_user_id: UUID
    amount: Decimal
    note: str | None
    created_by: UUID | None
    created_at: datetime
