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
