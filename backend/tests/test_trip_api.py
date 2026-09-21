from uuid import UUID

from tests.conftest import TestingSessionLocal, USER_A, USER_B
from app.models import GroupMember, Trip, TripStop


def create_trip_group(client):
    response = client.post(
        "/api/v1/groups",
        json={
            "name": "Himachal Trip",
            "type": "Trip",
            "currency": "INR",
            "description": "Trip API test",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_non_trip_group(client):
    response = client.post(
        "/api/v1/groups",
        json={
            "name": "Friends",
            "type": "Friends",
            "currency": "INR",
            "description": None,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_trip_crud_and_ordered_stops(client, seed_users):
    group = create_trip_group(client)
    gid = group["id"]

    trip = client.post(
        f"/api/v1/groups/{gid}/trip",
        json={
            "start_date": "2026-10-01",
            "end_date": "2026-10-05",
            "timezone": "Asia/Kolkata",
            "notes": "Mountain ride",
        },
    )
    assert trip.status_code == 201, trip.text
    trip_id = trip.json()["id"]
    assert trip.json()["group_id"] == gid
    assert trip.json()["stops"] == []

    duplicate = client.post(f"/api/v1/groups/{gid}/trip", json={})
    assert duplicate.status_code == 409

    first = client.post(
        f"/api/v1/groups/{gid}/trip/stops",
        json={
            "stop_type": "start",
            "name": "Bengaluru",
            "address": "Bengaluru, Karnataka",
            "latitude": 12.9716,
            "longitude": 77.5946,
        },
    )
    assert first.status_code == 201, first.text
    assert first.json()["day_number"] == 1

    duplicate_start = client.post(
        f"/api/v1/groups/{gid}/trip/stops",
        json={"stop_type": "start", "name": "Mysuru"},
    )
    assert duplicate_start.status_code == 409

    second = client.post(
        f"/api/v1/groups/{gid}/trip/stops",
        json={"stop_type": "stop", "name": "Chikmagalur", "label": "Stay", "day_number": 2},
    )
    assert second.status_code == 201
    assert second.json()["day_number"] == 2

    third = client.post(
        f"/api/v1/groups/{gid}/trip/stops",
        json={"stop_type": "destination", "name": "Goa", "day_number": 5},
    )
    assert third.status_code == 201
    assert third.json()["day_number"] == 5

    invalid_day = client.post(
        f"/api/v1/groups/{gid}/trip/stops",
        json={"stop_type": "stop", "name": "Beyond the trip", "day_number": 6},
    )
    assert invalid_day.status_code == 422
    assert "6-day" not in invalid_day.text

    current = client.get(f"/api/v1/groups/{gid}/trip")
    assert current.status_code == 200
    assert [stop["sequence"] for stop in current.json()["stops"]] == [0, 1, 2]
    assert [stop["day_number"] for stop in current.json()["stops"]] == [1, 2, 5]

    stop_ids = [third.json()["id"], first.json()["id"], second.json()["id"]]
    reordered = client.put(
        f"/api/v1/groups/{gid}/trip/stops/reorder",
        json={"stop_ids": stop_ids},
    )
    assert reordered.status_code == 200, reordered.text
    assert [row["id"] for row in reordered.json()] == [first.json()["id"], second.json()["id"], third.json()["id"]]
    assert [row["sequence"] for row in reordered.json()] == [1, 2, 0]

    updated_stop = client.patch(
        f"/api/v1/groups/{gid}/trip/stops/{first.json()['id']}",
        json={
            "stop_type": "stop",
            "name": "Bengaluru Airport",
            "address": "Kempegowda International Airport",
            "day_number": 1,
        },
    )
    assert updated_stop.status_code == 200
    assert updated_stop.json()["name"] == "Bengaluru Airport"
    assert updated_stop.json()["day_number"] == 1

    updated_trip = client.patch(
        f"/api/v1/groups/{gid}/trip",
        json={
            "start_date": "2026-10-02",
            "end_date": "2026-10-06",
            "timezone": "Asia/Kolkata",
            "notes": "Updated plan",
        },
    )
    assert updated_trip.status_code == 200
    assert updated_trip.json()["notes"] == "Updated plan"

    listed = client.get(f"/api/v1/groups/{gid}/trip/stops")
    assert listed.status_code == 200
    assert len(listed.json()) == 3

    removed = client.delete(f"/api/v1/groups/{gid}/trip/stops/{second.json()['id']}")
    assert removed.status_code == 204
    after_remove = client.get(f"/api/v1/groups/{gid}/trip")
    assert [row["sequence"] for row in after_remove.json()["stops"]] == [0, 1]

    deleted = client.delete(f"/api/v1/groups/{gid}/trip")
    assert deleted.status_code == 204
    missing = client.get(f"/api/v1/groups/{gid}/trip")
    assert missing.status_code == 404

    session = TestingSessionLocal()
    assert session.query(Trip).filter(Trip.id == UUID(trip_id)).first() is None
    assert session.query(TripStop).filter(TripStop.trip_id == UUID(trip_id)).first() is None
    session.close()


def test_trip_rejects_stop_day_outside_date_range(client, seed_users):
    group = create_trip_group(client)
    gid = group["id"]

    created = client.post(
        f"/api/v1/groups/{gid}/trip",
        json={"start_date": "2026-10-10", "end_date": "2026-10-12"},
    )
    assert created.status_code == 201

    response = client.post(
        f"/api/v1/groups/{gid}/trip/stops",
        json={"name": "Day four", "day_number": 4},
    )
    assert response.status_code == 422
    assert "Day 4" in response.json()["detail"]


def test_trip_blocks_shortening_below_existing_stop_day(client, seed_users):
    group = create_trip_group(client)
    gid = group["id"]

    created = client.post(
        f"/api/v1/groups/{gid}/trip",
        json={"start_date": "2026-10-01", "end_date": "2026-10-05"},
    )
    assert created.status_code == 201

    stop = client.post(
        f"/api/v1/groups/{gid}/trip/stops",
        json={"name": "Day five", "day_number": 5},
    )
    assert stop.status_code == 201

    shortened = client.patch(
        f"/api/v1/groups/{gid}/trip",
        json={"start_date": "2026-10-01", "end_date": "2026-10-04"},
    )
    assert shortened.status_code == 409
    assert "Move itinerary stops" in shortened.json()["detail"]


def test_trip_only_available_for_trip_groups(client, seed_users):
    group = create_non_trip_group(client)
    gid = group["id"]

    response = client.get(f"/api/v1/groups/{gid}/trip")
    assert response.status_code == 409

    response = client.post(f"/api/v1/groups/{gid}/trip", json={})
    assert response.status_code == 409


def test_viewer_can_read_but_cannot_edit_trip(client, seed_users):
    group = create_trip_group(client)
    gid = group["id"]

    created = client.post(f"/api/v1/groups/{gid}/trip", json={})
    assert created.status_code == 201

    session = TestingSessionLocal()
    session.add(GroupMember(group_id=UUID(gid), user_id=USER_B, email="b@example.com", role="viewer", status="active"))
    session.commit()
    session.close()

    from app.core.security import CurrentUser, get_current_user
    from app.main import app

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=USER_B, email="b@example.com", full_name="B")
    try:
        visible = client.get(f"/api/v1/groups/{gid}/trip")
        assert visible.status_code == 200

        blocked = client.patch(f"/api/v1/groups/{gid}/trip", json={"notes": "blocked"})
        assert blocked.status_code == 403

        blocked_stop = client.post(
            f"/api/v1/groups/{gid}/trip/stops",
            json={"name": "Mysuru"},
        )
        assert blocked_stop.status_code == 403
    finally:
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=USER_A, email="a@example.com", full_name="A")
