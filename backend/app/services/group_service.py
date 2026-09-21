from __future__ import annotations

import json
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import exists, select, text
from sqlalchemy.orm import Session

from ..models import Group, GroupMember, User
from ..repositories.group_repository import list_groups_for_user
from .balance_service import compute_balances, compute_group_overview_financial, money, simplify_balances
from .permissions import get_group_and_role, require_permission

SUPPORTED_GROUP_TYPES = {"Trip", "Home", "Friends", "Office", "Other"}
SUPPORTED_ROLES = {"admin", "member", "viewer"}


def create_group(session: Session, caller: User, name: str, group_type: str, currency: str, description: str | None) -> Group:
    clean_name = name.strip()
    clean_type = group_type.strip()
    clean_currency = currency.strip().upper()
    clean_description = description.strip() if description else None
    if not clean_name:
        raise HTTPException(status_code=400, detail="Group name is required.")
    if clean_type not in SUPPORTED_GROUP_TYPES:
        raise HTTPException(status_code=400, detail="Invalid group type.")
    if len(clean_currency) != 3 or not clean_currency.isalpha():
        raise HTTPException(status_code=400, detail="Currency must be a valid 3-letter code.")

    group = Group(owner_id=caller.id, name=clean_name, type=clean_type, currency=clean_currency, description=clean_description or None)
    session.add(group)
    session.flush()

    owner_membership = session.scalar(select(GroupMember).where(GroupMember.group_id == group.id, GroupMember.user_id == caller.id))
    if owner_membership is None:
        session.add(GroupMember(group_id=group.id, user_id=caller.id, email=(caller.email or "").strip().lower(), role="owner", status="active"))

    session.commit()
    return group


def list_groups(session: Session, user_id: UUID) -> list[Group]:
    return list_groups_for_user(session, user_id)


def get_settings(session: Session, group_id: UUID, user_id: UUID) -> dict:
    group, role = get_group_and_role(session, group_id, user_id)
    return {
        "id": group.id, "owner_id": group.owner_id, "name": group.name, "type": group.type,
        "currency": group.currency, "description": group.description, "created_at": group.created_at,
        "is_owner": group.owner_id == user_id, "role": role,
    }


def _postgres_group_overview(session: Session, group_id: UUID, user_id: UUID) -> dict | None:
    """Build Group Details Overview in one PostgreSQL round trip."""
    sql = text(
        """
        WITH paid AS (
            SELECT e.paid_by AS user_id, SUM(e.amount) AS paid, 0::numeric AS owed, 0::numeric AS sent, 0::numeric AS received
            FROM public.expenses e
            WHERE e.group_id = :group_id
            GROUP BY e.paid_by
        ),
        owed AS (
            SELECT es.user_id, 0::numeric AS paid, SUM(es.amount) AS owed, 0::numeric AS sent, 0::numeric AS received
            FROM public.expense_splits es
            JOIN public.expenses e ON e.id = es.expense_id
            WHERE e.group_id = :group_id
            GROUP BY es.user_id
        ),
        sent AS (
            SELECT s.from_user_id AS user_id, 0::numeric AS paid, 0::numeric AS owed, SUM(s.amount) AS sent, 0::numeric AS received
            FROM public.settlements s
            WHERE s.group_id = :group_id
            GROUP BY s.from_user_id
        ),
        received AS (
            SELECT s.to_user_id AS user_id, 0::numeric AS paid, 0::numeric AS owed, 0::numeric AS sent, SUM(s.amount) AS received
            FROM public.settlements s
            WHERE s.group_id = :group_id
            GROUP BY s.to_user_id
        ),
        totals AS (
            SELECT * FROM paid
            UNION ALL SELECT * FROM owed
            UNION ALL SELECT * FROM sent
            UNION ALL SELECT * FROM received
        ),
        totals_by_user AS (
            SELECT user_id, SUM(paid) AS paid, SUM(owed) AS owed, SUM(sent) AS sent, SUM(received) AS received
            FROM totals
            GROUP BY user_id
        ),
        user_ids AS (
            SELECT user_id FROM totals_by_user
            UNION
            SELECT CAST(:user_id AS uuid)
        ),
        balances AS (
            SELECT
                ui.user_id,
                u.full_name,
                u.email,
                COALESCE(t.paid, 0)::numeric AS total_paid,
                COALESCE(t.owed, 0)::numeric AS total_owed,
                (COALESCE(t.paid, 0) - COALESCE(t.owed, 0) + COALESCE(t.sent, 0) - COALESCE(t.received, 0))::numeric AS net_balance
            FROM user_ids ui
            LEFT JOIN totals_by_user t ON t.user_id = ui.user_id
            LEFT JOIN public.users u ON u.id = ui.user_id
        ),
        recent_expenses AS (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', e.id,
                    'group_id', e.group_id,
                    'title', e.title,
                    'amount', e.amount,
                    'split_type', e.split_type,
                    'category', e.category,
                    'paid_by', e.paid_by,
                    'created_at', e.created_at
                ) ORDER BY e.created_at DESC
            ), '[]'::jsonb) AS data
            FROM (
                SELECT id, group_id, title, amount, split_type, category, paid_by, created_at
                FROM public.expenses
                WHERE group_id = :group_id
                ORDER BY created_at DESC
                LIMIT 5
            ) e
        ),
        balance_json AS (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'user_id', b.user_id,
                    'full_name', b.full_name,
                    'email', b.email,
                    'role', CASE WHEN b.user_id = g.owner_id THEN 'owner' ELSE 'member' END,
                    'total_paid', b.total_paid,
                    'total_owed', b.total_owed,
                    'net_balance', b.net_balance
                ) ORDER BY CASE WHEN b.user_id = CAST(:user_id AS uuid) THEN 0 ELSE 1 END, lower(COALESCE(b.full_name, b.email, ''))
            ), '[]'::jsonb) AS data
            FROM balances b
            CROSS JOIN public.groups g
            WHERE g.id = :group_id
        )
        SELECT
            g.id, g.owner_id, g.name, g.type, g.currency, g.description, g.created_at,
            CASE WHEN g.owner_id = CAST(:user_id AS uuid) THEN 'owner' ELSE gm.role END AS role,
            bj.data AS balances,
            re.data AS recent_expenses
        FROM public.groups g
        LEFT JOIN public.group_members gm
          ON gm.group_id = g.id AND gm.user_id = CAST(:user_id AS uuid) AND gm.status = 'active'
        CROSS JOIN balance_json bj
        CROSS JOIN recent_expenses re
        WHERE g.id = :group_id
          AND (g.owner_id = CAST(:user_id AS uuid) OR gm.id IS NOT NULL)
        """
    )
    row = session.execute(sql, {"group_id": str(group_id), "user_id": str(user_id)}).mappings().first()
    if row is None:
        return None

    raw_balances = row["balances"]
    raw_recent = row["recent_expenses"]
    if isinstance(raw_balances, str):
        raw_balances = json.loads(raw_balances)
    if isinstance(raw_recent, str):
        raw_recent = json.loads(raw_recent)

    balances: list[dict] = []
    for item in raw_balances or []:
        balances.append({
            "user_id": str(item["user_id"]),
            "full_name": item.get("full_name"),
            "email": item.get("email"),
            "role": item.get("role") or "member",
            "total_paid": money(Decimal(str(item.get("total_paid") or 0))),
            "total_owed": money(Decimal(str(item.get("total_owed") or 0))),
            "net_balance": money(Decimal(str(item.get("net_balance") or 0))),
        })

    simplified = simplify_balances(balances)
    return {
        "id": row["id"],
        "owner_id": row["owner_id"],
        "name": row["name"],
        "type": row["type"],
        "currency": row["currency"],
        "description": row["description"],
        "created_at": row["created_at"],
        "is_owner": str(row["owner_id"]) == str(user_id),
        "role": row["role"] if row["role"] in {"owner", "admin", "member", "viewer"} else "member",
        "current_user_balance": next((b for b in balances if b["user_id"] == str(user_id)), None),
        "top_debts": simplified[:3],
        "recent_expenses": raw_recent or [],
    }


def get_overview(session: Session, group_id: UUID, user_id: UUID) -> dict:
    if session.bind is not None and session.bind.dialect.name == "postgresql":
        overview = _postgres_group_overview(session, group_id, user_id)
        if overview is not None:
            return overview
        if session.get(Group, group_id) is None:
            raise HTTPException(status_code=404, detail="Group not found.")
        raise HTTPException(status_code=403, detail="You are not an active member of this group.")

    group, role = get_group_and_role(session, group_id, user_id)
    financial = compute_group_overview_financial(session, group_id, user_id)
    current = next((b for b in financial["balances"] if b["user_id"] == user_id), None)
    from ..repositories.expense_repository import list_expenses
    return {
        "id": group.id, "owner_id": group.owner_id, "name": group.name, "type": group.type,
        "currency": group.currency, "description": group.description, "created_at": group.created_at,
        "is_owner": group.owner_id == user_id, "role": role, "current_user_balance": current,
        "top_debts": financial["simplified"][:3], "recent_expenses": list_expenses(session, group_id, limit=5),
    }


def update_settings(session: Session, group_id: UUID, user_id: UUID, name: str, group_type: str, currency: str, description: str | None) -> Group:
    group, role = get_group_and_role(session, group_id, user_id)
    require_permission(role, "settings", "Only the group owner can edit group settings.")
    clean_name = name.strip(); clean_type = group_type.strip(); clean_currency = currency.strip().upper(); clean_description = description.strip() if description else None
    if not clean_name: raise HTTPException(status_code=400, detail="Group name is required.")
    if len(clean_name) > 80: raise HTTPException(status_code=400, detail="Group name must be 80 characters or less.")
    if clean_type not in SUPPORTED_GROUP_TYPES: raise HTTPException(status_code=400, detail="Invalid group type.")
    if len(clean_currency) != 3 or not clean_currency.isalpha(): raise HTTPException(status_code=400, detail="Currency must be a valid 3-letter code.")
    if clean_description and len(clean_description) > 500: raise HTTPException(status_code=400, detail="Group description must be 500 characters or less.")
    if clean_currency != (group.currency or "INR").upper():
        from ..models import Expense, Settlement
        has_financial = session.scalar(select(Expense.id).where(Expense.group_id == group_id).limit(1)) is not None
        has_financial = has_financial or session.scalar(select(Settlement.id).where(Settlement.group_id == group_id).limit(1)) is not None
        if has_financial: raise HTTPException(status_code=409, detail="Base currency cannot be changed after expenses or settlements have been recorded.")
    group.name = clean_name; group.type = clean_type; group.currency = clean_currency; group.description = clean_description or None
    session.commit(); return group


def list_members(session: Session, group_id: UUID, user_id: UUID) -> list[dict]:
    access = exists(select(GroupMember.id).where(GroupMember.group_id == group_id, GroupMember.user_id == user_id, GroupMember.status == "active"))
    group_owner = exists(select(Group.id).where(Group.id == group_id, Group.owner_id == user_id))
    rows = session.execute(
        select(GroupMember, User)
        .outerjoin(User, User.id == GroupMember.user_id)
        .where(GroupMember.group_id == group_id, access | group_owner)
        .order_by(GroupMember.created_at.asc())
    ).all()
    if not rows:
        if session.scalar(select(Group.id).where(Group.id == group_id)) is None:
            raise HTTPException(status_code=404, detail="Group not found.")
        raise HTTPException(status_code=403, detail="You are not an active member of this group.")
    response = [{
        "id": member.id, "group_id": member.group_id, "user_id": member.user_id, "email": member.email,
        "full_name": user.full_name if user else None, "role": member.role, "status": member.status, "created_at": member.created_at,
    } for member, user in rows]
    response.sort(key=lambda item: (0 if item["role"] == "owner" else 1 if item["role"] == "admin" else 2 if item["role"] == "member" else 3, item["created_at"]))
    return response


def update_role(session: Session, group_id: UUID, target_user_id: UUID, role: str, user_id: UUID) -> dict:
    group, caller_role = get_group_and_role(session, group_id, user_id)
    require_permission(caller_role, "roles", "Only the group owner can change member roles.")
    normalized = role.strip().lower()
    if normalized not in SUPPORTED_ROLES: raise HTTPException(status_code=400, detail="Role must be admin, member, or viewer.")
    if target_user_id == group.owner_id: raise HTTPException(status_code=400, detail="The group owner must keep the owner role.")
    member = session.scalar(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == target_user_id, GroupMember.status == "active"))
    if member is None: raise HTTPException(status_code=404, detail="The target user is not an active group member.")
    member.role = normalized; session.commit()
    user = session.get(User, member.user_id)
    return {"id": member.id,"group_id": member.group_id,"user_id": member.user_id,"email": member.email,"full_name": user.full_name if user else None,"role": member.role,"status": member.status,"created_at": member.created_at}


def remove_member(session: Session, group_id: UUID, member_id: UUID, user_id: UUID) -> None:
    group, caller_role = get_group_and_role(session, group_id, user_id); require_permission(caller_role, "members", "You do not have permission to remove members.")
    member = session.scalar(select(GroupMember).where(GroupMember.id == member_id, GroupMember.group_id == group_id))
    if member is None: raise HTTPException(status_code=404, detail="Member not found.")
    if member.user_id == group.owner_id: raise HTTPException(status_code=400, detail="The group owner cannot be removed.")
    if caller_role == "admin" and member.role not in {"member", "viewer"}: raise HTTPException(status_code=403, detail="Admins cannot remove owners or other admins.")
    if member.user_id:
        balances = compute_balances(session, group_id); target = next((b for b in balances if b["user_id"] == member.user_id), None)
        if target and abs(target["net_balance"]) > 0.005: raise HTTPException(status_code=409, detail="This member has an outstanding balance and cannot be removed yet.")
    session.delete(member); session.commit()


def leave_group(session: Session, group_id: UUID, user_id: UUID) -> None:
    group, _ = get_group_and_role(session, group_id, user_id)
    if group.owner_id == user_id: raise HTTPException(status_code=400, detail="The group owner cannot leave the group. Delete the group or transfer ownership first.")
    balances = compute_balances(session, group_id, user_id); current = next((b for b in balances if b["user_id"] == user_id), None)
    if current and abs(current["net_balance"]) > 0.005: raise HTTPException(status_code=409, detail="Settle your balance before leaving the group.")
    member = session.scalar(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user_id, GroupMember.status == "active"))
    if member is None: raise HTTPException(status_code=404, detail="Membership not found.")
    session.delete(member); session.commit()


def delete_group(session: Session, group_id: UUID, user_id: UUID) -> None:
    group, role = get_group_and_role(session, group_id, user_id); require_permission(role, "delete_group", "Only the group owner can delete the group."); session.delete(group); session.commit()
