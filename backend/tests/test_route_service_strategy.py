from app.services import route_service as rs


def _candidate_payload(start=(12.0, 77.0), end=(13.0, 78.0), distance=1000.0):
    return {
        'code': 'Ok',
        'waypoints': [
            {'location': [start[1], start[0]]},
            {'location': [end[1], end[0]]},
        ],
        'routes': [{
            'distance': distance,
            'duration': 100.0,
            'geometry': {
                'type': 'LineString',
                'coordinates': [
                    [start[1], start[0]],
                    [(start[1] + end[1]) / 2, (start[0] + end[0]) / 2],
                    [end[1], end[0]],
                ],
            },
        }],
    }


def test_route_candidate_accepts_complete_positive_distance_geometry():
    out = rs._route_candidate(
        _candidate_payload(),
        {'latitude': 12.0, 'longitude': 77.0},
        {'latitude': 13.0, 'longitude': 78.0},
        fallback=False,
    )

    assert out['routed'] is True
    assert out['distance_meters'] == 1000.0
    assert out['points'][0] == {'latitude': 12.0, 'longitude': 77.0}
    assert out['points'][-1] == {'latitude': 13.0, 'longitude': 78.0}


def test_route_candidate_rejects_zero_distance_geometry():
    out = rs._route_candidate(
        _candidate_payload(distance=0.0),
        {'latitude': 12.0, 'longitude': 77.0},
        {'latitude': 13.0, 'longitude': 78.0},
        fallback=False,
    )

    assert out['routed'] is False


def test_route_candidate_rejects_partial_geometry_far_from_endpoint():
    payload = _candidate_payload()
    payload['routes'][0]['geometry']['coordinates'][0] = [77.6, 12.6]

    out = rs._route_candidate(
        payload,
        {'latitude': 12.0, 'longitude': 77.0},
        {'latitude': 13.0, 'longitude': 78.0},
        fallback=False,
    )

    assert out['routed'] is False


def test_combine_leg_geometries_keeps_order_and_removes_join_duplicate():
    legs = [
        {
            'points': [
                {'latitude': 12.0, 'longitude': 77.0},
                {'latitude': 12.5, 'longitude': 77.5},
            ]
        },
        {
            'points': [
                {'latitude': 12.5, 'longitude': 77.5},
                {'latitude': 13.0, 'longitude': 78.0},
            ]
        },
    ]

    geometry = rs._combine_leg_geometries(legs)

    assert geometry == [
        {'latitude': 12.0, 'longitude': 77.0},
        {'latitude': 12.5, 'longitude': 77.5},
        {'latitude': 13.0, 'longitude': 78.0},
    ]


def test_snap_points_parses_osrm_waypoints():
    points = rs._snap_points({
        'waypoints': [
            {'location': [77.1, 12.1]},
            {'location': [78.2, 13.2]},
            {'foo': 'bar'},
        ]
    })

    assert points[0] == {'latitude': 12.1, 'longitude': 77.1}
    assert points[1] == {'latitude': 13.2, 'longitude': 78.2}
    assert points[2] is None
