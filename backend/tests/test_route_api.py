
from uuid import UUID

from app.services.route_service import _request_route
from tests.conftest import TestingSessionLocal, USER_B, USER_C


def _add_members(group_id: str):
    from app.models import GroupMember

    session = TestingSessionLocal()
    session.add_all([
        GroupMember(group_id=UUID(group_id), user_id=USER_B, email='b@example.com', role='member', status='active'),
        GroupMember(group_id=UUID(group_id), user_id=USER_C, email='c@example.com', role='member', status='active'),
    ])
    session.commit()
    session.close()


def _create_trip(client):
    group = client.post('/api/v1/groups', json={
        'name': 'Route Trip',
        'type': 'Trip',
        'currency': 'INR',
        'description': 'Route test',
    })
    assert group.status_code == 201, group.text
    gid = group.json()['id']
    _add_members(gid)
    trip = client.post(f'/api/v1/groups/{gid}/trip', json={
        'start_date': '2026-10-01',
        'end_date': '2026-10-04',
        'timezone': 'Asia/Kolkata',
        'notes': 'Route test',
    })
    assert trip.status_code == 201, trip.text
    return gid


def _leg(a, b, distance=100.0, duration=60.0):
    return {
        'from_stop_id': a,
        'to_stop_id': b,
        'points': [
            {'latitude': 12.0, 'longitude': 77.0},
            {'latitude': 12.1, 'longitude': 77.1},
        ],
        'distance_meters': distance,
        'duration_seconds': duration,
        'status': 'routed',
        'routed': True,
        'fallback': False,
    }


def test_trip_route_returns_exactly_n_minus_1_legs(client, seed_users, monkeypatch):
    gid = _create_trip(client)
    coords = [
        (12.9716, 77.5946),
        (13.0827, 80.2707),
        (11.0168, 76.9558),
    ]

    for index, (lat, lon) in enumerate(coords):
        stop_type = 'start' if index == 0 else 'destination' if index == 2 else 'stop'
        response = client.post(
            f'/api/v1/groups/{gid}/trip/stops',
            json={
                'stop_type': stop_type,
                'name': f'Stop {index + 1}',
                'day_number': 1,
                'latitude': lat,
                'longitude': lon,
            },
        )
        assert response.status_code == 201, response.text

    _request_route.cache_clear()

    monkeypatch.setattr(
        'app.services.route_service._request_route',
        lambda coordinates: {
            'distance_meters': 501234.5,
            'duration_seconds': 28800.0,
            'geometry': [
                {'latitude': 12.9716, 'longitude': 77.5946},
                {'latitude': 13.0827, 'longitude': 80.2707},
                {'latitude': 11.0168, 'longitude': 76.9558},
            ],
            'snapped_stops': [],
            'legs': [
                {'points': [
                    {'latitude': 12.9716, 'longitude': 77.5946},
                    {'latitude': 13.0827, 'longitude': 80.2707},
                ], 'distance_meters': 300000.0, 'duration_seconds': 14000.0, 'status': 'routed', 'routed': True, 'fallback': False},
                {'points': [
                    {'latitude': 13.0827, 'longitude': 80.2707},
                    {'latitude': 11.0168, 'longitude': 76.9558},
                ], 'distance_meters': 201234.5, 'duration_seconds': 14800.0, 'status': 'routed', 'routed': True, 'fallback': False},
            ],
            'has_fallback_legs': False,
            'has_non_routed_legs': False,
            'warning': None,
        },
    )

    route = client.get(f'/api/v1/groups/{gid}/trip/route?day=1')
    assert route.status_code == 200, route.text
    payload = route.json()

    assert payload['day_number'] == 1
    assert len(payload['stops']) == 3
    assert len(payload['legs']) == 2

    for index, leg in enumerate(payload['legs']):
        assert leg['from_stop_id'] == payload['stops'][index]['stop_id']
        assert leg['to_stop_id'] == payload['stops'][index + 1]['stop_id']
        assert len(leg['points']) >= 2


def test_trip_route_filters_by_day(client, seed_users, monkeypatch):
    gid = _create_trip(client)
    stops = [
        ('start', 'Leh', 1, 34.1526, 77.5771),
        ('stop', 'Khardung La', 1, 34.2783, 77.6050),
        ('stop', 'Pangong', 2, 33.7595, 78.6772),
        ('destination', 'Hanle', 2, 32.7772, 78.9586),
    ]

    for stop_type, name, day, lat, lon in stops:
        response = client.post(
            f'/api/v1/groups/{gid}/trip/stops',
            json={
                'stop_type': stop_type,
                'name': name,
                'day_number': day,
                'latitude': lat,
                'longitude': lon,
            },
        )
        assert response.status_code == 201, response.text

    calls = []
    monkeypatch.setattr(
        'app.services.route_service._request_route',
        lambda coordinates: calls.append(coordinates) or {
            'distance_meters': 12345.0,
            'duration_seconds': 1800.0,
            'geometry': [
                {'latitude': coordinates[0][0], 'longitude': coordinates[0][1]},
                {'latitude': coordinates[-1][0], 'longitude': coordinates[-1][1]},
            ],
            'snapped_stops': [],
            'legs': [{
                'points': [
                    {'latitude': coordinates[0][0], 'longitude': coordinates[0][1]},
                    {'latitude': coordinates[-1][0], 'longitude': coordinates[-1][1]},
                ],
                'distance_meters': 12345.0,
                'duration_seconds': 1800.0,
                'status': 'routed',
                'routed': True,
                'fallback': False,
            }],
            'has_fallback_legs': False,
            'has_non_routed_legs': False,
            'warning': None,
        },
    )

    route = client.get(f'/api/v1/groups/{gid}/trip/route?day=2')
    assert route.status_code == 200, route.text
    payload = route.json()

    assert payload['day_number'] == 2
    assert [stop['name'] for stop in payload['stops']] == ['Pangong', 'Hanle']
    assert len(payload['legs']) == 1
    assert len(calls) == 1
    assert len(calls[0]) == 2


def test_trip_route_rejects_missing_coordinates(client, seed_users):
    gid = _create_trip(client)

    for stop_type, name in [('start', 'Bengaluru'), ('destination', 'Chennai')]:
        response = client.post(
            f'/api/v1/groups/{gid}/trip/stops',
            json={
                'stop_type': stop_type,
                'name': name,
            },
        )
        assert response.status_code == 201, response.text

    route = client.get(f'/api/v1/groups/{gid}/trip/route')
    assert route.status_code == 422
    assert 'coordinates' in route.json()['detail'].lower()


def test_trip_route_requires_two_stops_for_selected_day(client, seed_users):
    gid = _create_trip(client)

    response = client.post(
        f'/api/v1/groups/{gid}/trip/stops',
        json={
            'stop_type': 'start',
            'name': 'Leh',
            'day_number': 2,
            'latitude': 34.1526,
            'longitude': 77.5771,
        },
    )
    assert response.status_code == 201

    route = client.get(f'/api/v1/groups/{gid}/trip/route?day=2')
    assert route.status_code == 422
    assert 'at least two stops' in route.json()['detail'].lower()


def test_trip_route_blocks_non_trip_group(client, seed_users):
    group = client.post('/api/v1/groups', json={
        'name': 'Friends Group',
        'type': 'Friends',
        'currency': 'INR',
    })
    assert group.status_code == 201

    route = client.get(
        f"/api/v1/groups/{group.json()['id']}/trip/route"
    )
    assert route.status_code == 409
