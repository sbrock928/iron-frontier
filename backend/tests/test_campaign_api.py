from fastapi.testclient import TestClient


def create_campaign(client: TestClient) -> dict[str, object]:
    response = client.post(
        "/api/v1/campaigns",
        json={
            "name": "Fractured Meridian",
            "commander_name": "Commander Alpha",
            "faction": "aegis",
            "max_players": 2,
        },
    )
    assert response.status_code == 201
    return response.json()


def join_campaign(client: TestClient, join_code: str) -> dict[str, object]:
    response = client.post(
        "/api/v1/campaigns/join",
        json={
            "join_code": join_code,
            "commander_name": "Commander Beta",
            "faction": "noctis",
        },
    )
    assert response.status_code == 200
    return response.json()


def auth(player_token: object) -> dict[str, str]:
    return {"X-Campaign-Token": str(player_token)}


def test_campaign_creation_seeds_a_portable_sector_state(client: TestClient) -> None:
    state = create_campaign(client)

    assert state["status"] == "waiting"
    assert state["turn_number"] == 1
    assert len(state["join_code"]) == 6
    assert len(state["sectors"]) == 9
    assert len(state["players"]) == 1
    assert len(state["viewer_token"]) >= 43
    assert "access_token_hash" not in state["players"][0]
    assert any(
        sector["owner_player_id"] == state["viewer_player_id"] for sector in state["sectors"]
    )
    assert {unit["key"] for unit in state["unit_catalog"]} == {"rifleman", "tank", "gunship"}


def test_joining_fills_the_lobby_and_prevents_duplicate_factions(client: TestClient) -> None:
    created = create_campaign(client)
    joined = join_campaign(client, str(created["join_code"]))

    assert joined["status"] == "planning"
    assert len(joined["players"]) == 2
    duplicate = client.post(
        "/api/v1/campaigns/join",
        json={
            "join_code": created["join_code"],
            "commander_name": "Late Commander",
            "faction": "aegis",
        },
    )
    assert duplicate.status_code == 409


def test_orders_resolve_into_production_research_movement_and_income(client: TestClient) -> None:
    created = create_campaign(client)
    campaign_id = str(created["id"])
    alpha_id = str(created["viewer_player_id"])
    alpha_token = created["viewer_token"]
    joined = join_campaign(client, str(created["join_code"]))
    beta_token = joined["viewer_token"]

    alpha = client.get(f"/api/v1/campaigns/{campaign_id}", headers=auth(alpha_token)).json()
    home = next(sector for sector in alpha["sectors"] if sector["owner_player_id"] == alpha_id)
    target_id = home["neighbor_ids"][0]

    produce = client.post(
        f"/api/v1/campaigns/{campaign_id}/orders",
        headers=auth(alpha_token),
        json={
            "order_type": "produce",
            "target_sector_id": home["id"],
            "unit_kind": "rifleman",
            "quantity": 2,
        },
    )
    assert produce.status_code == 200
    research = client.post(
        f"/api/v1/campaigns/{campaign_id}/orders",
        headers=auth(alpha_token),
        json={
            "order_type": "research",
            "upgrade_key": "aegis_composite_plating",
        },
    )
    assert research.status_code == 200
    move = client.post(
        f"/api/v1/campaigns/{campaign_id}/orders",
        headers=auth(alpha_token),
        json={
            "order_type": "move",
            "source_sector_id": home["id"],
            "target_sector_id": target_id,
            "unit_kind": "rifleman",
            "quantity": 3,
        },
    )
    assert move.status_code == 200
    assert move.json()["players"][0]["credits"] == 1260
    assert len(move.json()["pending_orders"]) == 3

    assert (
        client.put(
            f"/api/v1/campaigns/{campaign_id}/ready",
            headers=auth(alpha_token),
            json={"ready": True},
        ).status_code
        == 200
    )
    resolved = client.put(
        f"/api/v1/campaigns/{campaign_id}/ready",
        headers=auth(beta_token),
        json={"ready": True},
    )
    assert resolved.status_code == 200

    alpha_after = client.get(f"/api/v1/campaigns/{campaign_id}", headers=auth(alpha_token)).json()
    assert alpha_after["turn_number"] == 2
    assert alpha_after["pending_orders"] == []
    assert "aegis_composite_plating" in alpha_after["completed_research"]
    captured = next(sector for sector in alpha_after["sectors"] if sector["id"] == target_id)
    assert captured["owner_player_id"] == alpha_id
    assert (
        next(force for force in captured["forces"] if force["unit_kind"] == "rifleman")["quantity"]
        == 3
    )
    assert all(not player["ready"] for player in alpha_after["players"])
    assert any(event["event_type"] == "income" for event in alpha_after["events"])


def test_cancelling_an_order_refunds_reserved_credits(client: TestClient) -> None:
    created = create_campaign(client)
    campaign_id = str(created["id"])
    alpha_id = str(created["viewer_player_id"])
    alpha_token = created["viewer_token"]
    join_campaign(client, str(created["join_code"]))
    alpha = client.get(f"/api/v1/campaigns/{campaign_id}", headers=auth(alpha_token)).json()
    home = next(sector for sector in alpha["sectors"] if sector["owner_player_id"] == alpha_id)
    queued = client.post(
        f"/api/v1/campaigns/{campaign_id}/orders",
        headers=auth(alpha_token),
        json={
            "order_type": "produce",
            "target_sector_id": home["id"],
            "unit_kind": "tank",
            "quantity": 1,
        },
    ).json()
    assert (
        next(player for player in queued["players"] if player["id"] == alpha_id)["credits"] == 1550
    )

    order_id = queued["pending_orders"][0]["id"]
    cancelled = client.delete(
        f"/api/v1/campaigns/{campaign_id}/orders/{order_id}",
        headers=auth(alpha_token),
    )
    assert cancelled.status_code == 200
    state = cancelled.json()
    assert state["pending_orders"] == []
    assert (
        next(player for player in state["players"] if player["id"] == alpha_id)["credits"] == 2400
    )


def test_move_rejects_non_adjacent_or_unowned_sources(client: TestClient) -> None:
    created = create_campaign(client)
    campaign_id = str(created["id"])
    alpha_id = str(created["viewer_player_id"])
    alpha_token = created["viewer_token"]
    join_campaign(client, str(created["join_code"]))
    state = client.get(f"/api/v1/campaigns/{campaign_id}", headers=auth(alpha_token)).json()
    enemy_sector = next(
        sector for sector in state["sectors"] if sector["owner_player_id"] not in (None, alpha_id)
    )
    response = client.post(
        f"/api/v1/campaigns/{campaign_id}/orders",
        headers=auth(alpha_token),
        json={
            "order_type": "move",
            "source_sector_id": enemy_sector["id"],
            "target_sector_id": enemy_sector["neighbor_ids"][0],
            "unit_kind": "rifleman",
            "quantity": 1,
        },
    )
    assert response.status_code == 400
    assert "sector you control" in response.json()["detail"]


def test_public_player_id_cannot_authenticate_as_a_commander(client: TestClient) -> None:
    created = create_campaign(client)
    response = client.get(
        f"/api/v1/campaigns/{created['id']}",
        headers=auth(created["viewer_player_id"]),
    )

    assert response.status_code == 404
