from datetime import UTC, datetime, timedelta

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


def test_missing_save_slot_returns_404(client: TestClient) -> None:
    assert client.get("/api/v1/saves/no_such_slot").status_code == 404


def test_saving_the_same_slot_overwrites_rather_than_appends(client: TestClient) -> None:
    """The client quick-saves to a fixed slot, so repeat writes must upsert."""
    for credits in (100, 900):
        response = client.put(
            "/api/v1/saves/quick",
            json={"mission_id": "mission_01", "payload": {"credits": credits}},
        )
        assert response.status_code == 200

    slots = client.get("/api/v1/saves").json()
    assert [item["slot"] for item in slots].count("quick") == 1
    assert next(item for item in slots if item["slot"] == "quick")["payload"]["credits"] == 900


def test_list_saves_exposes_fields_the_menu_renders(client: TestClient) -> None:
    """The deployment log reads slot, mission_id, updated_at and the payload."""
    client.put(
        "/api/v1/saves/alpha",
        json={
            "mission_id": "mission_01",
            "payload": {
                "faction": "aegis",
                "enemy_faction": "noctis",
                "difficulty": "normal",
                "credits": 4200,
                "supply_used": 12,
                "supply_cap": 30,
                "status": "playing",
                "saved_at": "2024-01-01T00:00:00Z",
            },
        },
    )

    entry = next(item for item in client.get("/api/v1/saves").json() if item["slot"] == "alpha")
    assert entry["mission_id"] == "mission_01"
    assert entry["updated_at"]
    assert entry["payload"]["enemy_faction"] == "noctis"
    assert entry["payload"]["supply_cap"] == 30


def test_save_rejects_unknown_mission(client: TestClient) -> None:
    response = client.put("/api/v1/saves/quick", json={"mission_id": "nope", "payload": {}})
    assert response.status_code == 400


def test_updated_at_is_serialised_with_an_explicit_utc_offset(client: TestClient) -> None:
    """Without an offset, browsers parse the timestamp as local time and skew it."""
    client.put("/api/v1/saves/quick", json={"mission_id": "mission_01", "payload": {}})
    updated_at = client.get("/api/v1/saves/quick").json()["updated_at"]

    parsed = datetime.fromisoformat(updated_at)
    assert parsed.tzinfo is not None
    assert parsed.utcoffset() == timedelta(0)
    assert abs((datetime.now(UTC) - parsed).total_seconds()) < 60


def test_three_race_expansion_scenarios_are_seeded(client: TestClient) -> None:
    response = client.get("/api/v1/missions")
    assert response.status_code == 200
    missions = {item["id"]: item for item in response.json()}
    assert "mission_03" in missions
    assert missions["mission_03"]["name"] == "Fractured Convergence"
    assert "skirmish_01" in missions
