from uuid import UUID

from tests.conftest import USER_B, USER_C, TestingSessionLocal
from app.models import GroupMember


def _add_members(group_id: str):
    session = TestingSessionLocal()
    group_uuid = UUID(str(group_id))
    session.add_all([
        GroupMember(group_id=group_uuid, user_id=USER_B, email="b@example.com", role="member", status="active"),
        GroupMember(group_id=group_uuid, user_id=USER_C, email="c@example.com", role="member", status="active"),
    ])
    session.commit()
    session.close()


def test_group_overview_bootstrap_returns_compact_snapshot(client, seed_users):
    created = client.post("/api/v1/groups", json={"name": "Overview Group", "type": "Friends", "currency": "INR"})
    assert created.status_code == 201
    group_id = created.json()["id"]
    _add_members(group_id)

    expense = client.post(
        f"/api/v1/groups/{group_id}/expenses",
        json={
            "title": "Dinner",
            "amount": "900",
            "paid_by": "11111111-1111-1111-1111-111111111111",
            "split_type": "Exact",
            "splits": [
                {"user_id": "11111111-1111-1111-1111-111111111111", "value": "300"},
                {"user_id": "22222222-2222-2222-2222-222222222222", "value": "300"},
                {"user_id": "33333333-3333-3333-3333-333333333333", "value": "300"},
            ],
        },
    )
    assert expense.status_code == 201, expense.text

    response = client.get(f"/api/v1/groups/{group_id}/overview")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["role"] == "owner"
    assert payload["current_user_balance"]["net_balance"] == "600.00"
    assert len(payload["recent_expenses"]) == 1
    assert len(payload["top_debts"]) == 2


def test_group_financial_endpoint_returns_balances_and_debts(client, seed_users):
    created = client.post("/api/v1/groups", json={"name": "Financial Group", "type": "Friends", "currency": "INR"})
    assert created.status_code == 201
    group_id = created.json()["id"]
    _add_members(group_id)

    response = client.post(
        f"/api/v1/groups/{group_id}/expenses",
        json={
            "title": "Fuel",
            "amount": "300",
            "paid_by": "11111111-1111-1111-1111-111111111111",
            "split_type": "Exact",
            "splits": [
                {"user_id": "11111111-1111-1111-1111-111111111111", "value": "100"},
                {"user_id": "22222222-2222-2222-2222-222222222222", "value": "100"},
                {"user_id": "33333333-3333-3333-3333-333333333333", "value": "100"},
            ],
        },
    )
    assert response.status_code == 201, response.text

    financial = client.get(f"/api/v1/groups/{group_id}/financial")
    assert financial.status_code == 200, financial.text
    payload = financial.json()
    assert len(payload["balances"]) == 3
    assert len(payload["direct"]) == 2
    assert len(payload["simplified"]) == 2
