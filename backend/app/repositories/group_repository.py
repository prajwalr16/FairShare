from __future__ import annotations

from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..models import Group, GroupMember, User


def get_group(session: Session, group_id: UUID) -> Group | None:
    return session.get(Group, group_id)


def list_groups_for_user(session: Session, user_id: UUID) -> list[Group]:
    # Avoid the old outer-join + DISTINCT plan. A membership subquery lets
    # PostgreSQL use the existing group_members(group_id/user_id) indexes and
    # returns each group once without materializing duplicate joined rows.
    member_group_ids = select(GroupMember.group_id).where(
        GroupMember.user_id == user_id,
        GroupMember.status == "active",
    )
    statement = (
        select(Group)
        .where(
            or_(
                Group.owner_id == user_id,
                Group.id.in_(member_group_ids),
            )
        )
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
