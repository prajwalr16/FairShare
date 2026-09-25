import uuid
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Group(Base):
    __tablename__ = "groups"
    __table_args__ = (
        CheckConstraint("type IN ('Trip', 'Home', 'Friends', 'Office', 'Other')", name="ck_groups_type"),
        CheckConstraint("length(currency) = 3", name="ck_groups_currency_length"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    type: Mapped[str] = mapped_column(String(30), nullable=False, default="Trip")
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    members = relationship("GroupMember", back_populates="group", cascade="all, delete-orphan")
