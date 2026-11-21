import pytest
from app.services.place_service import find_spelling_suggestion, search_places


def test_place_search(client, monkeypatch):
    def fake_search(query, limit=6):
        assert query == "Rameshwaram"
        return [{
            "place_id": "N123",
            "name": "Rameshwaram",
            "display_name": "Rameshwaram, Ramanathapuram, Tamil Nadu, India",
            "address": "Rameshwaram, Ramanathapuram, Tamil Nadu, India",
            "latitude": 9.2876,
            "longitude": 79.3129,
            "category": "place",
            "type": "city",
        }]
    monkeypatch.setattr("app.api.routes.search_places", fake_search)
    response = client.get("/api/v1/places/search?q=Rameshwaram")
    assert response.status_code == 200
    assert response.json()["results"][0]["longitude"] == 79.3129


def test_place_search_rejects_short_query(client):
    response = client.get("/api/v1/places/search?q=a")
    assert response.status_code == 422


def test_find_spelling_suggestion():
    # Direct alias match
    assert find_spelling_suggestion("benglore") == "Bengaluru"
    assert find_spelling_suggestion("banglore") == "Bengaluru"
    # Fuzzy distance match
    assert find_spelling_suggestion("manli") == "Manali"
    assert find_spelling_suggestion("rameshwram") == "Rameshwaram"
    assert find_spelling_suggestion("ooti") == "Ooty"
    assert find_spelling_suggestion("taj mhal") == "Taj Mahal, Agra"
    assert find_spelling_suggestion("kodaikanl") == "Kodaikanal"
    # No match for arbitrary text
    assert find_spelling_suggestion("randomplacexyz123") is None


@pytest.mark.anyio
async def test_search_places_fuzzy_curated_fallback(monkeypatch):
    # Mock network call to return empty list so it falls back to fuzzy/curated
    async def mock_nominatim(q, limit):
        return []

    monkeypatch.setattr("app.services.place_service._execute_nominatim_search", mock_nominatim)

    result = await search_places("benglore")
    assert result["did_you_mean"] == "Bengaluru"
    assert len(result["results"]) > 0
    assert result["results"][0]["name"] == "Bengaluru"
    assert result["results"][0]["icon_type"] == "city"
    assert result["results"][0]["match_type"] == "fuzzy_corrected"
