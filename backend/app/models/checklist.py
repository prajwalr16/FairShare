import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TripChecklist(Base):
    __tablename__ = "trip_checklists"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="General")
    scope: Mapped[str] = mapped_column(String(20), nullable=False, default="personal")  # 'personal' | 'group'
    is_private: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    is_packed_group: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    user_statuses = relationship("TripChecklistUserStatus", back_populates="checklist", cascade="all, delete-orphan")


class TripChecklistUserStatus(Base):
    __tablename__ = "trip_checklist_user_status"
    __table_args__ = (
        UniqueConstraint("checklist_id", "user_id", name="uq_checklist_user_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    checklist_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("trip_checklists.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    is_packed: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    packed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    checklist = relationship("TripChecklist", back_populates="user_statuses")
