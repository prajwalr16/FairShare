import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Settlement(Base):
    __tablename__ = "settlements"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_settlements_amount_positive"),
        CheckConstraint("from_user_id <> to_user_id", name="ck_settlements_different_users"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(Uuid(), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True)
    from_user_id: Mapped[uuid.UUID] = mapped_column(Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    to_user_id: Mapped[uuid.UUID] = mapped_column(Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid(), ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
