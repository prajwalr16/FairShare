from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..models import Expense, ExpenseSplit


def get_expense(session: Session, expense_id: UUID) -> Expense | None:
    return session.get(Expense, expense_id)


def list_expenses(session: Session, group_id: UUID, limit: int | None = None) -> list[Expense]:
    statement = select(Expense).where(Expense.group_id == group_id).order_by(Expense.created_at.desc())
    if limit is not None:
        statement = statement.limit(limit)
    return list(session.scalars(statement).all())


def list_splits(session: Session, expense_ids: list[UUID]) -> list[ExpenseSplit]:
    if not expense_ids:
        return []
    return list(
        session.scalars(
            select(ExpenseSplit)
            .where(ExpenseSplit.expense_id.in_(expense_ids))
            .order_by(ExpenseSplit.created_at.asc())
        ).all()
    )


def delete_splits(session: Session, expense_id: UUID) -> None:
    session.execute(delete(ExpenseSplit).where(ExpenseSplit.expense_id == expense_id))
