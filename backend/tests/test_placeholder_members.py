from decimal import Decimal
from uuid import UUID

from app.core.security import CurrentUser, get_current_user
from app.main import app
from app.models import Expense, ExpenseSplit, GroupMember, User
from tests.conftest import TestingSessionLocal, USER_A, USER_B, USER_C


def test_batch_add_and_claim_flow(client, seed_users):
    # 1. Create a group as USER_A (owner)
    res = client.post("/api/v1/groups", json={
        "name": "Goa Trip 2026",
        "type": "Trip",
        "currency": "INR",
        "description": "Friends vacation",
    })
    assert res.status_code == 201
    group_id = res.json()["id"]

    # 2. Batch add placeholder members
    batch_res = client.post(f"/api/v1/groups/{group_id}/members/batch", json={
        "names": ["Rahul", "Sneha", "Rohan"],
    })
    assert batch_res.status_code == 201
    batch_data = batch_res.json()
    assert len(batch_data) == 3
    assert {m["display_name"] for m in batch_data} == {"Rahul", "Sneha", "Rohan"}
    assert all(m["is_placeholder"] is True for m in batch_data)

    rahul_member = next(m for m in batch_data if m["display_name"] == "Rahul")
    rahul_member_id = rahul_member["id"]
    rahul_shadow_user_id = rahul_member["user_id"]
    assert rahul_shadow_user_id is not None

    # 3. Check unclaimed members endpoint
    unclaimed_res = client.get(f"/api/v1/groups/{group_id}/members/unclaimed")
    assert unclaimed_res.status_code == 200
    unclaimed = unclaimed_res.json()
    assert len(unclaimed) == 3
    assert any(m["id"] == rahul_member_id for m in unclaimed)

    # 4. Create an expense of 300 paid by USER_A, split equally between USER_A, Rahul, and Sneha
    sneha_member = next(m for m in batch_data if m["display_name"] == "Sneha")
    sneha_shadow_user_id = sneha_member["user_id"]

    expense_res = client.post(f"/api/v1/groups/{group_id}/expenses", json={
        "title": "Beach Dinner",
        "amount": "300.00",
        "paid_by": str(USER_A),
        "split_type": "Equal",
        "category": "Food",
        "splits": [
            {"user_id": str(USER_A), "value": "100.00"},
            {"user_id": str(rahul_shadow_user_id), "value": "100.00"},
            {"user_id": str(sneha_shadow_user_id), "value": "100.00"},
        ],
    })
    assert expense_res.status_code == 201

    # Check balances before claim
    bal_res = client.get(f"/api/v1/groups/{group_id}/balances")
    assert bal_res.status_code == 200
    balances = bal_res.json()
    rahul_bal = next(b for b in balances if b["user_id"] == str(rahul_shadow_user_id))
    assert Decimal(str(rahul_bal["net_balance"])) == Decimal("-100.00")

    # 5. USER_B logs in and claims Rahul's spot!
    user_b_current = CurrentUser(id=USER_B, email="b@example.com", full_name="Rahul Sharma")
    app.dependency_overrides[get_current_user] = lambda: user_b_current

    accept_res = client.post(f"/api/v1/groups/{group_id}/members/accept", json={
        "group_id": group_id,
        "full_name": "Rahul Sharma",
        "claim_member_id": rahul_member_id,
    })
    assert accept_res.status_code == 200

    # 6. Verify membership transferred to USER_B
    members_res = client.get(f"/api/v1/groups/{group_id}/members")
    assert members_res.status_code == 200
    all_members = members_res.json()

    user_b_member = next(m for m in all_members if m["user_id"] == str(USER_B))
    assert user_b_member["is_placeholder"] is False
    assert user_b_member["status"] == "active"

    # Verify shadow user was deleted
    session = TestingSessionLocal()
    shadow_user = session.get(User, UUID(rahul_shadow_user_id))
    assert shadow_user is None
    session.close()

    # 7. Check balances after claim: USER_B now owes 100!
    bal_after = client.get(f"/api/v1/groups/{group_id}/balances")
    assert bal_after.status_code == 200
    b_bal = next(b for b in bal_after.json() if b["user_id"] == str(USER_B))
    assert Decimal(str(b_bal["net_balance"])) == Decimal("-100.00")

    # 8. Unclaimed list should now only have Sneha and Rohan
    unclaimed_after = client.get(f"/api/v1/groups/{group_id}/members/unclaimed").json()
    assert len(unclaimed_after) == 2
    assert not any(m["id"] == rahul_member_id for m in unclaimed_after)

    # 9. Trying to claim Rahul again should 404
    reclaim_res = client.post(f"/api/v1/groups/{group_id}/members/accept", json={
        "group_id": group_id,
        "claim_member_id": rahul_member_id,
    })
    assert reclaim_res.status_code == 404


def test_batch_add_requires_admin_or_owner(client, seed_users):
    # Create group as USER_A
    res = client.post("/api/v1/groups", json={
        "name": "Trip Perm Check",
        "type": "Trip",
        "currency": "INR",
    })
    group_id = res.json()["id"]

    # Switch to USER_C who is not a member yet
    user_c = CurrentUser(id=USER_C, email="c@example.com", full_name="Charlie")
    app.dependency_overrides[get_current_user] = lambda: user_c

    batch_res = client.post(f"/api/v1/groups/{group_id}/members/batch", json={
        "names": ["Someone"],
    })
    assert batch_res.status_code in {403, 404}


def test_claim_when_already_member(client, seed_users):
    # USER_A creates group
    res = client.post("/api/v1/groups", json={
        "name": "Weekend Hike",
        "type": "Friends",
        "currency": "INR",
    })
    group_id = res.json()["id"]

    # USER_A batch-adds placeholder "Alex"
    batch = client.post(f"/api/v1/groups/{group_id}/members/batch", json={"names": ["Alex"]}).json()
    alex_member_id = batch[0]["id"]
    alex_user_id = batch[0]["user_id"]

    # USER_B joins group normally first
    user_b = CurrentUser(id=USER_B, email="b@example.com", full_name="Bob")
    app.dependency_overrides[get_current_user] = lambda: user_b

    join_res = client.post(f"/api/v1/groups/{group_id}/members/accept", json={"group_id": group_id})
    assert join_res.status_code == 200

    # USER_A adds expense where Alex paid 200
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=USER_A, email="a@example.com", full_name="Alice")
    client.post(f"/api/v1/groups/{group_id}/expenses", json={
        "title": "Cabin Booking",
        "amount": "200.00",
        "paid_by": alex_user_id,
        "split_type": "Equal",
        "category": "Stay",
        "splits": [
            {"user_id": str(USER_A), "value": "100.00"},
            {"user_id": alex_user_id, "value": "100.00"},
        ],
    })

    # Now Bob (USER_B) realizes "Hey, I'm Alex! Let me claim Alex's expenses"
    app.dependency_overrides[get_current_user] = lambda: user_b
    claim_res = client.post(f"/api/v1/groups/{group_id}/members/accept", json={
        "group_id": group_id,
        "claim_member_id": alex_member_id,
    })
    assert claim_res.status_code == 200

    # Check that balances transferred to USER_B (Bob is owed 100)
    bal_res = client.get(f"/api/v1/groups/{group_id}/balances").json()
    b_bal = next(b for b in bal_res if b["user_id"] == str(USER_B))
    assert Decimal(str(b_bal["net_balance"])) == Decimal("100.00")

