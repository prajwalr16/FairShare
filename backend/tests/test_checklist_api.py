from uuid import UUID
from .conftest import USER_A, USER_B, USER_C


def create_group(client):
    response = client.post(
        "/api/v1/groups",
        json={"name": "Checklist Test Group", "category": "Trip", "currency": "INR"},
    )
    assert response.status_code == 201
    return response.json()


def add_members(client, group_id):
    client.post(f"/api/v1/groups/{group_id}/members/batch", json={"names": ["Sneha", "Amit"]})


def test_checklist_personal_and_group_workflow(client, seed_users):
    group = create_group(client)
    gid = group["id"]

    # 1. User A creates a public personal item
    res = client.post(
        f"/api/v1/groups/{gid}/checklists",
        json={
            "title": "Sunscreen SPF 50",
            "category": "Toiletries",
            "scope": "personal",
            "is_private": False,
        },
    )
    assert res.status_code == 201
    sunscreen_id = res.json()["id"]

    # 2. User A creates a private personal item
    res = client.post(
        f"/api/v1/groups/{gid}/checklists",
        json={
            "title": "Private Medication",
            "category": "Medical",
            "scope": "personal",
            "is_private": True,
        },
    )
    assert res.status_code == 201
    med_id = res.json()["id"]

    # 3. User A creates a group gear item
    res = client.post(
        f"/api/v1/groups/{gid}/checklists",
        json={
            "title": "Bluetooth Speaker",
            "category": "Electronics",
            "scope": "group",
            "is_private": False,
            "assigned_to": str(USER_A),
        },
    )
    assert res.status_code == 201
    speaker_id = res.json()["id"]

    # 4. User A reads checklists: sees both sunscreen, private medication, and group speaker
    summary_a = client.get(f"/api/v1/groups/{gid}/checklists").json()
    assert summary_a["personal_total"] == 2
    assert summary_a["group_total"] == 1
    assert any(i["title"] == "Private Medication" for i in summary_a["personal"])

    # 5. User A toggles sunscreen packed status
    toggle_res = client.patch(f"/api/v1/groups/{gid}/checklists/{sunscreen_id}/toggle")
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_packed"] is True

    # 6. Verify User A shows 1 packed personal item
    summary_a_after = client.get(f"/api/v1/groups/{gid}/checklists").json()
    assert summary_a_after["personal_packed"] == 1

    # 7. Batch import items
    import_res = client.post(
        f"/api/v1/groups/{gid}/checklists/import",
        json={
            "items": [
                {"title": "Passport / ID", "category": "Documents", "scope": "personal"},
                {"title": "First Aid Kit", "category": "Medical", "scope": "group"},
            ]
        },
    )
    assert import_res.status_code == 200
    assert import_res.json()["imported"] == 2

    # 8. Check final totals
    final_summary = client.get(f"/api/v1/groups/{gid}/checklists").json()
    assert final_summary["personal_total"] == 3
    assert final_summary["group_total"] == 2

    # 9. Delete item
    del_res = client.delete(f"/api/v1/groups/{gid}/checklists/{sunscreen_id}")
    assert del_res.status_code == 204


def test_checklist_privacy_and_cross_member_isolation(client, seed_users):
    group = create_group(client)
    gid = group["id"]

    # Add USER_B as active member
    from app.models import GroupMember
    from .conftest import TestingSessionLocal
    session = TestingSessionLocal()
    session.add(GroupMember(group_id=UUID(gid), user_id=USER_B, email="b@example.com", role="member", status="active"))
    session.commit()
    session.close()

    # User A creates a public item and a private item
    res_pub = client.post(
        f"/api/v1/groups/{gid}/checklists",
        json={"title": "Camera & Tripod", "category": "Electronics", "scope": "personal", "is_private": False},
    )
    assert res_pub.status_code == 201
    pub_id = res_pub.json()["id"]

    res_priv = client.post(
        f"/api/v1/groups/{gid}/checklists",
        json={"title": "Private Diary", "category": "General", "scope": "personal", "is_private": True},
    )
    assert res_priv.status_code == 201

    # Switch to User B
    from app.core.security import CurrentUser, get_current_user
    from app.main import app

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=USER_B, email="b@example.com", full_name="User B")
    try:
        summary_b = client.get(f"/api/v1/groups/{gid}/checklists").json()
        personal_titles = [item["title"] for item in summary_b["personal"]]

        # User B should see public item, but NOT User A's private diary
        assert "Camera & Tripod" in personal_titles
        assert "Private Diary" not in personal_titles

        # User B toggles public item -> User B packed status becomes True
        toggle_res = client.patch(f"/api/v1/groups/{gid}/checklists/{pub_id}/toggle")
        assert toggle_res.status_code == 200
        assert toggle_res.json()["is_packed"] is True

        summary_b_after = client.get(f"/api/v1/groups/{gid}/checklists").json()
        assert summary_b_after["personal_packed"] == 1
    finally:
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=USER_A, email="a@example.com", full_name="User A")

    # User A checks their own status -> User A is still unpacked (independent ticks)
    summary_a = client.get(f"/api/v1/groups/{gid}/checklists").json()
    assert summary_a["personal_packed"] == 0


def test_checklist_group_assignment_and_shared_packing(client, seed_users):
    group = create_group(client)
    gid = group["id"]

    # Add USER_B as member
    from app.models import GroupMember
    from .conftest import TestingSessionLocal
    session = TestingSessionLocal()
    session.add(GroupMember(group_id=UUID(gid), user_id=USER_B, email="b@example.com", role="member", status="active"))
    session.commit()
    session.close()

    # User A creates a group gear item (unassigned)
    res = client.post(
        f"/api/v1/groups/{gid}/checklists",
        json={"title": "Camping Tent (4-person)", "category": "Gear", "scope": "group", "is_private": False},
    )
    assert res.status_code == 201
    tent_id = res.json()["id"]

    # User B assigns the tent to themselves
    from app.core.security import CurrentUser, get_current_user
    from app.main import app

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=USER_B, email="b@example.com", full_name="User B")
    try:
        assign_res = client.patch(
            f"/api/v1/groups/{gid}/checklists/{tent_id}/assign",
            json={"assigned_to": str(USER_B)},
        )
        assert assign_res.status_code == 200
        assert assign_res.json() == {"status": "ok"}

        # User B toggles it packed
        toggle_res = client.patch(f"/api/v1/groups/{gid}/checklists/{tent_id}/toggle")
        assert toggle_res.status_code == 200
        assert toggle_res.json()["is_packed"] is True
    finally:
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=USER_A, email="a@example.com", full_name="User A")

    # User A views checklist -> Tent is marked packed for everyone in the group
    summary_a = client.get(f"/api/v1/groups/{gid}/checklists").json()
    tent_item = next(item for item in summary_a["group"] if item["id"] == tent_id)
    assert tent_item["is_packed"] is True
    assert tent_item["assigned_to"] == str(USER_B)


def test_checklist_update_item_and_unassign(client, seed_users):
    group = create_group(client)
    gid = group["id"]

    # 1. Create a group item
    res = client.post(
        f"/api/v1/groups/{gid}/checklists",
        json={"title": "Solar Lantern", "category": "Gear", "scope": "group", "is_private": False},
    )
    assert res.status_code == 201
    item_id = res.json()["id"]

    # 2. Assign to User A
    client.patch(f"/api/v1/groups/{gid}/checklists/{item_id}/assign", json={"assigned_to": str(USER_A)})

    # 3. Unassign (set assigned_to = None)
    unassign_res = client.patch(
        f"/api/v1/groups/{gid}/checklists/{item_id}/assign",
        json={"assigned_to": None},
    )
    assert unassign_res.status_code == 200

    # Verify unassigned in summary
    summary = client.get(f"/api/v1/groups/{gid}/checklists").json()
    item = next(i for i in summary["group"] if i["id"] == item_id)
    assert item["assigned_to"] is None

    # 4. Full update of any feature: title, category, scope, is_private
    update_res = client.patch(
        f"/api/v1/groups/{gid}/checklists/{item_id}",
        json={
            "title": "Rechargeable LED Emergency Light",
            "category": "Electronics",
            "scope": "personal",
            "is_private": True,
        },
    )
    assert update_res.status_code == 200
    up_data = update_res.json()
    assert up_data["title"] == "Rechargeable LED Emergency Light"
    assert up_data["category"] == "Electronics"
    assert up_data["scope"] == "personal"
    assert up_data["is_private"] is True

    # 5. Verify it now appears in personal list
    summary_after = client.get(f"/api/v1/groups/{gid}/checklists").json()
    assert any(i["title"] == "Rechargeable LED Emergency Light" for i in summary_after["personal"])
    assert not any(i["id"] == item_id for i in summary_after["group"])


