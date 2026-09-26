import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Uuid,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Expense(Base):
    __tablename__ = "expenses"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_expenses_amount_positive"),
        CheckConstraint(
            "split_type IN ('Equal', 'Exact', 'Percentage', 'Shares')",
            name="ck_expenses_split_type",
        ),
        CheckConstraint(
            "category IN ('Food', 'Fuel', 'Stay', 'Transport', 'Activities', 'Shopping', 'Bills', 'Other')",
            name="ck_expenses_category",
        ),
        Index("ix_expenses_group_location", "group_id", "journey_stop_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    split_type: Mapped[str] = mapped_column(String(20), nullable=False, default="Equal")
    category: Mapped[str] = mapped_column(String(30), nullable=False, default="Other", index=True)
    paid_by: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Optional expense location.
    # journey_stop_id links back to a Journey place when one was selected.
    # location_name is always retained so deleting a Journey stop does not
    # erase the historical location shown on an expense.
    location_name: Mapped[str | None] = mapped_column(String(200))
    journey_stop_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(),
        ForeignKey("trip_stops.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    latitude: Mapped[float | None] = mapped_column()
    longitude: Mapped[float | None] = mapped_column()

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    splits = relationship("ExpenseSplit", back_populates="expense", cascade="all, delete-orphan")


class ExpenseSplit(Base):
    __tablename__ = "expense_splits"
    __table_args__ = (
        UniqueConstraint("expense_id", "user_id", name="uq_expense_splits_expense_user"),
        CheckConstraint("amount >= 0", name="ck_expense_splits_amount_nonnegative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    expense_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("expenses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    expense = relationship("Expense", back_populates="splits")
