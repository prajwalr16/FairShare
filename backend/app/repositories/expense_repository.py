from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete, exists, select
from sqlalchemy.orm import Session

from ..models import Expense, ExpenseSplit


def get_expense(session: Session, expense_id: UUID) -> Expense | None:
    return session.get(Expense, expense_id)


def list_expenses(
    session: Session,
    group_id: UUID,
    limit: int | None = None,
    category: str | None = None,
    scope: str = "all",
    current_user_id: UUID | None = None,
) -> list[Expense]:
    statement = select(Expense).where(Expense.group_id == group_id)

    if category and category != "All":
        statement = statement.where(Expense.category == category)

    if scope == "mine" and current_user_id is not None:
        statement = statement.where(
            (Expense.paid_by == current_user_id)
            | exists(
                select(ExpenseSplit.id).where(
                    ExpenseSplit.expense_id == Expense.id,
                    ExpenseSplit.user_id == current_user_id,
                )
            )
        )

    statement = statement.order_by(Expense.created_at.desc())
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