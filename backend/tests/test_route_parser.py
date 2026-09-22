from app.services.route_service import _build_leg_geometries


def test_build_leg_geometries_includes_first_and_last_legs():
    geometry = [
        {"latitude": 12.0, "longitude": 77.0},
        {"latitude": 12.1, "longitude": 77.1},
        {"latitude": 12.2, "longitude": 77.2},
        {"latitude": 12.3, "longitude": 77.3},
        {"latitude": 12.4, "longitude": 77.4},
    ]
    snapped = [geometry[0], geometry[2], geometry[4]]
    inputs = [
        {"latitude": 12.001, "longitude": 77.001},
        {"latitude": 12.201, "longitude": 77.201},
        {"latitude": 12.401, "longitude": 77.401},
    ]

    legs = _build_leg_geometries(geometry, snapped, inputs)

    assert len(legs) == 2
    assert legs[0][0] == snapped[0]
    assert legs[0][-1] == snapped[1]
    assert legs[1][0] == snapped[1]
    assert legs[1][-1] == snapped[2]
    assert len(legs[0]) >= 2
    assert len(legs[1]) >= 2
