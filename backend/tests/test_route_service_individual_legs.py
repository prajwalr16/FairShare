from app.services import route_service as rs


def _payload(points, distance, duration):
    return {
        'code': 'Ok',
        'waypoints': [
            {'location': [point[1], point[0]]}
            for point in points
        ],
        'routes': [{
            'distance': distance,
            'duration': duration,
            'geometry': {
                'type': 'LineString',
                'coordinates': [
                    [point[1], point[0]]
                    for point in points
                ],
            },
        }],
    }


def test_three_stops_create_two_independent_legs(monkeypatch):
    rs._request_route.cache_clear()
    rs._request_pair_route.cache_clear()
    calls = []

    def fake_pair(start, end):
        calls.append((start, end))
        return {
            'points': [
                {'latitude': start[0], 'longitude': start[1]},
                {
                    'latitude': (start[0] + end[0]) / 2,
                    'longitude': (start[1] + end[1]) / 2,
                },
                {'latitude': end[0], 'longitude': end[1]},
            ],
            'distance_meters': 100.0 + len(calls),
            'duration_seconds': 10.0,
            'routed': True,
            'fallback': False,
            'snapped_start': {'latitude': start[0], 'longitude': start[1]},
            'snapped_end': {'latitude': end[0], 'longitude': end[1]},
            'snap_distance_start_meters': 0.0,
            'snap_distance_end_meters': 0.0,
        }

    monkeypatch.setattr(rs, '_request_pair_route', fake_pair)

    result = rs._request_route((
        (12.0, 77.0),
        (13.0, 78.0),
        (14.0, 79.0),
    ))

    assert len(calls) == 2
    assert len(result['legs']) == 2
    assert all(leg['routed'] for leg in result['legs'])
    assert result['distance_meters'] == 203.0


def test_first_leg_failure_does_not_hide_second(monkeypatch):
    rs._request_route.cache_clear()
    rs._request_pair_route.cache_clear()

    def fake_pair(start, end):
        if start == (12.0, 77.0):
            return {
                'points': [
                    {'latitude': start[0], 'longitude': start[1]},
                    {'latitude': end[0], 'longitude': end[1]},
                ],
                'distance_meters': 0.0,
                'duration_seconds': 0.0,
                'routed': False,
                'fallback': False,
                'snapped_start': None,
                'snapped_end': None,
                'snap_distance_start_meters': 0.0,
                'snap_distance_end_meters': 0.0,
            }

        return {
            'points': [
                {'latitude': start[0], 'longitude': start[1]},
                {'latitude': end[0], 'longitude': end[1]},
            ],
            'distance_meters': 250.0,
            'duration_seconds': 25.0,
            'routed': True,
            'fallback': False,
            'snapped_start': {'latitude': start[0], 'longitude': start[1]},
            'snapped_end': {'latitude': end[0], 'longitude': end[1]},
            'snap_distance_start_meters': 0.0,
            'snap_distance_end_meters': 0.0,
        }

    monkeypatch.setattr(rs, '_request_pair_route', fake_pair)

    result = rs._request_route((
        (12.0, 77.0),
        (13.0, 78.0),
        (14.0, 79.0),
    ))

    assert len(result['legs']) == 2
    assert result['legs'][0]['status'] == 'unroutable'
    assert result['legs'][1]['status'] == 'routed'
    assert result['distance_meters'] == 250.0


def test_identical_stops_are_valid_zero_distance_itinerary_leg():
    rs._request_pair_route.cache_clear()

    result = rs._request_pair_route(
        (12.0, 77.0),
        (12.0, 77.0),
    )

    assert result['routed'] is True
    assert result['distance_meters'] == 0.0
    assert len(result['points']) == 2


def test_pair_route_does_not_send_trip_only_parameters(monkeypatch):
    rs._request_pair_route.cache_clear()
    seen = []

    monkeypatch.setattr(
        rs,
        '_request_http',
        lambda client, url, params: seen.append(params)
        or _payload([(12.0, 77.0), (13.0, 78.0)], 1000.0, 100.0),
    )

    result = rs._request_pair_route(
        (12.0, 77.0),
        (13.0, 78.0),
    )

    assert result['routed'] is True
    assert set(seen[0]) == {
        'overview',
        'geometries',
        'steps',
    }


def test_pair_route_uses_nearest_recovery(monkeypatch):
    rs._request_pair_route.cache_clear()

    monkeypatch.setattr(
        rs,
        '_request_nearest',
        lambda coordinate: {
            'point': {
                'latitude': coordinate[0] + 0.001,
                'longitude': coordinate[1] + 0.001,
            },
            'distance_meters': 100.0,
        },
    )

    calls = []

    def fake_http(client, url, params):
        calls.append(url)
        if len(calls) == 1:
            return {'code': 'NoRoute'}
        return _payload(
            [(12.001, 77.001), (13.001, 78.001)],
            900.0,
            90.0,
        )

    monkeypatch.setattr(rs, '_request_http', fake_http)

    result = rs._request_pair_route(
        (12.0, 77.0),
        (13.0, 78.0),
    )

    assert result['routed'] is True
    assert result['fallback'] is True
    assert result['distance_meters'] == 900.0
