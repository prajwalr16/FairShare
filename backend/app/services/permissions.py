from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Group, GroupMember

ROLE_PERMISSIONS = {
    "owner": {"read", "money", "members", "settings", "roles", "delete_group"},
    "admin": {"read", "money", "members"},
    "member": {"read", "money"},
    "viewer": {"read"},
}


def get_group_and_role(session: Session, group_id: UUID, user_id: UUID) -> tuple[Group, str]:
    group = session.get(Group, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found.")
    if group.owner_id == user_id:
        return group, "owner"
    member = session.scalar(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
            GroupMember.status == "active",
        )
    )
    if member is None:
        raise HTTPException(status_code=403, detail="You are not an active member of this group.")
    return group, member.role if member.role in ROLE_PERMISSIONS else "member"


def require_permission(role: str, permission: str, message: str) -> None:
    if permission not in ROLE_PERMISSIONS.get(role, set()):
        raise HTTPException(status_code=403, detail=message)
