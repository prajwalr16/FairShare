from decimal import Decimal
from uuid import UUID

from .common import APIModel


class BalanceResponse(APIModel):
    user_id: UUID
    full_name: str | None
    email: str | None
    role: str
    total_paid: Decimal
    total_owed: Decimal
    net_balance: Decimal


class DebtRelationship(APIModel):
    from_user_id: UUID
    to_user_id: UUID
    from_name: str
    to_name: str
    amount: Decimal
