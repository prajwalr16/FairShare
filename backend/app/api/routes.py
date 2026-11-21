from __future__ import annotations

import inspect
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..core.database import get_db, get_read_db
from ..core.rate_limit import limiter
from ..core.security import CurrentUser, ensure_user, get_current_user, set_database_user_context
from ..repositories.settlement_repository import list_settlements
from ..schemas.balance import BalanceResponse
from ..schemas.expense import ExpenseCreate, ExpenseDetails, ExpenseSummary, SUPPORTED_EXPENSE_CATEGORIES
from ..schemas.group import (
    AcceptInvitation, GroupCreate, GroupFinancialResponse, GroupOverview, GroupSettings,
    GroupSummary, GroupUpdate, InviteMember, MemberBatchCreate, MemberResponse,
    PendingInvitation, RoleUpdate, UnclaimedMemberResponse,
)
from ..schemas.checklist import (
    ChecklistItemCreate,
    ChecklistBatchImport,
    ChecklistSummary,
    ChecklistItemUpdate,
    ChecklistItemOut,
)
from ..services.checklist_service import (
    get_group_checklists,
    create_checklist_item,
    batch_import_checklist_items,
    toggle_checklist_status,
    assign_checklist_item,
    update_checklist_item,
    delete_checklist_item,
)
from ..schemas.notification import PushTokenRegister
from ..schemas.place import PlaceSearchResponse
from ..schemas.settlement import SettlementCreate, SettlementResponse, SettlementUpdate
from ..schemas.user import UserProfileUpdate, UserResponse
from ..services.balance_service import compute_balances, compute_financial_snapshot
from ..services.debt_service import get_group_debts
from ..services.expense_service import create_expense, delete_expense, get_details, list_group_expenses, update_expense
from ..services.group_service import create_group, delete_group, get_overview, get_settings, leave_group, list_groups, list_members, remove_member, update_role, update_settings
from ..services.notification_service import notify_group_expense, notify_settlement, register_push_token
from ..services.permissions import get_group_and_role
from ..services.invite_service import accept_invitation, batch_add_members, get_pending_invitation, get_unclaimed_members, invite_member
from ..services.place_service import search_places
from ..services.settlement_service import create_settlement, delete_settlement, list_group_settlements, update_settlement

router = APIRouter(prefix="/api/v1")


def db_user(current_user: CurrentUser = Depends(get_current_user), session: Session = Depends(get_db)):
    user = ensure_user(session, current_user)
    set_database_user_context(session, user.id)
    return user


def write_context(current_user: CurrentUser = Depends(get_current_user), session: Session = Depends(get_db)) -> CurrentUser:
    set_database_user_context(session, current_user.id)
    return current_user


@router.get("/health")
def health(db: bool = False, session: Session = Depends(get_read_db)) -> dict[str, str]:
    if db:
        session.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "active", "app": "FairShare API"}
    return {"status": "healthy", "app": "FairShare API"}


@router.get("/me", response_model=UserResponse)
def me(user: CurrentUser = Depends(get_current_user), session: Session = Depends(get_db)):
    db_u = ensure_user(session, user)
    return UserResponse(id=db_u.id, email=db_u.email, full_name=db_u.full_name)


@router.patch("/me", response_model=UserResponse)
def update_profile(
    payload: UserProfileUpdate,
    user: CurrentUser = Depends(write_context),
    session: Session = Depends(get_db),
):
    db_u = ensure_user(session, user)
    db_u.full_name = payload.full_name.strip()
    session.commit()
    session.refresh(db_u)
    return UserResponse(id=db_u.id, email=db_u.email, full_name=db_u.full_name)


@router.get("/places/search", response_model=PlaceSearchResponse)
async def search_places_route(
    q: str = Query(min_length=2, max_length=160),
    user: CurrentUser = Depends(get_current_user),
):
    del user
    normalized = " ".join(q.strip().split())
    res = search_places(normalized)
    if inspect.isawaitable(res):
        res = await res
    if isinstance(res, dict):
        return res
    return {"query": normalized, "results": res}


@router.get("/groups", response_model=list[GroupSummary])
def groups(user: CurrentUser = Depends(get_current_user), session: Session = Depends(get_read_db)):
    return list_groups(session, user.id)


@router.post("/groups", response_model=GroupSummary, status_code=status.HTTP_201_CREATED)
def create_group_route(payload: GroupCreate, user=Depends(db_user), session: Session = Depends(get_db)):
    return create_group(session, user, payload.name, payload.type, payload.currency, payload.description)


@router.get("/groups/{group_id}", response_model=GroupSummary)
def get_group_route(group_id: UUID, user: CurrentUser = Depends(get_current_user), session: Session = Depends(get_read_db)):
    group, _ = get_group_and_role(session, group_id, user.id)
    return group


@router.get("/groups/{group_id}/overview", response_model=GroupOverview)
def group_overview(group_id: UUID, user: CurrentUser = Depends(get_current_user), session: Session = Depends(get_read_db)):
    return get_overview(session, group_id, user.id)


@router.get("/groups/{group_id}/financial", response_model=GroupFinancialResponse)
def group_financial(group_id: UUID, user: CurrentUser = Depends(get_current_user), session: Session = Depends(get_read_db)):
    return compute_financial_snapshot(session, group_id, current_user_id=user.id, check_access=True)


@router.get("/groups/{group_id}/settings", response_model=GroupSettings)
def group_settings(group_id: UUID, user: CurrentUser = Depends(get_current_user), session: Session = Depends(get_read_db)):
    return get_settings(session, group_id, user.id)


@router.patch("/groups/{group_id}", response_model=GroupSettings)
def patch_group(group_id: UUID, payload: GroupUpdate, user: CurrentUser = Depends(write_context), session: Session = Depends(get_db)):
    update_settings(session, group_id, user.id, payload.name, payload.type, payload.currency, payload.description)
    return get_settings(session, group_id, user.id)


@router.post("/groups/{group_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_group_route(group_id: UUID, user: CurrentUser = Depends(write_context), session: Session = Depends(get_db)):
    leave_group(session, group_id, user.id)
    return None


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group_route(group_id: UUID, user: CurrentUser = Depends(write_context), session: Session = Depends(get_db)):
    delete_group(session, group_id, user.id)
    return None


@router.get("/groups/{group_id}/members", response_model=list[MemberResponse])
def members(group_id: UUID, user: CurrentUser = Depends(get_current_user), session: Session = Depends(get_read_db)):
    return list_members(session, group_id, user.id)


@router.get("/groups/{group_id}/members/roles", response_model=list[MemberResponse])
def member_roles(group_id: UUID, user: CurrentUser = Depends(get_current_user), session: Session = Depends(get_read_db)):
    return list_members(session, group_id, user.id)


@router.get("/groups/{group_id}/invitation", response_model=PendingInvitation)
def pending_invitation(group_id: UUID, user: CurrentUser = Depends(get_current_user), session: Session = Depends(get_read_db)):
    return get_pending_invitation(session, group_id, user)


@router.post("/groups/{group_id}/members/invite")
@limiter.limit("20/minute")
def invite(request: Request, group_id: UUID, payload: InviteMember, user=Depends(db_user), session: Session = Depends(get_db)):
    return invite_member(session, group_id, payload.email, payload.redirect_to, user)


@router.post("/groups/{group_id}/members/batch", response_model=list[MemberResponse], status_code=status.HTTP_201_CREATED)
def batch_members_route(group_id: UUID, payload: MemberBatchCreate, user=Depends(db_user), session: Session = Depends(get_db)):
    return batch_add_members(session, group_id, payload.names, user)


@router.get("/groups/{group_id}/members/unclaimed", response_model=list[UnclaimedMemberResponse])
def unclaimed_members_route(group_id: UUID, user: CurrentUser = Depends(get_current_user), session: Session = Depends(get_read_db)):
    return get_unclaimed_members(session, group_id)


@router.post("/groups/{group_id}/members/accept")
def accept(group_id: UUID, payload: AcceptInvitation, user=Depends(db_user), session: Session = Depends(get_db)):
    if payload.group_id != group_id:
        raise HTTPException(status_code=400, detail="Group information does not match.")
    return accept_invitation(session, group_id, payload.full_name, user, claim_member_id=payload.claim_member_id)


@router.delete("/groups/{group_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member_route(group_id: UUID, member_id: UUID, user: CurrentUser = Depends(write_context), session: Session = Depends(get_db)):
    remove_member(session, group_id, member_id, user.id)
    return None


@router.patch("/groups/{group_id}/members/{user_id}/role", response_model=MemberResponse)
def patch_member_role(group_id: UUID, user_id: UUID, payload: RoleUpdate, user: CurrentUser = Depends(write_context), session: Session = Depends(get_db)):
    return update_role(session, group_id, user_id, payload.role, user.id)


@router.get("/groups/{group_id}/expenses", response_model=list[ExpenseSummary])
def expenses(group_id: UUID, limit: int | None = Query(default=None, ge=1, le=200), category: str | None = Query(default=None), scope: str = Query(default="all"), paid_by: UUID | None = Query(default=None), user: CurrentUser = Depends(get_current_user), session: Session = Depends(get_read_db)):
    return list_group_expenses(session, group_id, user.id, limit, category, scope, paid_by=paid_by)


@router.post("/groups/{group_id}/expenses", response_model=ExpenseSummary, status_code=status.HTTP_201_CREATED)
@limiter.limit("60/minute")
def create_expense_route(request: Request, group_id: UUID, payload: ExpenseCreate, user: CurrentUser = Depends(write_context), session: Session = Depends(get_db)):
    exp = create_expense(session, group_id, payload.title, payload.amount, payload.paid_by, payload.split_type, payload.category, payload.splits, user, payload.location_name, payload.journey_stop_id, payload.latitude, payload.longitude, payload.expense_date)
    notify_group_expense(session, group_id, exp.paid_by, user.full_name or user.email, exp.title, exp.amount)
    return exp


@router.get("/expenses/{expense_id}", response_model=ExpenseDetails)
def expense_detail(expense_id: UUID, user: CurrentUser = Depends(get_current_user), session: Session = Depends(get_read_db)):
    expense, splits = get_details(session, expense_id, user.id)
    return {"expense": expense, "splits": splits}


@router.put("/expenses/{expense_id}", response_model=ExpenseSummary)
def update_expense_route(expense_id: UUID, payload: ExpenseCreate, user: CurrentUser = Depends(write_context), session: Session = Depends(get_db)):
    return update_expense(session, expense_id, payload.title, payload.amount, payload.paid_by, payload.split_type, payload.category, payload.splits, user.id, payload.location_name, payload.journey_stop_id, payload.latitude, payload.longitude, payload.expense_date)


@router.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense_route(expense_id: UUID, user: CurrentUser = Depends(write_context), session: Session = Depends(get_db)):
    delete_expense(session, expense_id, user.id)
    return None


@router.get("/groups/{group_id}/balances", response_model=list[BalanceResponse])
def balances(group_id: UUID, user: CurrentUser = Depends(get_current_user), session: Session = Depends(get_read_db)):
    return compute_balances(session, group_id, user.id)


@router.get("/groups/{group_id}/debts")
def debts(group_id: UUID, user: CurrentUser = Depends(get_current_user), session: Session = Depends(get_read_db)):
    return get_group_debts(session, group_id, user.id)


@router.get("/groups/{group_id}/settlements", response_model=list[SettlementResponse])
def settlements(group_id: UUID, limit: int | None = Query(default=None, ge=1, le=200), user: CurrentUser = Depends(get_current_user), session: Session = Depends(get_read_db)):
    return list_group_settlements(session, group_id, user.id, limit)


@router.post("/groups/{group_id}/settlements", response_model=SettlementResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("60/minute")
def record_settlement_route(request: Request, group_id: UUID, payload: SettlementCreate, user: CurrentUser = Depends(write_context), session: Session = Depends(get_db)):
    st = create_settlement(session, group_id, payload.from_user_id, payload.to_user_id, payload.amount, payload.note, user.id)
    notify_settlement(session, group_id, payload.from_user_id, user.full_name or user.email, payload.to_user_id, payload.amount)
    return st


@router.put("/groups/{group_id}/settlements/{settlement_id}", response_model=SettlementResponse)
def update_settlement_route(group_id: UUID, settlement_id: UUID, payload: SettlementUpdate, user: CurrentUser = Depends(write_context), session: Session = Depends(get_db)):
    return update_settlement(session, group_id, settlement_id, payload.amount, payload.note, user.id)


@router.delete("/groups/{group_id}/settlements/{settlement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_settlement_route(group_id: UUID, settlement_id: UUID, user: CurrentUser = Depends(write_context), session: Session = Depends(get_db)):
    delete_settlement(session, group_id, settlement_id, user.id)
    return None


@router.get("/groups/{group_id}/history")
def history(group_id: UUID, limit: int = Query(default=100, ge=1, le=200), category: str | None = Query(default=None), scope: str = Query(default="all"), user: CurrentUser = Depends(get_current_user), session: Session = Depends(get_read_db)):
    get_group_and_role(session, group_id, user.id)
    if scope not in {"all", "mine"}:
        raise HTTPException(status_code=400, detail="Invalid expense scope.")
    if category and category != "All" and category not in SUPPORTED_EXPENSE_CATEGORIES:
        raise HTTPException(status_code=400, detail="Unsupported expense category.")
    return {
        "expenses": list_group_expenses(session, group_id, user.id, limit, category if category != "All" else None, scope),
        "settlements": list_settlements(session, group_id, limit),
    }


@router.post("/notifications/register-token", status_code=status.HTTP_200_OK)
def register_token_route(
    payload: PushTokenRegister,
    user: CurrentUser = Depends(write_context),
    session: Session = Depends(get_db),
):
    register_push_token(session, user.id, payload.token, payload.platform)
    return {"status": "ok"}


@router.get("/groups/{group_id}/checklists", response_model=ChecklistSummary)
def list_checklists_route(
    group_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_read_db),
):
    return get_group_checklists(session, group_id, user.id)


@router.post("/groups/{group_id}/checklists", status_code=status.HTTP_201_CREATED)
def create_checklist_item_route(
    group_id: UUID,
    payload: ChecklistItemCreate,
    user: CurrentUser = Depends(write_context),
    session: Session = Depends(get_db),
):
    item = create_checklist_item(session, group_id, user.id, payload)
    return {"id": str(item.id)}


@router.post("/groups/{group_id}/checklists/import", status_code=status.HTTP_200_OK)
def import_checklist_items_route(
    group_id: UUID,
    payload: ChecklistBatchImport,
    user: CurrentUser = Depends(write_context),
    session: Session = Depends(get_db),
):
    count = batch_import_checklist_items(session, group_id, user.id, payload.items)
    return {"imported": count}


@router.patch("/groups/{group_id}/checklists/{checklist_id}/toggle", status_code=status.HTTP_200_OK)
def toggle_checklist_item_route(
    group_id: UUID,
    checklist_id: UUID,
    user: CurrentUser = Depends(write_context),
    session: Session = Depends(get_db),
):
    new_status = toggle_checklist_status(session, group_id, checklist_id, user.id)
    return {"is_packed": new_status}


class AssignPayload(BaseModel):
    assigned_to: UUID | None = None


@router.patch("/groups/{group_id}/checklists/{checklist_id}/assign", status_code=status.HTTP_200_OK)
def assign_checklist_item_route(
    group_id: UUID,
    checklist_id: UUID,
    payload: AssignPayload,
    user: CurrentUser = Depends(write_context),
    session: Session = Depends(get_db),
):
    assign_checklist_item(session, group_id, checklist_id, user.id, payload.assigned_to)
    return {"status": "ok"}


@router.patch("/groups/{group_id}/checklists/{checklist_id}", response_model=ChecklistItemOut)
def update_checklist_item_route(
    group_id: UUID,
    checklist_id: UUID,
    payload: ChecklistItemUpdate,
    user: CurrentUser = Depends(write_context),
    session: Session = Depends(get_db),
):
    assigned_provided = "assigned_to" in payload.model_fields_set
    item = update_checklist_item(
        session,
        group_id,
        checklist_id,
        user.id,
        title=payload.title,
        category=payload.category,
        scope=payload.scope,
        is_private=payload.is_private,
        assigned_to=payload.assigned_to,
        assigned_to_provided=assigned_provided,
    )
    assigned_name = None
    if item.assigned_to:
        m = session.scalar(
            select(GroupMember).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == item.assigned_to,
            )
        )
        if m:
            assigned_name = m.display_name or m.email

    return ChecklistItemOut(
        id=item.id,
        group_id=item.group_id,
        created_by=item.created_by,
        title=item.title,
        category=item.category,
        scope=item.scope,
        is_private=item.is_private,
        assigned_to=item.assigned_to,
        assigned_name=assigned_name,
        is_packed=item.is_packed_group if item.scope == "group" else False,
        created_at=item.created_at,
    )


@router.delete("/groups/{group_id}/checklists/{checklist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_checklist_item_route(
    group_id: UUID,
    checklist_id: UUID,
    user: CurrentUser = Depends(write_context),
    session: Session = Depends(get_db),
):
    delete_checklist_item(session, group_id, checklist_id, user.id)
    return None

