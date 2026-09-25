from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import and_, case, or_, select, literal
from sqlalchemy.orm import Session

from ..models import Group, GroupMember

ROLE_PERMISSIONS = {
    "owner": {"read", "money", "members", "settings", "roles", "delete_group"},
    "admin": {"read", "money", "members"},
    "member": {"read", "money"},
    "viewer": {"read"},
}


def get_group_and_role(session: Session, group_id: UUID, user_id: UUID) -> tuple[Group, str]:
    """Load group and caller role in one SQL round trip."""
    member_join = and_(
        GroupMember.group_id == Group.id,
        GroupMember.user_id == user_id,
        GroupMember.status == "active",
    )
    role_expr = case(
        (Group.owner_id == user_id, literal("owner")),
        else_=GroupMember.role,
    )
    statement = (
        select(Group, role_expr.label("caller_role"))
        .outerjoin(GroupMember, member_join)
        .where(
            Group.id == group_id,
            or_(Group.owner_id == user_id, GroupMember.id.is_not(None)),
        )
    )
    row = session.execute(statement).first()
    if row is None:
        # Preserve the old distinction between a missing group and an access
        # failure without adding a query on the successful path.
        if session.get(Group, group_id) is None:
            raise HTTPException(status_code=404, detail="Group not found.")
        raise HTTPException(
            status_code=403,
            detail="You are not an active member of this group.",
        )

    group, role = row
    normalized_role = role if role in ROLE_PERMISSIONS else "member"
    return group, normalized_role


def require_permission(role: str, permission: str, message: str) -> None:
    if permission not in ROLE_PERMISSIONS.get(role, set()):
        raise HTTPException(status_code=403, detail=message)
