from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from ..models import Expense, ExpenseSplit, Group, GroupMember, User
from ..repositories.expense_repository import delete_splits, get_expense, list_expenses
from ..schemas.expense import SUPPORTED_EXPENSE_CATEGORIES
from .permissions import get_group_and_role, require_permission
from .split_calculator import SplitInput, calculate_splits, q2, validate_split


def _split_inputs(entries) -> list[SplitInput]:
    return [SplitInput(str(item.user_id), Decimal(item.value)) for item in entries]


def _validate_participants(session: Session, group_id: UUID, paid_by: UUID, entries: list[SplitInput]) -> None:
    ids = {UUID(item.user_id) for item in entries}
    ids.add(paid_by)
    members = session.scalars(select(GroupMember.user_id).where(
        GroupMember.group_id == group_id,
        GroupMember.status == "active",
        GroupMember.user_id.in_(ids),
    )).all()
    active_ids = {item for item in members if item}
    if missing := ids - active_ids:
        raise HTTPException(status_code=400, detail="All payers and split participants must be active group members.")


def _calculate_and_validate(amount: Decimal, split_type: str, entries) -> list:
    amount = q2(Decimal(amount))
    inputs = _split_inputs(entries)
    error = validate_split(split_type, amount, inputs)
    if error:
        raise HTTPException(status_code=400, detail=error)
    try:
        calculated = calculate_splits(split_type, amount, inputs)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if sum((item.amount for item in calculated), Decimal("0")) != amount:
        raise HTTPException(status_code=400, detail="Split amounts must equal the expense total.")
    return calculated


def create_expense(session: Session, group_id: UUID, title: str, amount: Decimal, paid_by: UUID, split_type: str, category: str, entries, caller: User) -> Expense:
    group, role = get_group_and_role(session, group_id, caller.id)
    require_permission(role, "money", "Viewers cannot create expenses.")
    clean_title = title.strip()
    if not clean_title:
        raise HTTPException(status_code=400, detail="Expense title is required.")
    clean_category = category.strip().title()
    if clean_category not in SUPPORTED_EXPENSE_CATEGORIES:
        raise HTTPException(status_code=400, detail="Unsupported expense category.")
    inputs = _split_inputs(entries)
    error = validate_split(split_type, q2(Decimal(amount)), inputs)
    if error:
        raise HTTPException(status_code=400, detail=error)
    _validate_participants(session, group_id, paid_by, inputs)
    calculated = _calculate_and_validate(amount, split_type, entries)

    expense = Expense(
        group_id=group.id,
        title=clean_title,
        amount=q2(Decimal(amount)),
        paid_by=paid_by,
        split_type=split_type.strip().capitalize(),
        category=clean_category,
    )
    session.add(expense)
    session.flush()
    session.add_all([
        ExpenseSplit(expense_id=expense.id, user_id=UUID(item.user_id), amount=q2(item.amount))
        for item in calculated
    ])
    session.commit()
    return expense


def list_group_expenses(session: Session, group_id: UUID, user_id: UUID, limit: int | None = None, category: str | None = None, scope: str = "all") -> list[Expense]:
    get_group_and_role(session, group_id, user_id)
    if scope not in {"all", "mine"}:
        raise HTTPException(status_code=400, detail="Invalid expense scope.")
    if category and category != "All" and category not in SUPPORTED_EXPENSE_CATEGORIES:
        raise HTTPException(status_code=400, detail="Unsupported expense category.")
    return list_expenses(session, group_id, limit, category, scope, user_id)


def get_details(session: Session, expense_id: UUID, user_id: UUID) -> tuple[Expense, list[ExpenseSplit]]:
    member_join = and_(
        GroupMember.group_id == Group.id,
        GroupMember.user_id == user_id,
        GroupMember.status == "active",
    )
    row = session.execute(
        select(Expense, GroupMember.role, Group.owner_id)
        .join(Group, Group.id == Expense.group_id)
        .outerjoin(GroupMember, member_join)
        .where(
            Expense.id == expense_id,
            (Group.owner_id == user_id) | GroupMember.id.is_not(None),
        )
    ).first()
    if row is None:
        if session.get(Expense, expense_id) is None:
            raise HTTPException(status_code=404, detail="Expense not found.")
        raise HTTPException(status_code=403, detail="You are not an active member of this group.")

    expense = row[0]
    splits = list(session.scalars(
        select(ExpenseSplit)
        .where(ExpenseSplit.expense_id == expense.id)
        .order_by(ExpenseSplit.created_at.asc())
    ).all())
    return expense, splits


def update_expense(session: Session, expense_id: UUID, title: str, amount: Decimal, paid_by: UUID, split_type: str, category: str, entries, caller_id: UUID) -> Expense:
    clean_title = title.strip()
    if not clean_title:
        raise HTTPException(status_code=400, detail="Expense title is required.")
    clean_category = category.strip().title()
    if clean_category not in SUPPORTED_EXPENSE_CATEGORIES:
        raise HTTPException(status_code=400, detail="Unsupported expense category.")

    inputs = _split_inputs(entries)
    amount = q2(Decimal(amount))
    error = validate_split(split_type, amount, inputs)
    if error:
        raise HTTPException(status_code=400, detail=error)
    try:
        calculated = calculate_splits(split_type, amount, inputs)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if sum((item.amount for item in calculated), Decimal("0")) != amount:
        raise HTTPException(status_code=400, detail="Split amounts must equal the expense total.")

    participant_ids = {UUID(item.user_id) for item in inputs}
    participant_ids.add(paid_by)
    participant_ids.add(caller_id)

    # One query loads the expense/group and all relevant active memberships,
    # replacing separate authorization and participant-validation queries.
    member_join = and_(
        GroupMember.group_id == Group.id,
        GroupMember.status == "active",
        GroupMember.user_id.in_(participant_ids),
    )
    rows = session.execute(
        select(Expense, Group, GroupMember.user_id, GroupMember.role)
        .join(Group, Group.id == Expense.group_id)
        .outerjoin(GroupMember, member_join)
        .where(Expense.id == expense_id)
    ).all()
    if not rows:
        raise HTTPException(status_code=404, detail="Expense not found.")

    expense, group, _, _ = rows[0]
    membership_roles = {user_id: role for _, _, user_id, role in rows if user_id}
    caller_role = "owner" if group.owner_id == caller_id else membership_roles.get(caller_id)
    if caller_role is None:
        raise HTTPException(status_code=403, detail="You are not an active member of this group.")
    require_permission(caller_role, "money", "Viewers cannot edit expenses.")

    required_participants = participant_ids - {caller_id}
    missing = required_participants - set(membership_roles)
    if missing:
        raise HTTPException(status_code=400, detail="All payers and split participants must be active group members.")
    # If the caller is also a participant, they were checked above.
    if caller_id not in membership_roles and group.owner_id != caller_id:
        raise HTTPException(status_code=403, detail="You are not an active member of this group.")

    expense.title = clean_title
    expense.amount = amount
    expense.paid_by = paid_by
    expense.split_type = split_type.strip().capitalize()
    expense.category = clean_category
    delete_splits(session, expense.id)
    session.add_all([
        ExpenseSplit(expense_id=expense.id, user_id=UUID(item.user_id), amount=q2(item.amount))
        for item in calculated
    ])
    session.commit()
    return expense


def delete_expense(session: Session, expense_id: UUID, caller_id: UUID) -> None:
    expense = get_expense(session, expense_id)
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found.")
    _, role = get_group_and_role(session, expense.group_id, caller_id)
    require_permission(role, "money", "Viewers cannot delete expenses.")
    session.delete(expense)
    session.commit()
