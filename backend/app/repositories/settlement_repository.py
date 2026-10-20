from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Settlement, User


def _enrich_settlements(session: Session, settlements: list[Settlement]) -> list[Settlement]:
    if not settlements:
        return settlements
    user_ids = {s.from_user_id for s in settlements} | {s.to_user_id for s in settlements}
    users = session.scalars(select(User).where(User.id.in_(user_ids))).all()
    user_map = {u.id: (u.full_name or u.email or "Member") for u in users}
    for s in settlements:
        s.from_name = user_map.get(s.from_user_id, "Member")
        s.to_name = user_map.get(s.to_user_id, "Member")
    return settlements


def get_settlement(session: Session, group_id: UUID, settlement_id: UUID) -> Settlement | None:
    settlement = session.scalar(
        select(Settlement).where(
            Settlement.id == settlement_id,
            Settlement.group_id == group_id,
        )
    )
    if settlement is not None:
        _enrich_settlements(session, [settlement])
    return settlement


def list_settlements(session: Session, group_id: UUID, limit: int | None = None) -> list[Settlement]:
    statement = select(Settlement).where(Settlement.group_id == group_id).order_by(Settlement.created_at.desc())
    if limit is not None:
        statement = statement.limit(limit)
    settlements = list(session.scalars(statement).all())
    return _enrich_settlements(session, settlements)
