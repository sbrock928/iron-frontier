from fastapi.testclient import TestClient


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_mission_can_be_loaded(client: TestClient) -> None:
    response = client.get("/api/v1/missions/mission_01")
    assert response.status_code == 200
    payload = response.json()
    assert payload["name"] == "Operation Iron Dawn"
    assert payload["definition"]["starting_credits"] == 5000


def test_save_round_trip(client: TestClient) -> None:
    save = client.put(
        "/api/v1/saves/quick",
        json={"mission_id": "mission_01", "payload": {"credits": 1234, "units": 8}},
    )
    assert save.status_code == 200

    loaded = client.get("/api/v1/saves/quick")
    assert loaded.status_code == 200
    assert loaded.json()["payload"]["credits"] == 1234
