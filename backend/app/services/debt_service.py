from uuid import UUID
from sqlalchemy.orm import Session
from .balance_service import compute_balances, compute_pair_debts, simplify_balances
from .permissions import get_group_and_role


def get_group_debts(session: Session, group_id: UUID, user_id: UUID) -> dict:
    get_group_and_role(session, group_id, user_id)
    balances = compute_balances(session, group_id, user_id)
    direct = compute_pair_debts(session, group_id)
    simplified = simplify_balances(balances)
    return {"direct": direct, "simplified": simplified}
