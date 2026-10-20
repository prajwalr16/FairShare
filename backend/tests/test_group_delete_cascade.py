import os

from sqlalchemy import select

from app.models import Expense, Group, Settlement
from tests.conftest import TestingSessionLocal, USER_A, USER_B


def test_group_delete_with_expense_and_settlement_cascades_on_postgres(client, seed_users):
    # This regression specifically covers PostgreSQL's FK ON DELETE CASCADE,
    # which invokes both expense and settlement triggers at a nested trigger depth.
    if not os.getenv("FAIRSHARE_TEST_DATABASE_URL", "").startswith("postgresql"):
        return

    created = client.post(
        "/api/v1/groups",
        json={
            "name": "Cascade Delete Test",
            "type": "Friends",
            "currency": "INR",
            "description": None,
        },
    )
    assert created.status_code == 201, created.text
    group_id = created.json()["id"]

    invited = client.post(
        f"/api/v1/groups/{group_id}/members/invite",
        json={"email": "b@example.com"},
    )
    assert invited.status_code == 200, invited.text

    expense = client.post(
        f"/api/v1/groups/{group_id}/expenses",
        json={
            "title": "Cascade Expense",
            "amount": "100",
            "paid_by": str(USER_A),
            "split_type": "Equal",
            "splits": [
                {"user_id": str(USER_A), "value": "0"},
                {"user_id": str(USER_B), "value": "0"},
            ],
        },
    )
    assert expense.status_code == 201, expense.text
    expense_id = expense.json()["id"]

    settlement = client.post(
        f"/api/v1/groups/{group_id}/settlements",
        json={
            "from_user_id": str(USER_B),
            "to_user_id": str(USER_A),
            "amount": "50.00",
            "note": "Cascade settlement test",
        },
    )
    assert settlement.status_code == 201, settlement.text
    settlement_id = settlement.json()["id"]

    deleted = client.delete(f"/api/v1/groups/{group_id}")
    assert deleted.status_code == 204, deleted.text

    session = TestingSessionLocal()
    try:
        assert session.scalar(select(Group).where(Group.id == group_id)) is None
        assert session.scalar(select(Expense).where(Expense.id == expense_id)) is None
        assert session.scalar(select(Settlement).where(Settlement.id == settlement_id)) is None
    finally:
        session.close()
