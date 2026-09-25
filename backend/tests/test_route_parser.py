from app.services.route_service import _parse_line_string, _parse_leg_geometries


def test_parse_line_string_converts_geojson_coordinates():
    geometry = {
        "type": "LineString",
        "coordinates": [
            [77.5946, 12.9716],
            [77.7000, 13.0000],
            [78.0000, 13.1000],
        ],
    }

    points = _parse_line_string(geometry)

    assert points == [
        {"latitude": 12.9716, "longitude": 77.5946},
        {"latitude": 13.0, "longitude": 77.7},
        {"latitude": 13.1, "longitude": 78.0},
    ]


def test_parse_leg_geometries_parses_multilinestring():
    geometry = {
        "type": "MultiLineString",
        "coordinates": [
            [
                [77.5946, 12.9716],
                [77.7000, 13.0000],
            ],
            [
                [77.7000, 13.0000],
                [78.0000, 13.1000],
            ],
        ],
    }

    legs = _parse_leg_geometries(geometry)

    assert len(legs) == 2
    assert legs[0][0] == {
        "latitude": 12.9716,
        "longitude": 77.5946,
    }
    assert legs[0][-1] == {
        "latitude": 13.0,
        "longitude": 77.7,
    }
    assert legs[1][0] == {
        "latitude": 13.0,
        "longitude": 77.7,
    }
    assert legs[1][-1] == {
        "latitude": 13.1,
        "longitude": 78.0,
    }
