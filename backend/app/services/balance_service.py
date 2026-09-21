from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Numeric, cast, func, literal, select, union_all
from sqlalchemy.orm import Session

from ..models import Expense, ExpenseSplit, GroupMember, Settlement, User
from .permissions import get_group_and_role

CENT = Decimal("0.01")
EPSILON = Decimal("0.005")


def money(value: Decimal | int | float | None) -> Decimal:
    return Decimal(value or 0).quantize(CENT)


def _zero_numeric():
    return cast(literal(0), Numeric(14, 2))


def _load_financial_totals(session: Session, group_id: UUID, exclude_settlement_id: UUID | None = None):
    zero = _zero_numeric()
    paid = (
        select(Expense.paid_by.label("user_id"), func.sum(Expense.amount).label("paid"), zero.label("owed"), zero.label("sent"), zero.label("received"))
        .where(Expense.group_id == group_id)
        .group_by(Expense.paid_by)
    )
    owed = (
        select(ExpenseSplit.user_id.label("user_id"), zero.label("paid"), func.sum(ExpenseSplit.amount).label("owed"), zero.label("sent"), zero.label("received"))
        .join(Expense, Expense.id == ExpenseSplit.expense_id)
        .where(Expense.group_id == group_id)
        .group_by(ExpenseSplit.user_id)
    )
    settlement_filter = Settlement.group_id == group_id
    if exclude_settlement_id:
        settlement_filter = settlement_filter & (Settlement.id != exclude_settlement_id)
    sent = (
        select(Settlement.from_user_id.label("user_id"), zero.label("paid"), zero.label("owed"), func.sum(Settlement.amount).label("sent"), zero.label("received"))
        .where(settlement_filter)
        .group_by(Settlement.from_user_id)
    )
    received = (
        select(Settlement.to_user_id.label("user_id"), zero.label("paid"), zero.label("owed"), zero.label("sent"), func.sum(Settlement.amount).label("received"))
        .where(settlement_filter)
        .group_by(Settlement.to_user_id)
    )
    combined = union_all(paid, owed, sent, received).subquery()
    statement = (
        select(
            combined.c.user_id,
            User.full_name,
            User.email,
            func.sum(combined.c.paid).label("paid"),
            func.sum(combined.c.owed).label("owed"),
            func.sum(combined.c.sent).label("sent"),
            func.sum(combined.c.received).label("received"),
        )
        .outerjoin(User, User.id == combined.c.user_id)
        .group_by(combined.c.user_id, User.full_name, User.email)
    )
    rows = session.execute(statement).all()
    return [
        (row.user_id, row.full_name, row.email, money(row.paid), money(row.owed), money(row.sent), money(row.received))
        for row in rows
    ]


def _load_pair_deltas(session: Session, group_id: UUID, exclude_settlement_id: UUID | None = None):
    expense_pairs = (
        select(
            ExpenseSplit.user_id.label("from_user_id"),
            Expense.paid_by.label("to_user_id"),
            func.sum(ExpenseSplit.amount).label("delta"),
        )
        .join(Expense, Expense.id == ExpenseSplit.expense_id)
        .where(Expense.group_id == group_id, ExpenseSplit.user_id != Expense.paid_by)
        .group_by(ExpenseSplit.user_id, Expense.paid_by)
    )
    settlement_filter = Settlement.group_id == group_id
    if exclude_settlement_id:
        settlement_filter = settlement_filter & (Settlement.id != exclude_settlement_id)
    settlement_pairs = (
        select(
            Settlement.from_user_id.label("from_user_id"),
            Settlement.to_user_id.label("to_user_id"),
            (-func.sum(Settlement.amount)).label("delta"),
        )
        .where(settlement_filter)
        .group_by(Settlement.from_user_id, Settlement.to_user_id)
    )
    combined = union_all(expense_pairs, settlement_pairs).subquery()
    rows = session.execute(
        select(combined.c.from_user_id, combined.c.to_user_id, func.sum(combined.c.delta).label("delta"))
        .group_by(combined.c.from_user_id, combined.c.to_user_id)
    ).all()
    return {(row.from_user_id, row.to_user_id): money(row.delta) for row in rows if row.from_user_id and row.to_user_id}


def _load_members(session: Session, group_id: UUID):
    rows = session.execute(
        select(GroupMember, User)
        .outerjoin(User, User.id == GroupMember.user_id)
        .where(GroupMember.group_id == group_id, GroupMember.status == "active")
    ).all()
    return rows


def _user_name(info: tuple[str | None, str | None] | None) -> str:
    if not info:
        return "Member"
    return info[0] or info[1] or "Member"


def simplify_balances(balances: list[dict]) -> list[dict]:
    creditors = [
        {"user_id": balance["user_id"], "amount": money(max(balance["net_balance"], 0))}
        for balance in balances if balance["net_balance"] > EPSILON
    ]
    debtors = [
        {"user_id": balance["user_id"], "amount": money(max(-balance["net_balance"], 0))}
        for balance in balances if balance["net_balance"] < -EPSILON
    ]
    names = {balance["user_id"]: balance["full_name"] or balance["email"] or "Member" for balance in balances}
    creditors.sort(key=lambda item: item["amount"], reverse=True)
    debtors.sort(key=lambda item: item["amount"], reverse=True)
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
        if debtors[i]["amount"] <= EPSILON: i += 1
        if creditors[j]["amount"] <= EPSILON: j += 1
    return result


def _balances_from_totals(financial_totals, member_rows=None, current_user_id: UUID | None = None) -> list[dict]:
    member_meta = {}
    if member_rows:
        for member, user in member_rows:
            if member.user_id:
                member_meta[member.user_id] = (
                    user.full_name if user else None,
                    user.email if user else member.email,
                    member.role,
                )

    totals_by_user = {}
    for user_id, full_name, email, paid, owed, sent, received in financial_totals:
        totals_by_user[user_id] = (full_name, email, paid, owed, sent, received)

    user_ids = set(member_meta) | set(totals_by_user)
    if current_user_id:
        user_ids.add(current_user_id)
    balances = []
    for user_id in user_ids:
        full_name, email, paid, owed, sent, received = totals_by_user.get(
            user_id,
            (member_meta.get(user_id, (None, None, None))[0], member_meta.get(user_id, (None, None, None))[1], Decimal("0"), Decimal("0"), Decimal("0"), Decimal("0")),
        )
        if user_id in member_meta:
            full_name = full_name or member_meta[user_id][0]
            email = email or member_meta[user_id][1]
        role = member_meta.get(user_id, (None, None, "former_member"))[2]
        balances.append({
            "user_id": user_id,
            "full_name": full_name,
            "email": email,
            "role": role,
            "total_paid": money(paid),
            "total_owed": money(owed),
            "net_balance": money(paid - owed + sent - received),
        })
    balances.sort(key=lambda item: (0 if current_user_id and item["user_id"] == current_user_id else 1, (item["full_name"] or item["email"] or "").lower()))
    return balances


def compute_financial_snapshot(session: Session, group_id: UUID, current_user_id: UUID | None = None, exclude_settlement_id: UUID | None = None, check_access: bool = True) -> dict:
    if check_access and current_user_id:
        get_group_and_role(session, group_id, current_user_id)
    member_rows = _load_members(session, group_id)
    financial_totals = _load_financial_totals(session, group_id, exclude_settlement_id)
    pair_deltas = _load_pair_deltas(session, group_id, exclude_settlement_id)
    balances = _balances_from_totals(financial_totals, member_rows, current_user_id)
    users = {
        balance["user_id"]: (balance["full_name"], balance["email"])
        for balance in balances
    }
    direct = []
    processed: set[frozenset[UUID]] = set()
    for a, b in pair_deltas:
        if a == b:
            continue
        key = frozenset({a, b})
        if key in processed:
            continue
        processed.add(key)
        net = money(pair_deltas.get((a, b), Decimal("0")) - pair_deltas.get((b, a), Decimal("0")))
        if net > EPSILON:
            source, target, amount = a, b, net
        elif net < -EPSILON:
            source, target, amount = b, a, money(-net)
        else:
            continue
        direct.append({
            "from_user_id": source,
            "to_user_id": target,
            "from_name": _user_name(users.get(source)),
            "to_name": _user_name(users.get(target)),
            "amount": amount,
        })
    direct.sort(key=lambda item: item["amount"], reverse=True)
    return {"balances": balances, "direct": direct, "simplified": simplify_balances(balances)}


def compute_group_overview_financial(session: Session, group_id: UUID, current_user_id: UUID) -> dict:
    financial_totals = _load_financial_totals(session, group_id)
    balances = _balances_from_totals(financial_totals, current_user_id=current_user_id)
    return {"balances": balances, "simplified": simplify_balances(balances)}


def compute_balances(session: Session, group_id: UUID, current_user_id: UUID | None = None, exclude_settlement_id: UUID | None = None) -> list[dict]:
    if current_user_id:
        get_group_and_role(session, group_id, current_user_id)
    return compute_financial_snapshot(session, group_id, current_user_id=current_user_id, exclude_settlement_id=exclude_settlement_id, check_access=False)["balances"]


def compute_pair_debts(session: Session, group_id: UUID, exclude_settlement_id: UUID | None = None) -> list[dict]:
    return compute_financial_snapshot(session, group_id, exclude_settlement_id=exclude_settlement_id, check_access=False)["direct"]
