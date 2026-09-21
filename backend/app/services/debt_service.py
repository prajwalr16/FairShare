from uuid import UUID

from sqlalchemy.orm import Session

from .balance_service import compute_financial_snapshot
from .permissions import get_group_and_role


def get_group_debts(session: Session, group_id: UUID, user_id: UUID) -> dict:
    get_group_and_role(session, group_id, user_id)
    snapshot = compute_financial_snapshot(
        session,
        group_id,
        current_user_id=user_id,
        check_access=False,
    )
    return {"direct": snapshot["direct"], "simplified": snapshot["simplified"]}
