from __future__ import annotations

import logging
from decimal import Decimal
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Group, GroupMember, PushToken, User

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def register_push_token(session: Session, user_id: UUID, token: str, platform: str | None = None) -> PushToken:
    clean_token = token.strip()
    existing = session.scalar(select(PushToken).where(PushToken.token == clean_token))
    if existing:
        existing.user_id = user_id
        if platform:
            existing.platform = platform.strip().lower()
        session.commit()
        session.refresh(existing)
        return existing

    push_token = PushToken(user_id=user_id, token=clean_token, platform=platform.strip().lower() if platform else None)
    session.add(push_token)
    session.commit()
    session.refresh(push_token)
    return push_token


def _send_expo_batch(messages: list[dict]) -> None:
    if not messages:
        return
    try:
        with httpx.Client(timeout=4.0) as client:
            resp = client.post(EXPO_PUSH_URL, json=messages)
            if resp.status_code >= 400:
                logger.warning("Expo push failed with status %s: %s", resp.status_code, resp.text)
    except Exception as exc:
        logger.warning("Expo push exception: %s", exc)


def notify_group_expense(
    session: Session,
    group_id: UUID,
    payer_id: UUID,
    payer_name: str | None,
    expense_title: str,
    amount: Decimal | float | int,
    currency: str = "INR",
) -> None:
    try:
        group = session.get(Group, group_id)
        group_name = group.name if group else "Group"
        sender_label = payer_name.strip() if payer_name and payer_name.strip() else "A member"

        # Find other active members in this group
        other_members = session.scalars(
            select(GroupMember.user_id).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id.is_not(None),
                GroupMember.user_id != payer_id,
                GroupMember.status == "active",
            )
        ).all()
        recipient_user_ids = [uid for uid in other_members if uid]
        if not recipient_user_ids:
            return

        tokens = session.scalars(
            select(PushToken.token).where(PushToken.user_id.in_(recipient_user_ids))
        ).all()
        if not tokens:
            return

        formatted_amount = f"{currency} {Decimal(amount):,.2f}"
        title = f"{group_name} • New Expense"
        body = f"{sender_label} added '{expense_title}' ({formatted_amount})"

        messages = [
            {
                "to": tok,
                "sound": "default",
                "title": title,
                "body": body,
                "data": {"groupId": str(group_id), "type": "expense"},
            }
            for tok in tokens
        ]
        _send_expo_batch(messages)
    except Exception as exc:
        logger.warning("Error sending group expense notification: %s", exc)


def notify_settlement(
    session: Session,
    group_id: UUID,
    from_user_id: UUID,
    payer_name: str | None,
    to_user_id: UUID,
    amount: Decimal | float | int,
    currency: str = "INR",
) -> None:
    try:
        group = session.get(Group, group_id)
        group_name = group.name if group else "Group"
        sender_label = payer_name.strip() if payer_name and payer_name.strip() else "Someone"

        tokens = session.scalars(
            select(PushToken.token).where(PushToken.user_id == to_user_id)
        ).all()
        if not tokens:
            return

        formatted_amount = f"{currency} {Decimal(amount):,.2f}"
        title = f"{group_name} • Payment Received"
        body = f"{sender_label} paid you {formatted_amount}"

        messages = [
            {
                "to": tok,
                "sound": "default",
                "title": title,
                "body": body,
                "data": {"groupId": str(group_id), "type": "settlement"},
            }
            for tok in tokens
        ]
        _send_expo_batch(messages)
    except Exception as exc:
        logger.warning("Error sending settlement notification: %s", exc)
