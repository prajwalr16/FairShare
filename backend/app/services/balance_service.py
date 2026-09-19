from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Expense, ExpenseSplit, GroupMember, Settlement, User
from .permissions import get_group_and_role

CENT = Decimal("0.01")
EPSILON = Decimal("0.005")


def money(value: Decimal | int | float | None) -> Decimal:
    return Decimal(value or 0).quantize(CENT)


def _financial_user_ids(session: Session, group_id: UUID) -> set[UUID]:
    ids: set[UUID] = set()
    expenses = session.scalars(select(Expense).where(Expense.group_id == group_id)).all()
    for expense in expenses:
        ids.add(expense.paid_by)
    if expenses:
        splits = session.scalars(select(ExpenseSplit).where(ExpenseSplit.expense_id.in_([e.id for e in expenses]))).all()
        ids.update(split.user_id for split in splits)
    settlements = session.scalars(select(Settlement).where(Settlement.group_id == group_id)).all()
    for settlement in settlements:
        ids.add(settlement.from_user_id)
        ids.add(settlement.to_user_id)
        if settlement.created_by:
            ids.add(settlement.created_by)
    return ids


def compute_balances(
    session: Session,
    group_id: UUID,
    current_user_id: UUID | None = None,
    exclude_settlement_id: UUID | None = None,
) -> list[dict]:
    get_group_and_role(session, group_id, current_user_id) if current_user_id else None

    expenses = session.scalars(select(Expense).where(Expense.group_id == group_id)).all()
    expense_ids = [item.id for item in expenses]
    splits = session.scalars(select(ExpenseSplit).where(ExpenseSplit.expense_id.in_(expense_ids))).all() if expense_ids else []
    settlement_query = select(Settlement).where(Settlement.group_id == group_id)
    if exclude_settlement_id:
        settlement_query = settlement_query.where(Settlement.id != exclude_settlement_id)
    settlements = session.scalars(settlement_query).all()

    totals: dict[UUID, dict[str, Decimal]] = defaultdict(lambda: {"paid": Decimal("0"), "owed": Decimal("0"), "sent": Decimal("0"), "received": Decimal("0")})
    for expense in expenses:
        totals[expense.paid_by]["paid"] += money(expense.amount)
    for split in splits:
        totals[split.user_id]["owed"] += money(split.amount)
    for settlement in settlements:
        totals[settlement.from_user_id]["sent"] += money(settlement.amount)
        totals[settlement.to_user_id]["received"] += money(settlement.amount)

    members = session.scalars(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.status == "active")).all()
    member_ids = {member.user_id for member in members if member.user_id}
    user_ids = member_ids | _financial_user_ids(session, group_id)
    users = {user.id: user for user in session.scalars(select(User).where(User.id.in_(user_ids))).all()} if user_ids else {}

    result: list[dict] = []
    for user_id in user_ids:
        if user_id is None:
            continue
        item = totals[user_id]
        net = money(item["paid"] - item["owed"] + item["sent"] - item["received"])
        member = next((m for m in members if m.user_id == user_id), None)
        user = users.get(user_id)
        result.append({
            "user_id": user_id,
            "full_name": user.full_name if user else None,
            "email": user.email if user else (member.email if member else None),
            "role": member.role if member else "former_member",
            "total_paid": money(item["paid"]),
            "total_owed": money(item["owed"]),
            "net_balance": net,
        })

    result.sort(key=lambda item: (0 if current_user_id and item["user_id"] == current_user_id else 1, (item["full_name"] or item["email"] or "").lower()))
    return result


def compute_pair_debts(
    session: Session,
    group_id: UUID,
    exclude_settlement_id: UUID | None = None,
) -> list[dict]:
    expenses = session.scalars(select(Expense).where(Expense.group_id == group_id)).all()
    expense_ids = [item.id for item in expenses]
    splits = session.scalars(select(ExpenseSplit).where(ExpenseSplit.expense_id.in_(expense_ids))).all() if expense_ids else []
    settlement_query = select(Settlement).where(Settlement.group_id == group_id)
    if exclude_settlement_id:
        settlement_query = settlement_query.where(Settlement.id != exclude_settlement_id)
    settlements = session.scalars(settlement_query).all()

    payer_by_expense = {expense.id: expense.paid_by for expense in expenses}
    obligations: dict[tuple[UUID, UUID], Decimal] = defaultdict(lambda: Decimal("0"))
    settlement_totals: dict[tuple[UUID, UUID], Decimal] = defaultdict(lambda: Decimal("0"))
    for split in splits:
        payer = payer_by_expense.get(split.expense_id)
        if payer and payer != split.user_id:
            obligations[(split.user_id, payer)] += money(split.amount)
    for settlement in settlements:
        settlement_totals[(settlement.from_user_id, settlement.to_user_id)] += money(settlement.amount)

    all_pairs = set(obligations) | set(settlement_totals)
    users = _user_map_for_ids(session, {user for pair in all_pairs for user in pair})
    result: list[dict] = []
    processed: set[frozenset[UUID]] = set()
    for a, b in all_pairs:
        if a == b:
            continue
        key = frozenset({a, b})
        if key in processed:
            continue
        processed.add(key)
        net = obligations[(a, b)] - obligations[(b, a)] - settlement_totals[(a, b)] + settlement_totals[(b, a)]
        if net > EPSILON:
            source, target, amount = a, b, money(net)
        elif net < -EPSILON:
            source, target, amount = b, a, money(-net)
        else:
            continue
        result.append({
            "from_user_id": source,
            "to_user_id": target,
            "from_name": _user_name(users.get(source)),
            "to_name": _user_name(users.get(target)),
            "amount": amount,
        })
    result.sort(key=lambda item: item["amount"], reverse=True)
    return result


def _user_map_for_ids(session: Session, ids: set[UUID]) -> dict[UUID, User]:
    if not ids:
        return {}
    return {user.id: user for user in session.scalars(select(User).where(User.id.in_(ids))).all()}


def _user_name(user: User | None) -> str:
    return user.full_name or user.email or "Member" if user else "Member"


def simplify_balances(balances: list[dict]) -> list[dict]:
    creditors = [{"user_id": b["user_id"], "amount": money(max(b["net_balance"], 0))} for b in balances if b["net_balance"] > EPSILON]
    debtors = [{"user_id": b["user_id"], "amount": money(max(-b["net_balance"], 0))} for b in balances if b["net_balance"] < -EPSILON]
    names = {b["user_id"]: (b["full_name"] or b["email"] or "Member") for b in balances}
    creditors.sort(key=lambda x: x["amount"], reverse=True)
    debtors.sort(key=lambda x: x["amount"], reverse=True)
    result: list[dict] = []
    i = j = 0
    while i < len(debtors) and j < len(creditors):
        amount = money(min(debtors[i]["amount"], creditors[j]["amount"]))
        if amount > EPSILON:
            result.append({
                "from_user_id": debtors[i]["user_id"],
                "to_user_id": creditors[j]["user_id"],
                "from_name": names[debtors[i]["user_id"]],
                "to_name": names[creditors[j]["user_id"]],
                "amount": amount,
            })
        debtors[i]["amount"] = money(debtors[i]["amount"] - amount)
        creditors[j]["amount"] = money(creditors[j]["amount"] - amount)
        if debtors[i]["amount"] <= EPSILON:
            i += 1
        if creditors[j]["amount"] <= EPSILON:
            j += 1
    return result
