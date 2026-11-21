from uuid import UUID, uuid4
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import Session

from ..models.checklist import TripChecklist, TripChecklistUserStatus
from ..models.user import User
from ..models.group_member import GroupMember
from ..schemas.checklist import (
    CHECKLIST_CATEGORIES,
    ChecklistItemCreate,
    ChecklistBatchImportItem,
    ChecklistItemOut,
    ChecklistSummary,
)
from .permissions import get_group_and_role, require_permission


def get_group_checklists(
    session: Session,
    group_id: UUID,
    user_id: UUID,
) -> ChecklistSummary:
    get_group_and_role(session, group_id, user_id)

    # 1. Personal items: visible to all (if not private) OR private only to creator
    personal_stmt = (
        select(TripChecklist, TripChecklistUserStatus.is_packed)
        .outerjoin(
            TripChecklistUserStatus,
            and_(
                TripChecklistUserStatus.checklist_id == TripChecklist.id,
                TripChecklistUserStatus.user_id == user_id,
            ),
        )
        .where(
            TripChecklist.group_id == group_id,
            TripChecklist.scope == "personal",
            or_(
                TripChecklist.is_private.is_(False),
                TripChecklist.created_by == user_id,
            ),
        )
        .order_by(TripChecklist.category.asc(), TripChecklist.created_at.asc())
    )
    personal_rows = session.execute(personal_stmt).all()

    personal_items = []
    personal_packed_count = 0
    for item, is_packed in personal_rows:
        packed = bool(is_packed)
        if packed:
            personal_packed_count += 1
        personal_items.append(
            ChecklistItemOut(
                id=item.id,
                group_id=item.group_id,
                created_by=item.created_by,
                title=item.title,
                category=item.category,
                scope=item.scope,
                is_private=item.is_private,
                assigned_to=None,
                assigned_name=None,
                is_packed=packed,
                created_at=item.created_at,
            )
        )

    # 2. Group items: all group members see them
    group_stmt = (
        select(
            TripChecklist,
            User.full_name,
            User.email,
        )
        .outerjoin(User, User.id == TripChecklist.assigned_to)
        .where(
            TripChecklist.group_id == group_id,
            TripChecklist.scope == "group",
        )
        .order_by(TripChecklist.category.asc(), TripChecklist.created_at.asc())
    )
    group_rows = session.execute(group_stmt).all()

    group_items = []
    group_packed_count = 0
    for item, full_name, email in group_rows:
        packed = bool(item.is_packed_group)
        if packed:
            group_packed_count += 1
        assigned_label = full_name or email or None
        group_items.append(
            ChecklistItemOut(
                id=item.id,
                group_id=item.group_id,
                created_by=item.created_by,
                title=item.title,
                category=item.category,
                scope=item.scope,
                is_private=False,
                assigned_to=item.assigned_to,
                assigned_name=assigned_label,
                is_packed=packed,
                created_at=item.created_at,
            )
        )

    return ChecklistSummary(
        personal=personal_items,
        group=group_items,
        personal_total=len(personal_items),
        personal_packed=personal_packed_count,
        group_total=len(group_items),
        group_packed=group_packed_count,
    )


def create_checklist_item(
    session: Session,
    group_id: UUID,
    user_id: UUID,
    payload: ChecklistItemCreate,
) -> TripChecklist:
    _, role = get_group_and_role(session, group_id, user_id)
    require_permission(role, "money", "Viewers cannot add checklist items.")

    clean_title = payload.title.strip()
    if not clean_title:
        raise HTTPException(status_code=400, detail="Item title is required.")

    clean_category = payload.category.strip().title() if payload.category else "General"
    clean_scope = "group" if payload.scope.lower() == "group" else "personal"
    is_private = bool(payload.is_private) if clean_scope == "personal" else False

    item = TripChecklist(
        id=uuid4(),
        group_id=group_id,
        created_by=user_id,
        title=clean_title,
        category=clean_category,
        scope=clean_scope,
        is_private=is_private,
        assigned_to=payload.assigned_to if clean_scope == "group" else None,
        is_packed_group=False,
    )
    session.add(item)
    session.commit()
    return item


def batch_import_checklist_items(
    session: Session,
    group_id: UUID,
    user_id: UUID,
    items: list[ChecklistBatchImportItem],
) -> int:
    _, role = get_group_and_role(session, group_id, user_id)
    require_permission(role, "money", "Viewers cannot import checklist items.")

    added_count = 0
    for it in items:
        clean_title = it.title.strip()
        if not clean_title:
            continue
        clean_category = it.category.strip().title() if it.category else "General"
        clean_scope = "group" if it.scope.lower() == "group" else "personal"
        is_priv = bool(it.is_private) if clean_scope == "personal" else False

        item = TripChecklist(
            id=uuid4(),
            group_id=group_id,
            created_by=user_id,
            title=clean_title,
            category=clean_category,
            scope=clean_scope,
            is_private=is_priv,
            is_packed_group=False,
        )
        session.add(item)
        added_count += 1

    session.commit()
    return added_count


def toggle_checklist_status(
    session: Session,
    group_id: UUID,
    checklist_id: UUID,
    user_id: UUID,
) -> bool:
    get_group_and_role(session, group_id, user_id)

    item = session.scalar(
        select(TripChecklist).where(
            TripChecklist.id == checklist_id,
            TripChecklist.group_id == group_id,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found.")

    if item.scope == "personal":
        # Check personal status
        status = session.scalar(
            select(TripChecklistUserStatus).where(
                TripChecklistUserStatus.checklist_id == checklist_id,
                TripChecklistUserStatus.user_id == user_id,
            )
        )
        if status:
            status.is_packed = not status.is_packed
            status.packed_at = datetime.now(timezone.utc)
            new_val = status.is_packed
        else:
            status = TripChecklistUserStatus(
                id=uuid4(),
                checklist_id=checklist_id,
                user_id=user_id,
                is_packed=True,
            )
            session.add(status)
            new_val = True

        session.commit()
        return new_val
    else:
        # Group item: group-wide pack toggle
        item.is_packed_group = not item.is_packed_group
        session.commit()
        return item.is_packed_group


def assign_checklist_item(
    session: Session,
    group_id: UUID,
    checklist_id: UUID,
    user_id: UUID,
    assigned_to: UUID | None,
) -> TripChecklist:
    get_group_and_role(session, group_id, user_id)

    item = session.scalar(
        select(TripChecklist).where(
            TripChecklist.id == checklist_id,
            TripChecklist.group_id == group_id,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found.")

    if item.scope != "group":
        raise HTTPException(status_code=400, detail="Only group items can be assigned.")

    if assigned_to is not None:
        # Verify assignee is active group member
        is_member = session.scalar(
            select(GroupMember.id).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == assigned_to,
                GroupMember.status == "active",
            )
        )
        if not is_member:
            raise HTTPException(status_code=400, detail="Assignee is not an active member.")

    item.assigned_to = assigned_to
    session.commit()
    return item


def update_checklist_item(
    session: Session,
    group_id: UUID,
    checklist_id: UUID,
    user_id: UUID,
    title: str | None = None,
    category: str | None = None,
    scope: str | None = None,
    is_private: bool | None = None,
    assigned_to: UUID | None = None,
    assigned_to_provided: bool = False,
) -> TripChecklist:
    _, role = get_group_and_role(session, group_id, user_id)
    require_permission(role, "money", "Viewers cannot edit checklist items.")

    item = session.scalar(
        select(TripChecklist).where(
            TripChecklist.id == checklist_id,
            TripChecklist.group_id == group_id,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found.")

    if item.is_private and item.created_by != user_id:
        raise HTTPException(status_code=403, detail="You do not have permission to edit this private item.")

    if title is not None:
        cleaned = title.strip()
        if not cleaned:
            raise HTTPException(status_code=400, detail="Title cannot be empty.")
        item.title = cleaned

    if category is not None:
        cat = category.strip()
        item.category = cat if cat in CHECKLIST_CATEGORIES else "General"

    if scope is not None:
        sc = scope.strip().lower()
        if sc in {"personal", "group"}:
            item.scope = sc
            if sc == "personal":
                item.assigned_to = None

    if is_private is not None:
        item.is_private = bool(is_private) and (item.scope == "personal")

    if assigned_to_provided and item.scope == "group":
        if assigned_to is not None:
            is_member = session.scalar(
                select(GroupMember.id).where(
                    GroupMember.group_id == group_id,
                    GroupMember.user_id == assigned_to,
                    GroupMember.status == "active",
                )
            )
            if not is_member:
                raise HTTPException(status_code=400, detail="Assignee is not an active member.")
        item.assigned_to = assigned_to

    session.commit()
    return item


def delete_checklist_item(
    session: Session,
    group_id: UUID,
    checklist_id: UUID,
    user_id: UUID,
) -> None:
    _, role = get_group_and_role(session, group_id, user_id)
    require_permission(role, "money", "Viewers cannot delete checklist items.")

    item = session.scalar(
        select(TripChecklist).where(
            TripChecklist.id == checklist_id,
            TripChecklist.group_id == group_id,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found.")

    # Private items can only be deleted by their creator
    if item.is_private and item.created_by != user_id:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this private item.")

    session.delete(item)
    session.commit()
