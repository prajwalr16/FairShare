from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.security import CurrentUser, ensure_user, get_current_user, set_database_user_context
from ..models import GroupMember
from ..schemas.balance import BalanceResponse
from ..schemas.expense import ExpenseCreate, ExpenseDetails, ExpenseSplitResponse, ExpenseSummary
from ..schemas.group import AcceptInvitation, GroupCreate, GroupSettings, GroupSummary, GroupUpdate, InviteMember, MemberResponse, PendingInvitation, RoleUpdate
from ..schemas.settlement import SettlementCreate, SettlementResponse, SettlementUpdate
from ..services.balance_service import compute_balances
from ..services.debt_service import get_group_debts
from ..services.expense_service import create_expense, delete_expense, get_details, list_group_expenses, update_expense
from ..services.group_service import create_group, delete_group, get_settings, leave_group, list_groups, list_members, remove_member, update_role, update_settings
from ..services.permissions import get_group_and_role
from ..services.invite_service import accept_invitation, get_pending_invitation, invite_member
from ..services.settlement_service import create_settlement, delete_settlement, list_group_settlements, update_settlement

router = APIRouter(prefix="/api/v1")


def db_user(current_user: CurrentUser = Depends(get_current_user), session: Session = Depends(get_db)):
    user = ensure_user(session, current_user)
    set_database_user_context(session, user.id)
    return user


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "healthy", "app": "FairShare API"}


@router.get("/me")
def me(user=Depends(db_user)):
    return {"id": user.id, "email": user.email, "full_name": user.full_name}


@router.get("/groups", response_model=list[GroupSummary])
def groups(user=Depends(db_user), session: Session = Depends(get_db)):
    return list_groups(session, user)


@router.post("/groups", response_model=GroupSummary, status_code=status.HTTP_201_CREATED)
def create_group_route(payload: GroupCreate, user=Depends(db_user), session: Session = Depends(get_db)):
    return create_group(session, user, payload.name, payload.type, payload.currency, payload.description)


@router.get("/groups/{group_id}", response_model=GroupSummary)
def get_group_route(group_id: UUID, user=Depends(db_user), session: Session = Depends(get_db)):
    group, _ = get_group_and_role(session, group_id, user.id)
    return group


@router.get("/groups/{group_id}/settings", response_model=GroupSettings)
def group_settings(group_id: UUID, user=Depends(db_user), session: Session = Depends(get_db)):
    return get_settings(session, group_id, user)


@router.patch("/groups/{group_id}", response_model=GroupSettings)
def patch_group(group_id: UUID, payload: GroupUpdate, user=Depends(db_user), session: Session = Depends(get_db)):
    update_settings(session, group_id, user, payload.name, payload.type, payload.currency, payload.description)
    return get_settings(session, group_id, user)


@router.post("/groups/{group_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_group_route(group_id: UUID, user=Depends(db_user), session: Session = Depends(get_db)):
    leave_group(session, group_id, user)
    return None


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group_route(group_id: UUID, user=Depends(db_user), session: Session = Depends(get_db)):
    delete_group(session, group_id, user)
    return None


@router.get("/groups/{group_id}/members", response_model=list[MemberResponse])
def members(group_id: UUID, user=Depends(db_user), session: Session = Depends(get_db)):
    return list_members(session, group_id, user)


@router.get("/groups/{group_id}/members/roles", response_model=list[MemberResponse])
def member_roles(group_id: UUID, user=Depends(db_user), session: Session = Depends(get_db)):
    return list_members(session, group_id, user)


@router.get("/groups/{group_id}/invitation", response_model=PendingInvitation)
def pending_invitation(group_id: UUID, user=Depends(db_user), session: Session = Depends(get_db)):
    return get_pending_invitation(session, group_id, user)


@router.post("/groups/{group_id}/members/invite")
def invite(group_id: UUID, payload: InviteMember, user=Depends(db_user), session: Session = Depends(get_db)):
    return invite_member(session, group_id, payload.email, payload.redirect_to, user)


@router.post("/groups/{group_id}/members/accept")
def accept(group_id: UUID, payload: AcceptInvitation, user=Depends(db_user), session: Session = Depends(get_db)):
    if payload.group_id != group_id:
        raise HTTPException(status_code=400, detail="Group information does not match.")
    return accept_invitation(session, group_id, payload.full_name, user)


@router.delete("/groups/{group_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member_route(group_id: UUID, member_id: UUID, user=Depends(db_user), session: Session = Depends(get_db)):
    remove_member(session, group_id, member_id, user)
    return None


@router.patch("/groups/{group_id}/members/{user_id}/role", response_model=MemberResponse)
def patch_member_role(group_id: UUID, user_id: UUID, payload: RoleUpdate, user=Depends(db_user), session: Session = Depends(get_db)):
    return update_role(session, group_id, user_id, payload.role, user)


@router.get("/groups/{group_id}/expenses", response_model=list[ExpenseSummary])
def expenses(
    group_id: UUID,
    limit: int | None = Query(default=None, ge=1, le=200),
    category: str | None = Query(default=None),
    scope: str = Query(default="all"),
    user=Depends(db_user),
    session: Session = Depends(get_db),
):
    return list_group_expenses(session, group_id, user, limit, category, scope)


@router.post("/groups/{group_id}/expenses", response_model=ExpenseSummary, status_code=status.HTTP_201_CREATED)
def create_expense_route(group_id: UUID, payload: ExpenseCreate, user=Depends(db_user), session: Session = Depends(get_db)):
    return create_expense(session, group_id, payload.title, payload.amount, payload.paid_by, payload.split_type, payload.category, payload.splits, user)


@router.get("/expenses/{expense_id}", response_model=ExpenseDetails)
def expense_detail(expense_id: UUID, user=Depends(db_user), session: Session = Depends(get_db)):
    expense, splits = get_details(session, expense_id, user)
    return {"expense": expense, "splits": splits}


@router.put("/expenses/{expense_id}", response_model=ExpenseSummary)
def update_expense_route(expense_id: UUID, payload: ExpenseCreate, user=Depends(db_user), session: Session = Depends(get_db)):
    return update_expense(session, expense_id, payload.title, payload.amount, payload.paid_by, payload.split_type, payload.category, payload.splits, user)


@router.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense_route(expense_id: UUID, user=Depends(db_user), session: Session = Depends(get_db)):
    delete_expense(session, expense_id, user)
    return None


@router.get("/groups/{group_id}/balances", response_model=list[BalanceResponse])
def balances(group_id: UUID, user=Depends(db_user), session: Session = Depends(get_db)):
    return compute_balances(session, group_id, user.id)


@router.get("/groups/{group_id}/debts")
def debts(group_id: UUID, user=Depends(db_user), session: Session = Depends(get_db)):
    return get_group_debts(session, group_id, user.id)


@router.get("/groups/{group_id}/settlements", response_model=list[SettlementResponse])
def settlements(group_id: UUID, limit: int | None = Query(default=None, ge=1, le=200), user=Depends(db_user), session: Session = Depends(get_db)):
    return list_group_settlements(session, group_id, user, limit)


@router.post("/groups/{group_id}/settlements", response_model=SettlementResponse, status_code=status.HTTP_201_CREATED)
def record_settlement_route(group_id: UUID, payload: SettlementCreate, user=Depends(db_user), session: Session = Depends(get_db)):
    return create_settlement(session, group_id, payload.from_user_id, payload.to_user_id, payload.amount, payload.note, user)


@router.put("/groups/{group_id}/settlements/{settlement_id}", response_model=SettlementResponse)
def update_settlement_route(group_id: UUID, settlement_id: UUID, payload: SettlementUpdate, user=Depends(db_user), session: Session = Depends(get_db)):
    return update_settlement(session, group_id, settlement_id, payload.amount, payload.note, user)


@router.delete("/groups/{group_id}/settlements/{settlement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_settlement_route(group_id: UUID, settlement_id: UUID, user=Depends(db_user), session: Session = Depends(get_db)):
    delete_settlement(session, group_id, settlement_id, user)
    return None


@router.get("/groups/{group_id}/history")
def history(
    group_id: UUID,
    limit: int = Query(default=100, ge=1, le=200),
    category: str | None = Query(default=None),
    scope: str = Query(default="all"),
    user=Depends(db_user),
    session: Session = Depends(get_db),
):
    return {
        "expenses": list_group_expenses(session, group_id, user, limit, category, scope),
        "settlements": list_group_settlements(session, group_id, user, limit),
    }