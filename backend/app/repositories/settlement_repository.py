from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Settlement


def get_settlement(session: Session, group_id: UUID, settlement_id: UUID) -> Settlement | None:
    return session.scalar(
        select(Settlement).where(
            Settlement.id == settlement_id,
            Settlement.group_id == group_id,
        )
    )


def list_settlements(session: Session, group_id: UUID, limit: int | None = None) -> list[Settlement]:
    statement = select(Settlement).where(Settlement.group_id == group_id).order_by(Settlement.created_at.desc())
    if limit is not None:
        statement = statement.limit(limit)
    return list(session.scalars(statement).all())
