from app.services.route_service import _build_route_response


def _cached_result():
    return {
        "day_number": None,
        "distance_meters": 123456.0,
        "duration_seconds": 7200.0,
        "geometry": [
            {"latitude": 12.0, "longitude": 77.0},
            {"latitude": 12.1, "longitude": 77.1},
            {"latitude": 12.2, "longitude": 77.2},
        ],
        "snapped_stops": [
            {"index": 0, "latitude": 12.001, "longitude": 77.001, "distance_meters": 15.0},
            {"index": 2, "latitude": 12.199, "longitude": 77.199, "distance_meters": 18.0},
        ],
        "legs": [
            {"points": [{"latitude": 12.0, "longitude": 77.0}, {"latitude": 12.1, "longitude": 77.1}], "distance_meters": 100000.0, "duration_seconds": 3600.0, "routed": True, "fallback": False},
            {"points": [{"latitude": 12.1, "longitude": 77.1}, {"latitude": 12.2, "longitude": 77.2}], "distance_meters": 23456.0, "duration_seconds": 3600.0, "routed": True, "fallback": False},
        ],
        "has_fallback_legs": False,
        "has_non_routed_legs": False,
        "warning": None,
    }

def _stops():
    return [
        {"stop_id": "a", "sequence": 1, "day_number": 1, "latitude": 12.0, "longitude": 77.0, "name": "Start", "stop_type": "start"},
        {"stop_id": "b", "sequence": 2, "day_number": 1, "latitude": 12.1, "longitude": 77.1, "name": "Stop", "stop_type": "stop"},
        {"stop_id": "c", "sequence": 3, "day_number": 1, "latitude": 12.2, "longitude": 77.2, "name": "End", "stop_type": "destination"},
    ]

def test_serialization_is_repeatable_and_does_not_mutate_cached_route():
    cached = _cached_result()
    stops = _stops()
    first = _build_route_response(cached, stops, None)
    second = _build_route_response(cached, stops, None)

    assert first["snapped_stops"] == second["snapped_stops"]
    assert first["legs"] == second["legs"]
    assert cached["snapped_stops"][0]["index"] == 0
    assert cached["snapped_stops"][1]["index"] == 2
    assert "from_stop_id" not in cached["legs"][0]

def test_normalizes_legacy_stop_id_snapped_shape():
    cached = _cached_result()
    cached["snapped_stops"] = [{"stop_id": "b", "latitude": 12.101, "longitude": 77.101, "distance_meters": 20.0}]
    result = _build_route_response(cached, _stops(), None)
    assert result["snapped_stops"][0]["stop_id"] == "b"
    assert result["snapped_stops"][0]["distance_meters"] == 20.0
