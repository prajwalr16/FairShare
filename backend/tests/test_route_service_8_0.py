from app.services import route_service as rs


def _clear_caches():
    rs._request_route.cache_clear()
    rs._request_pair_route.cache_clear()


def _pair(start=(12.0, 77.0), end=(13.0, 78.0), distance=1000.0, duration=100.0, routed=True, fallback=False):
    return {
        'points': [
            {'latitude': start[0], 'longitude': start[1]},
            {'latitude': end[0], 'longitude': end[1]},
        ],
        'distance_meters': distance,
        'duration_seconds': duration,
        'routed': routed,
        'fallback': fallback,
        'snapped_start': {'latitude': start[0], 'longitude': start[1]} if routed else None,
        'snapped_end': {'latitude': end[0], 'longitude': end[1]} if routed else None,
        'snap_distance_start_meters': 0.0,
        'snap_distance_end_meters': 0.0,
    }


def test_three_stops_create_two_independent_legs(monkeypatch):
    _clear_caches()
    calls = []

    def fake_pair(start, end):
        calls.append((start, end))
        return _pair(start, end, distance=100.0 + len(calls))

    monkeypatch.setattr(rs, '_request_pair_route', fake_pair)

    result = rs._request_route((
        (12.0, 77.0),
        (13.0, 78.0),
        (14.0, 79.0),
    ))

    assert calls == [
        ((12.0, 77.0), (13.0, 78.0)),
        ((13.0, 78.0), (14.0, 79.0)),
    ]
    assert len(result['legs']) == 2
    assert all(leg['routed'] for leg in result['legs'])
    assert result['distance_meters'] == 203.0


def test_first_leg_failure_does_not_hide_second_leg(monkeypatch):
    _clear_caches()

    def fake_pair(start, end):
        if start == (12.0, 77.0):
            return _pair(start, end, distance=0.0, duration=0.0, routed=False)
        return _pair(start, end, distance=250.0, duration=25.0)

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
    assert result['duration_seconds'] == 25.0


def test_identical_stops_are_zero_distance_but_routed():
    _clear_caches()
    result = rs._request_pair_route((12.0, 77.0), (12.0, 77.0))
    assert result['routed'] is True
    assert result['distance_meters'] == 0.0
    assert result['points'][0] == result['points'][1]


def test_pair_route_does_not_send_trip_only_parameters(monkeypatch):
    _clear_caches()
    seen = []

    def fake_http(client, url, params):
        seen.append(params)
        return {
            'code': 'Ok',
            'waypoints': [
                {'location': [77.0, 12.0]},
                {'location': [78.0, 13.0]},
            ],
            'routes': [{
                'distance': 1000.0,
                'duration': 100.0,
                'geometry': {
                    'type': 'LineString',
                    'coordinates': [
                        [77.0, 12.0],
                        [77.5, 12.5],
                        [78.0, 13.0],
                    ],
                },
            }],
        }

    monkeypatch.setattr(rs, '_request_http', fake_http)

    result = rs._request_pair_route((12.0, 77.0), (13.0, 78.0))

    assert result['routed'] is True
    assert set(seen[0]) == {'overview', 'geometries', 'steps'}
    assert 'source' not in seen[0]
    assert 'destination' not in seen[0]
    assert 'snapping' not in seen[0]


def test_pair_route_nearest_recovery(monkeypatch):
    _clear_caches()

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
        return {
            'code': 'Ok',
            'waypoints': [
                {'location': [77.001, 12.001]},
                {'location': [78.001, 13.001]},
            ],
            'routes': [{
                'distance': 900.0,
                'duration': 90.0,
                'geometry': {
                    'type': 'LineString',
                    'coordinates': [
                        [77.001, 12.001],
                        [77.5, 12.5],
                        [78.001, 13.001],
                    ],
                },
            }],
        }

    monkeypatch.setattr(rs, '_request_http', fake_http)

    result = rs._request_pair_route((12.0, 77.0), (13.0, 78.0))

    assert result['routed'] is True
    assert result['fallback'] is True
    assert result['distance_meters'] == 900.0
    assert len(calls) == 2
