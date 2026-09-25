import os

from sqlalchemy import select

from app.models import Expense, Group
from tests.conftest import TestingSessionLocal, USER_A


def test_group_delete_with_expense_cascades_on_postgres(client, seed_users):
    # This regression specifically covers PostgreSQL's FK ON DELETE CASCADE,
    # which invokes the expense trigger at a nested trigger depth.
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

    expense = client.post(
        f"/api/v1/groups/{group_id}/expenses",
        json={
            "title": "Cascade Expense",
            "amount": "100",
            "paid_by": str(USER_A),
            "split_type": "Equal",
            "splits": [{"user_id": str(USER_A), "value": "0"}],
        },
    )
    assert expense.status_code == 201, expense.text
    expense_id = expense.json()["id"]

    deleted = client.delete(f"/api/v1/groups/{group_id}")
    assert deleted.status_code == 204, deleted.text

    session = TestingSessionLocal()
    try:
        assert session.scalar(select(Group).where(Group.id == group_id)) is None
        assert session.scalar(select(Expense).where(Expense.id == expense_id)) is None
    finally:
        session.close()
