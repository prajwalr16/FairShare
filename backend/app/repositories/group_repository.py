from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Group, GroupMember, User


def get_group(session: Session, group_id: UUID) -> Group | None:
    return session.get(Group, group_id)


def list_groups_for_user(session: Session, user_id: UUID) -> list[Group]:
    statement = (
        select(Group)
        .outerjoin(GroupMember, GroupMember.group_id == Group.id)
        .where(
            (Group.owner_id == user_id)
            | ((GroupMember.user_id == user_id) & (GroupMember.status == "active"))
        )
        .distinct()
        .order_by(Group.created_at.desc())
    )
    return list(session.scalars(statement).all())


def get_member(session: Session, group_id: UUID, user_id: UUID) -> GroupMember | None:
    return session.scalar(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
        )
    )


def get_member_by_id(session: Session, group_id: UUID, member_id: UUID) -> GroupMember | None:
    return session.scalar(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.id == member_id,
        )
    )


def get_member_by_email(session: Session, group_id: UUID, email: str) -> GroupMember | None:
    return session.scalar(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.email == email,
        )
    )


def list_members(session: Session, group_id: UUID) -> list[GroupMember]:
    return list(
        session.scalars(
            select(GroupMember)
            .where(GroupMember.group_id == group_id)
            .order_by(GroupMember.created_at.asc())
        ).all()
    )


def get_users_by_ids(session: Session, ids: set[UUID]) -> dict[UUID, User]:
    if not ids:
        return {}
    return {user.id: user for user in session.scalars(select(User).where(User.id.in_(ids))).all()}
