from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import GroupMember, Settlement, User
from ..repositories.settlement_repository import get_settlement, list_settlements
from .balance_service import EPSILON, compute_balances, money
from .permissions import get_group_and_role, require_permission


def _validate_participants(session: Session, group_id: UUID, from_user_id: UUID, to_user_id: UUID) -> None:
    if from_user_id == to_user_id:
        raise HTTPException(status_code=400, detail="Settlement participants must be different.")
    members = session.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.status == "active",
        GroupMember.user_id.in_([from_user_id, to_user_id]),
    ).all()
    if {m.user_id for m in members if m.user_id} != {from_user_id, to_user_id}:
        raise HTTPException(status_code=400, detail="Settlement participants must be active group members.")


def _validate_amount(session: Session, group_id: UUID, from_user_id: UUID, to_user_id: UUID, amount: Decimal, exclude_settlement_id: UUID | None = None) -> None:
    balances = compute_balances(session, group_id, exclude_settlement_id=exclude_settlement_id)
    from_balance = next((b["net_balance"] for b in balances if b["user_id"] == from_user_id), Decimal("0"))
    to_balance = next((b["net_balance"] for b in balances if b["user_id"] == to_user_id), Decimal("0"))
    if from_balance >= -EPSILON:
        raise HTTPException(status_code=409, detail="The payer does not currently owe money in this group.")
    if to_balance <= EPSILON:
        raise HTTPException(status_code=409, detail="The recipient is not currently owed money in this group.")
    maximum = money(min(abs(from_balance), to_balance))
    if amount > maximum:
        raise HTTPException(status_code=409, detail=f"Settlement amount exceeds the outstanding debt of {maximum:.2f}.")


def create_settlement(session: Session, group_id: UUID, from_user_id: UUID, to_user_id: UUID, amount: Decimal, note: str | None, caller: User) -> Settlement:
    _, role = get_group_and_role(session, group_id, caller.id)
    require_permission(role, "money", "Viewers cannot record settlements.")
    _validate_participants(session, group_id, from_user_id, to_user_id)
    amount = money(amount)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Settlement amount must be greater than 0.")
    _validate_amount(session, group_id, from_user_id, to_user_id, amount)
    settlement = Settlement(group_id=group_id, from_user_id=from_user_id, to_user_id=to_user_id, amount=amount, note=note.strip() if note else None, created_by=caller.id)
    session.add(settlement)
    session.commit()
    session.refresh(settlement)
    return settlement


def update_settlement(session: Session, group_id: UUID, settlement_id: UUID, amount: Decimal, note: str | None, caller: User) -> Settlement:
    settlement = get_settlement(session, group_id, settlement_id)
    if settlement is None:
        raise HTTPException(status_code=404, detail="Settlement not found.")
    group, role = get_group_and_role(session, group_id, caller.id)
    require_permission(role, "money", "You do not have permission to edit settlements.")
    if caller.id not in {settlement.created_by, group.owner_id}:
        raise HTTPException(status_code=403, detail="Only the settlement creator or group owner can edit this settlement.")
    amount = money(amount)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Settlement amount must be greater than 0.")
    _validate_amount(session, group_id, settlement.from_user_id, settlement.to_user_id, amount, exclude_settlement_id=settlement.id)
    settlement.amount = amount
    settlement.note = note.strip() if note else None
    session.commit()
    session.refresh(settlement)
    return settlement


def delete_settlement(session: Session, group_id: UUID, settlement_id: UUID, caller: User) -> None:
    settlement = get_settlement(session, group_id, settlement_id)
    if settlement is None:
        raise HTTPException(status_code=404, detail="Settlement not found.")
    group, role = get_group_and_role(session, group_id, caller.id)
    require_permission(role, "money", "You do not have permission to delete settlements.")
    if caller.id not in {settlement.created_by, group.owner_id}:
        raise HTTPException(status_code=403, detail="Only the settlement creator or group owner can delete this settlement.")
    session.delete(settlement)
    session.commit()


def list_group_settlements(session: Session, group_id: UUID, caller: User, limit: int | None = None) -> list[Settlement]:
    get_group_and_role(session, group_id, caller.id)
    return list_settlements(session, group_id, limit)
