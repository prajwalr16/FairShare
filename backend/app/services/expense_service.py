from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Expense, ExpenseSplit, GroupMember, User
from ..repositories.expense_repository import delete_splits, get_expense, list_expenses, list_splits
from ..schemas.expense import SUPPORTED_EXPENSE_CATEGORIES
from .permissions import get_group_and_role, require_permission
from .split_calculator import SplitInput, calculate_splits, q2, validate_split


def _split_inputs(entries) -> list[SplitInput]:
    return [SplitInput(str(item.user_id), Decimal(item.value)) for item in entries]


def _validate_participants(session: Session, group_id: UUID, paid_by: UUID, entries: list[SplitInput]) -> None:
    ids = {UUID(item.user_id) for item in entries}
    ids.add(paid_by)
    members = session.scalars(select(GroupMember).where(
        GroupMember.group_id == group_id,
        GroupMember.status == "active",
        GroupMember.user_id.in_(ids),
    )).all()
    active_ids = {item.user_id for item in members if item.user_id}
    missing = ids - active_ids
    if missing:
        raise HTTPException(status_code=400, detail="All payers and split participants must be active group members.")


def create_expense(session: Session, group_id: UUID, title: str, amount: Decimal, paid_by: UUID, split_type: str, category: str, entries, caller: User) -> Expense:
    group, role = get_group_and_role(session, group_id, caller.id)
    require_permission(role, "money", "Viewers cannot create expenses.")
    clean_title = title.strip()
    if not clean_title:
        raise HTTPException(status_code=400, detail="Expense title is required.")
    amount = q2(Decimal(amount))
    category = category.strip().title()
    if category not in SUPPORTED_EXPENSE_CATEGORIES:
        raise HTTPException(status_code=400, detail="Unsupported expense category.")
    inputs = _split_inputs(entries)
    error = validate_split(split_type, amount, inputs)
    if error:
        raise HTTPException(status_code=400, detail=error)
    _validate_participants(session, group_id, paid_by, inputs)
    try:
        calculated = calculate_splits(split_type, amount, inputs)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if sum((item.amount for item in calculated), Decimal("0")) != amount:
        raise HTTPException(status_code=400, detail="Split amounts must equal the expense total.")

    expense = Expense(group_id=group.id, title=clean_title, amount=amount, paid_by=paid_by, split_type=split_type.strip().capitalize(), category=category)
    session.add(expense)
    session.flush()
    for item in calculated:
        session.add(ExpenseSplit(expense_id=expense.id, user_id=UUID(item.user_id), amount=q2(item.amount)))
    session.commit()
    session.refresh(expense)
    return expense


def list_group_expenses(
    session: Session,
    group_id: UUID,
    caller: User,
    limit: int | None = None,
    category: str | None = None,
    scope: str = "all",
) -> list[Expense]:
    get_group_and_role(session, group_id, caller.id)
    if scope not in {"all", "mine"}:
        raise HTTPException(status_code=400, detail="Invalid expense scope.")
    if category and category != "All" and category not in SUPPORTED_EXPENSE_CATEGORIES:
        raise HTTPException(status_code=400, detail="Unsupported expense category.")
    return list_expenses(session, group_id, limit, category, scope, caller.id)


def get_details(session: Session, expense_id: UUID, caller: User) -> tuple[Expense, list[ExpenseSplit]]:
    expense = get_expense(session, expense_id)
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found.")
    get_group_and_role(session, expense.group_id, caller.id)
    return expense, session.scalars(select(ExpenseSplit).where(ExpenseSplit.expense_id == expense.id).order_by(ExpenseSplit.created_at.asc())).all()


def update_expense(session: Session, expense_id: UUID, title: str, amount: Decimal, paid_by: UUID, split_type: str, category: str, entries, caller: User) -> Expense:
    expense = get_expense(session, expense_id)
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found.")
    _, role = get_group_and_role(session, expense.group_id, caller.id)
    require_permission(role, "money", "Viewers cannot edit expenses.")
    clean_title = title.strip()
    if not clean_title:
        raise HTTPException(status_code=400, detail="Expense title is required.")
    amount = q2(Decimal(amount))
    category = category.strip().title()
    if category not in SUPPORTED_EXPENSE_CATEGORIES:
        raise HTTPException(status_code=400, detail="Unsupported expense category.")
    inputs = _split_inputs(entries)
    error = validate_split(split_type, amount, inputs)
    if error:
        raise HTTPException(status_code=400, detail=error)
    _validate_participants(session, expense.group_id, paid_by, inputs)
    calculated = calculate_splits(split_type, amount, inputs)
    if sum((item.amount for item in calculated), Decimal("0")) != amount:
        raise HTTPException(status_code=400, detail="Split amounts must equal the expense total.")

    expense.title = clean_title
    expense.amount = amount
    expense.paid_by = paid_by
    expense.split_type = split_type.strip().capitalize()
    expense.category = category
    delete_splits(session, expense.id)
    for item in calculated:
        session.add(ExpenseSplit(expense_id=expense.id, user_id=UUID(item.user_id), amount=q2(item.amount)))
    session.commit()
    session.refresh(expense)
    return expense


def delete_expense(session: Session, expense_id: UUID, caller: User) -> None:
    expense = get_expense(session, expense_id)
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found.")
    _, role = get_group_and_role(session, expense.group_id, caller.id)
    require_permission(role, "money", "Viewers cannot delete expenses.")
    session.delete(expense)
    session.commit()