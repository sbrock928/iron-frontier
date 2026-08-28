import hashlib
import secrets
import string
from collections import defaultdict
from datetime import UTC, datetime
from typing import Final, Never
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError

from app.models.campaign import (
    CampaignEventModel,
    CampaignForceModel,
    CampaignModel,
    CampaignOrderModel,
    CampaignPlayerModel,
    CampaignResearchModel,
    CampaignSectorLinkModel,
    CampaignSectorModel,
)
from app.schemas.campaign import (
    CampaignCreate,
    CampaignEventRead,
    CampaignForceRead,
    CampaignJoin,
    CampaignOrderCreate,
    CampaignOrderRead,
    CampaignPlayerRead,
    CampaignSectorRead,
    CampaignStateRead,
    CampaignSummaryRead,
    StrategicUnitRead,
    StrategicUpgradeRead,
)

FACTIONS: Final = {"aegis", "noctis", "veyra"}

UNIT_CATALOG: Final[dict[str, dict[str, str | int]]] = {
    "rifleman": {"faction": "aegis", "label": "Rifle Company", "cost": 220, "power": 13},
    "tank": {"faction": "aegis", "label": "Armored Lance", "cost": 850, "power": 44},
    "gunship": {"faction": "aegis", "label": "Gunship Wing", "cost": 980, "power": 34},
    "skitter": {"faction": "noctis", "label": "Skitter Brood", "cost": 190, "power": 11},
    "brute": {"faction": "noctis", "label": "Brute Pack", "cost": 840, "power": 42},
    "wraith": {"faction": "noctis", "label": "Wraith Flight", "cost": 950, "power": 32},
    "lancer": {"faction": "veyra", "label": "Lancer Cohort", "cost": 280, "power": 18},
    "sentinel": {"faction": "veyra", "label": "Sentinel Cadre", "cost": 980, "power": 48},
    "seraph": {"faction": "veyra", "label": "Seraph Wing", "cost": 1250, "power": 41},
}

RESEARCH_CATALOG: Final[dict[str, dict[str, str | int]]] = {
    "aegis_composite_plating": {
        "faction": "aegis",
        "label": "Composite Plating",
        "description": "+10% strategic defense.",
        "cost": 700,
    },
    "aegis_targeting_ai": {
        "faction": "aegis",
        "label": "Targeting AI",
        "description": "+10% strategic attack power.",
        "cost": 850,
    },
    "noctis_carapace_grafting": {
        "faction": "noctis",
        "label": "Carapace Grafting",
        "description": "+10% strategic defense.",
        "cost": 680,
    },
    "noctis_synaptic_acceleration": {
        "faction": "noctis",
        "label": "Synaptic Acceleration",
        "description": "+10% strategic attack power.",
        "cost": 820,
    },
    "veyra_shield_harmonics": {
        "faction": "veyra",
        "label": "Shield Harmonics",
        "description": "+10% strategic defense.",
        "cost": 780,
    },
    "veyra_resonance_matrix": {
        "faction": "veyra",
        "label": "Resonance Matrix",
        "description": "+10% strategic attack power.",
        "cost": 930,
    },
}

SECTOR_TEMPLATE: Final[list[tuple[str, str, int, int, int]]] = [
    ("iron_crown", "Iron Crown", 12, 50, 520),
    ("borealis", "Borealis Reach", 28, 20, 280),
    ("cinder", "Cinder March", 50, 18, 360),
    ("delta", "Delta Verge", 72, 20, 300),
    ("eclipse", "Eclipse Gate", 88, 50, 520),
    ("ferrum", "Ferrum Basin", 72, 80, 390),
    ("gale", "Gale Crossing", 50, 82, 330),
    ("helios", "Helios Span", 28, 80, 310),
    ("meridian", "Meridian Nexus", 50, 50, 650),
]

SECTOR_LINKS: Final[list[tuple[str, str]]] = [
    ("iron_crown", "borealis"),
    ("iron_crown", "helios"),
    ("borealis", "cinder"),
    ("borealis", "meridian"),
    ("cinder", "delta"),
    ("cinder", "meridian"),
    ("delta", "eclipse"),
    ("delta", "meridian"),
    ("eclipse", "ferrum"),
    ("ferrum", "gale"),
    ("ferrum", "meridian"),
    ("gale", "helios"),
    ("gale", "meridian"),
    ("helios", "meridian"),
]

HOME_KEYS: Final = ("iron_crown", "eclipse", "gale")
STARTING_FORCES: Final = {
    "aegis": (("rifleman", 8), ("tank", 2)),
    "noctis": (("skitter", 10), ("brute", 2)),
    "veyra": (("lancer", 8), ("sentinel", 2)),
}


class CampaignService:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_campaigns(self) -> list[CampaignSummaryRead]:
        player_count = (
            select(func.count(CampaignPlayerModel.id))
            .where(CampaignPlayerModel.campaign_id == CampaignModel.id)
            .correlate(CampaignModel)
            .scalar_subquery()
        )
        rows = self._db.execute(
            select(CampaignModel, player_count).order_by(CampaignModel.created_at.desc())
        ).all()
        return [
            CampaignSummaryRead(
                id=campaign.id,
                join_code=campaign.join_code,
                name=campaign.name,
                status=campaign.status,
                turn_number=campaign.turn_number,
                player_count=player_count,
                max_players=campaign.max_players,
                created_at=campaign.created_at,
            )
            for campaign, player_count in rows
        ]

    def create_campaign(self, command: CampaignCreate) -> CampaignStateRead:
        player_token = secrets.token_urlsafe(32)
        campaign = CampaignModel(
            id=str(uuid4()),
            join_code=self._new_join_code(),
            name=command.name.strip(),
            max_players=command.max_players,
        )
        player = CampaignPlayerModel(
            id=str(uuid4()),
            campaign_id=campaign.id,
            display_name=command.commander_name.strip(),
            faction=command.faction,
            access_token_hash=self._token_hash(player_token),
            credits=2400,
        )
        self._db.add_all([campaign, player])
        self._db.flush()
        sectors = self._seed_map(campaign.id)
        self._assign_home(player, sectors[HOME_KEYS[0]])
        self._event(
            campaign.id,
            1,
            "campaign",
            f"{player.display_name} established the {campaign.name} campaign.",
        )
        self._commit()
        return self.get_campaign(campaign.id, player_token)

    def join_campaign(self, command: CampaignJoin) -> CampaignStateRead:
        player_token = secrets.token_urlsafe(32)
        campaign = self._db.scalar(
            select(CampaignModel)
            .where(CampaignModel.join_code == command.join_code.strip().upper())
            .with_for_update()
        )
        if campaign is None:
            self._not_found("Campaign code not found")
        assert campaign is not None
        if campaign.status != "waiting":
            self._conflict("Campaign has already started")

        players = self._players(campaign.id)
        if len(players) >= campaign.max_players:
            self._conflict("Campaign is full")
        normalized_name = command.commander_name.strip().casefold()
        if any(player.display_name.casefold() == normalized_name for player in players):
            self._conflict("Commander name is already in use")
        if any(player.faction == command.faction for player in players):
            self._conflict("That faction is already represented")

        player = CampaignPlayerModel(
            id=str(uuid4()),
            campaign_id=campaign.id,
            display_name=command.commander_name.strip(),
            faction=command.faction,
            access_token_hash=self._token_hash(player_token),
            credits=2400,
        )
        self._db.add(player)
        self._db.flush()
        sectors = {sector.sector_key: sector for sector in self._sectors(campaign.id)}
        self._assign_home(player, sectors[HOME_KEYS[len(players)]])
        if len(players) + 1 == campaign.max_players:
            campaign.status = "planning"
        campaign.version += 1
        self._event(
            campaign.id,
            campaign.turn_number,
            "join",
            f"{player.display_name} joined as {command.faction.title()}.",
        )
        self._commit()
        return self.get_campaign(campaign.id, player_token)

    def get_campaign(self, campaign_id: str, player_token: str) -> CampaignStateRead:
        campaign = self._campaign(campaign_id)
        viewer = self._player_by_token(campaign_id, player_token)
        players = self._players(campaign_id)
        sectors = self._sectors(campaign_id)
        sector_ids = [sector.id for sector in sectors]
        links = list(
            self._db.scalars(
                select(CampaignSectorLinkModel).where(
                    CampaignSectorLinkModel.campaign_id == campaign_id
                )
            ).all()
        )
        neighbors: dict[str, list[str]] = defaultdict(list)
        for link in links:
            neighbors[link.sector_a_id].append(link.sector_b_id)
            neighbors[link.sector_b_id].append(link.sector_a_id)
        forces = (
            list(
                self._db.scalars(
                    select(CampaignForceModel)
                    .where(CampaignForceModel.sector_id.in_(sector_ids))
                    .order_by(CampaignForceModel.unit_kind)
                ).all()
            )
            if sector_ids
            else []
        )
        forces_by_sector: dict[str, list[CampaignForceRead]] = defaultdict(list)
        for force in forces:
            if force.quantity > 0:
                forces_by_sector[force.sector_id].append(CampaignForceRead.model_validate(force))

        research = list(
            self._db.scalars(
                select(CampaignResearchModel.upgrade_key)
                .where(CampaignResearchModel.player_id == viewer.id)
                .order_by(CampaignResearchModel.upgrade_key)
            ).all()
        )
        orders = list(
            self._db.scalars(
                select(CampaignOrderModel)
                .where(
                    CampaignOrderModel.campaign_id == campaign_id,
                    CampaignOrderModel.player_id == viewer.id,
                    CampaignOrderModel.turn_number == campaign.turn_number,
                    CampaignOrderModel.status == "pending",
                )
                .order_by(CampaignOrderModel.created_at)
            ).all()
        )
        events = list(
            reversed(
                list(
                    self._db.scalars(
                        select(CampaignEventModel)
                        .where(CampaignEventModel.campaign_id == campaign_id)
                        .order_by(CampaignEventModel.id.desc())
                        .limit(30)
                    ).all()
                )
            )
        )

        return CampaignStateRead(
            id=campaign.id,
            join_code=campaign.join_code,
            name=campaign.name,
            status=campaign.status,
            turn_number=campaign.turn_number,
            max_players=campaign.max_players,
            version=campaign.version,
            viewer_player_id=viewer.id,
            viewer_token=player_token,
            players=[CampaignPlayerRead.model_validate(player) for player in players],
            sectors=[
                CampaignSectorRead(
                    id=sector.id,
                    sector_key=sector.sector_key,
                    label=sector.label,
                    map_x=sector.map_x,
                    map_y=sector.map_y,
                    resource_yield=sector.resource_yield,
                    base_level=sector.base_level,
                    owner_player_id=sector.owner_player_id,
                    neighbor_ids=sorted(neighbors[sector.id]),
                    forces=forces_by_sector[sector.id],
                )
                for sector in sectors
            ],
            completed_research=research,
            pending_orders=[CampaignOrderRead.model_validate(order) for order in orders],
            events=[CampaignEventRead.model_validate(event) for event in events],
            unit_catalog=self._unit_catalog(viewer.faction),
            research_catalog=self._research_catalog(viewer.faction),
        )

    def submit_order(
        self,
        campaign_id: str,
        player_token: str,
        command: CampaignOrderCreate,
    ) -> CampaignStateRead:
        campaign = self._locked_campaign(campaign_id)
        player = self._player_by_token(campaign_id, player_token)
        self._ensure_can_plan(campaign, player)
        order = CampaignOrderModel(
            id=str(uuid4()),
            campaign_id=campaign_id,
            player_id=player.id,
            turn_number=campaign.turn_number,
            order_type=command.order_type,
            source_sector_id=command.source_sector_id,
            target_sector_id=command.target_sector_id,
            unit_kind=command.unit_kind,
            quantity=command.quantity,
            upgrade_key=command.upgrade_key,
        )
        if command.order_type == "move":
            self._validate_move(campaign, player, order)
        elif command.order_type == "produce":
            order.cost = self._validate_production(campaign, player, order)
            player.credits -= order.cost
        else:
            order.cost = self._validate_research(campaign, player, order)
            player.credits -= order.cost
        self._db.add(order)
        campaign.version += 1
        self._commit()
        return self.get_campaign(campaign_id, player_token)

    def cancel_order(self, campaign_id: str, order_id: str, player_token: str) -> CampaignStateRead:
        campaign = self._locked_campaign(campaign_id)
        player = self._player_by_token(campaign_id, player_token)
        self._ensure_can_plan(campaign, player)
        order = self._db.get(CampaignOrderModel, order_id)
        if order is None or order.campaign_id != campaign_id or order.player_id != player.id:
            self._not_found("Order not found")
        assert order is not None
        if order.status != "pending" or order.turn_number != campaign.turn_number:
            self._conflict("Only pending orders from this turn can be cancelled")
        player.credits += order.cost
        self._db.delete(order)
        campaign.version += 1
        self._commit()
        return self.get_campaign(campaign_id, player_token)

    def set_ready(self, campaign_id: str, player_token: str, ready: bool) -> CampaignStateRead:
        campaign = self._locked_campaign(campaign_id)
        player = self._player_by_token(campaign_id, player_token)
        if campaign.status != "planning":
            self._conflict("Campaign is still waiting for commanders")
        player.ready = ready
        self._db.flush()
        players = self._players(campaign_id)
        if len(players) == campaign.max_players and all(item.ready for item in players):
            self._resolve_turn(campaign, players)
        else:
            campaign.version += 1
        self._commit()
        return self.get_campaign(campaign_id, player_token)

    def _resolve_turn(self, campaign: CampaignModel, players: list[CampaignPlayerModel]) -> None:
        now = datetime.now(UTC)
        orders = list(
            self._db.scalars(
                select(CampaignOrderModel)
                .where(
                    CampaignOrderModel.campaign_id == campaign.id,
                    CampaignOrderModel.turn_number == campaign.turn_number,
                    CampaignOrderModel.status == "pending",
                )
                .order_by(CampaignOrderModel.created_at, CampaignOrderModel.id)
            ).all()
        )
        player_by_id = {player.id: player for player in players}

        for order in (item for item in orders if item.order_type == "research"):
            assert order.upgrade_key is not None
            if self._db.get(CampaignResearchModel, (order.player_id, order.upgrade_key)) is None:
                self._db.add(
                    CampaignResearchModel(
                        player_id=order.player_id,
                        campaign_id=campaign.id,
                        upgrade_key=order.upgrade_key,
                        completed_turn=campaign.turn_number,
                    )
                )
                label = str(RESEARCH_CATALOG[order.upgrade_key]["label"])
                self._event(
                    campaign.id,
                    campaign.turn_number,
                    "research",
                    f"{player_by_id[order.player_id].display_name} completed {label}.",
                )
            self._resolve_order(order, now)

        for order in (item for item in orders if item.order_type == "produce"):
            assert order.target_sector_id and order.unit_kind and order.quantity
            self._add_force(
                campaign.id,
                order.player_id,
                order.target_sector_id,
                order.unit_kind,
                order.quantity,
            )
            label = str(UNIT_CATALOG[order.unit_kind]["label"])
            sector = self._db.get(CampaignSectorModel, order.target_sector_id)
            self._event(
                campaign.id,
                campaign.turn_number,
                "production",
                f"{player_by_id[order.player_id].display_name} deployed {order.quantity} {label} at {sector.label if sector else 'a base'}.",
            )
            self._resolve_order(order, now)

        for order in (item for item in orders if item.order_type == "move"):
            self._resolve_move(campaign, order, player_by_id)
            if order.status == "pending":
                self._resolve_order(order, now)
            self._db.flush()

        sectors = self._sectors(campaign.id)
        income_by_player: dict[str, int] = defaultdict(int)
        for sector in sectors:
            if sector.owner_player_id:
                income_by_player[sector.owner_player_id] += sector.resource_yield
        for player in players:
            income = income_by_player[player.id]
            player.credits += income
            player.ready = False
            self._event(
                campaign.id,
                campaign.turn_number,
                "income",
                f"{player.display_name} collected ${income:,} in sector income.",
            )

        owners = {sector.owner_player_id for sector in sectors}
        if None not in owners and len(owners) == 1:
            winner_id = owners.pop()
            assert winner_id is not None
            campaign.status = "completed"
            self._event(
                campaign.id,
                campaign.turn_number,
                "victory",
                f"{player_by_id[winner_id].display_name} unified the frontier and won the campaign.",
            )

        campaign.turn_number += 1
        campaign.version += 1
        campaign.updated_at = now

    def _resolve_move(
        self,
        campaign: CampaignModel,
        order: CampaignOrderModel,
        players: dict[str, CampaignPlayerModel],
    ) -> None:
        assert (
            order.source_sector_id and order.target_sector_id and order.unit_kind and order.quantity
        )
        source_force = self._force(order.player_id, order.source_sector_id, order.unit_kind)
        if source_force is None or source_force.quantity < order.quantity:
            order.status = "rejected"
            self._event(
                campaign.id,
                campaign.turn_number,
                "rejected",
                "A movement order was rejected because its force was no longer available.",
            )
            return
        source_force.quantity -= order.quantity
        if source_force.quantity == 0:
            self._db.delete(source_force)

        target = self._db.get(CampaignSectorModel, order.target_sector_id)
        assert target is not None
        attacker = players[order.player_id]
        unit_label = str(UNIT_CATALOG[order.unit_kind]["label"])
        if target.owner_player_id in (None, order.player_id):
            was_neutral = target.owner_player_id is None
            target.owner_player_id = order.player_id
            self._add_force(
                campaign.id, order.player_id, target.id, order.unit_kind, order.quantity
            )
            verb = "captured" if was_neutral else "reinforced"
            self._event(
                campaign.id,
                campaign.turn_number,
                "movement",
                f"{attacker.display_name} {verb} {target.label} with {order.quantity} {unit_label}.",
            )
            return

        defenders = list(
            self._db.scalars(
                select(CampaignForceModel).where(
                    CampaignForceModel.campaign_id == campaign.id,
                    CampaignForceModel.sector_id == target.id,
                    CampaignForceModel.player_id == target.owner_player_id,
                )
            ).all()
        )
        attack_power = order.quantity * self._power(
            order.unit_kind, order.player_id, attacking=True
        )
        defense_power = sum(
            force.quantity * self._power(force.unit_kind, force.player_id, attacking=False)
            for force in defenders
        )
        defender_name = players[target.owner_player_id].display_name
        if attack_power > defense_power:
            for force in defenders:
                self._db.delete(force)
            survivor_power = attack_power - defense_power
            unit_power = self._power(order.unit_kind, order.player_id, attacking=True)
            survivors = max(1, (survivor_power + unit_power - 1) // unit_power)
            target.owner_player_id = order.player_id
            self._add_force(campaign.id, order.player_id, target.id, order.unit_kind, survivors)
            self._event(
                campaign.id,
                campaign.turn_number,
                "combat",
                f"{attacker.display_name} defeated {defender_name} at {target.label}; {survivors} formations survived.",
            )
        else:
            self._apply_damage(defenders, attack_power)
            self._event(
                campaign.id,
                campaign.turn_number,
                "combat",
                f"{defender_name} held {target.label} against {attacker.display_name}.",
            )

    def _apply_damage(self, defenders: list[CampaignForceModel], damage: int) -> None:
        for force in sorted(
            defenders, key=lambda item: int(UNIT_CATALOG[item.unit_kind]["power"]), reverse=True
        ):
            if damage <= 0:
                break
            power = max(1, int(UNIT_CATALOG[force.unit_kind]["power"]))
            casualties = min(force.quantity, (damage + power - 1) // power)
            force.quantity -= casualties
            damage -= casualties * power
            if force.quantity <= 0:
                self._db.delete(force)

    def _validate_move(
        self, campaign: CampaignModel, player: CampaignPlayerModel, order: CampaignOrderModel
    ) -> None:
        assert (
            order.source_sector_id and order.target_sector_id and order.unit_kind and order.quantity
        )
        source = self._sector(campaign.id, order.source_sector_id)
        self._sector(campaign.id, order.target_sector_id)
        if source.owner_player_id != player.id:
            self._bad_request("You can only move forces from a sector you control")
        if not self._connected(campaign.id, order.source_sector_id, order.target_sector_id):
            self._bad_request("Forces can only move to an adjacent sector")
        force = self._force(player.id, source.id, order.unit_kind)
        available = force.quantity if force else 0
        already_committed = (
            self._db.scalar(
                select(func.coalesce(func.sum(CampaignOrderModel.quantity), 0)).where(
                    CampaignOrderModel.campaign_id == campaign.id,
                    CampaignOrderModel.player_id == player.id,
                    CampaignOrderModel.turn_number == campaign.turn_number,
                    CampaignOrderModel.status == "pending",
                    CampaignOrderModel.order_type == "move",
                    CampaignOrderModel.source_sector_id == source.id,
                    CampaignOrderModel.unit_kind == order.unit_kind,
                )
            )
            or 0
        )
        if order.quantity > available - int(already_committed):
            self._bad_request("Not enough uncommitted forces in that sector")

    def _validate_production(
        self, campaign: CampaignModel, player: CampaignPlayerModel, order: CampaignOrderModel
    ) -> int:
        assert order.target_sector_id and order.unit_kind and order.quantity
        sector = self._sector(campaign.id, order.target_sector_id)
        if sector.owner_player_id != player.id or sector.base_level < 1:
            self._bad_request("Production requires one of your established bases")
        definition = UNIT_CATALOG.get(order.unit_kind)
        if definition is None or definition["faction"] != player.faction:
            self._bad_request("That unit is unavailable to your faction")
        cost = int(definition["cost"]) * order.quantity
        if player.credits < cost:
            self._bad_request("Insufficient credits")
        return cost

    def _validate_research(
        self, campaign: CampaignModel, player: CampaignPlayerModel, order: CampaignOrderModel
    ) -> int:
        assert order.upgrade_key
        definition = RESEARCH_CATALOG.get(order.upgrade_key)
        if definition is None or definition["faction"] != player.faction:
            self._bad_request("That technology is unavailable to your faction")
        if self._db.get(CampaignResearchModel, (player.id, order.upgrade_key)) is not None:
            self._conflict("Technology is already complete")
        pending = self._db.scalar(
            select(CampaignOrderModel.id).where(
                CampaignOrderModel.campaign_id == campaign.id,
                CampaignOrderModel.player_id == player.id,
                CampaignOrderModel.status == "pending",
                CampaignOrderModel.upgrade_key == order.upgrade_key,
            )
        )
        if pending:
            self._conflict("Technology is already queued")
        cost = int(definition["cost"])
        if player.credits < cost:
            self._bad_request("Insufficient credits")
        return cost

    def _ensure_can_plan(self, campaign: CampaignModel, player: CampaignPlayerModel) -> None:
        if campaign.status != "planning":
            self._conflict("Campaign is not accepting orders")
        if player.ready:
            self._conflict("Unready before changing orders")

    def _seed_map(self, campaign_id: str) -> dict[str, CampaignSectorModel]:
        sectors = {
            key: CampaignSectorModel(
                id=str(uuid4()),
                campaign_id=campaign_id,
                sector_key=key,
                label=label,
                map_x=x,
                map_y=y,
                resource_yield=income,
            )
            for key, label, x, y, income in SECTOR_TEMPLATE
        }
        self._db.add_all(sectors.values())
        self._db.flush()
        self._db.add_all(
            CampaignSectorLinkModel(
                campaign_id=campaign_id,
                sector_a_id=sectors[a].id,
                sector_b_id=sectors[b].id,
            )
            for a, b in SECTOR_LINKS
        )
        return sectors

    def _assign_home(self, player: CampaignPlayerModel, sector: CampaignSectorModel) -> None:
        sector.owner_player_id = player.id
        sector.base_level = 1
        for unit_kind, quantity in STARTING_FORCES[player.faction]:
            self._add_force(player.campaign_id, player.id, sector.id, unit_kind, quantity)

    def _add_force(
        self, campaign_id: str, player_id: str, sector_id: str, unit_kind: str, quantity: int
    ) -> None:
        force = self._force(player_id, sector_id, unit_kind)
        if force is None:
            self._db.add(
                CampaignForceModel(
                    id=str(uuid4()),
                    campaign_id=campaign_id,
                    player_id=player_id,
                    sector_id=sector_id,
                    unit_kind=unit_kind,
                    quantity=quantity,
                )
            )
        else:
            force.quantity += quantity
        self._db.flush()

    def _power(self, unit_kind: str, player_id: str, *, attacking: bool) -> int:
        base = int(UNIT_CATALOG[unit_kind]["power"])
        research = set(
            self._db.scalars(
                select(CampaignResearchModel.upgrade_key).where(
                    CampaignResearchModel.player_id == player_id
                )
            ).all()
        )
        attack_upgrades = {
            "aegis_targeting_ai",
            "noctis_synaptic_acceleration",
            "veyra_resonance_matrix",
        }
        defense_upgrades = {
            "aegis_composite_plating",
            "noctis_carapace_grafting",
            "veyra_shield_harmonics",
        }
        relevant = attack_upgrades if attacking else defense_upgrades
        return round(base * 1.1) if research.intersection(relevant) else base

    def _event(self, campaign_id: str, turn_number: int, event_type: str, message: str) -> None:
        sequence = (
            self._db.scalar(
                select(func.coalesce(func.max(CampaignEventModel.sequence), 0)).where(
                    CampaignEventModel.campaign_id == campaign_id,
                    CampaignEventModel.turn_number == turn_number,
                )
            )
            or 0
        )
        self._db.add(
            CampaignEventModel(
                campaign_id=campaign_id,
                turn_number=turn_number,
                sequence=int(sequence) + 1,
                event_type=event_type,
                message=message,
                payload={},
            )
        )
        self._db.flush()

    @staticmethod
    def _resolve_order(order: CampaignOrderModel, now: datetime) -> None:
        order.status = "resolved"
        order.resolved_at = now

    def _new_join_code(self) -> str:
        alphabet = string.ascii_uppercase + string.digits
        for _ in range(20):
            code = "".join(secrets.choice(alphabet) for _ in range(6))
            if (
                self._db.scalar(select(CampaignModel.id).where(CampaignModel.join_code == code))
                is None
            ):
                return code
        raise RuntimeError("Could not allocate a unique campaign code")

    def _commit(self) -> None:
        try:
            self._db.commit()
        except (IntegrityError, StaleDataError):
            self._db.rollback()
            self._conflict("Campaign state changed during this request; refresh and try again")

    def _campaign(self, campaign_id: str) -> CampaignModel:
        campaign = self._db.get(CampaignModel, campaign_id)
        if campaign is None:
            self._not_found("Campaign not found")
        assert campaign is not None
        return campaign

    def _locked_campaign(self, campaign_id: str) -> CampaignModel:
        campaign = self._db.scalar(
            select(CampaignModel).where(CampaignModel.id == campaign_id).with_for_update()
        )
        if campaign is None:
            self._not_found("Campaign not found")
        assert campaign is not None
        return campaign

    def _player_by_token(self, campaign_id: str, player_token: str) -> CampaignPlayerModel:
        player = self._db.scalar(
            select(CampaignPlayerModel).where(
                CampaignPlayerModel.campaign_id == campaign_id,
                CampaignPlayerModel.access_token_hash == self._token_hash(player_token),
            )
        )
        if player is None:
            self._not_found("Campaign commander not found")
        assert player is not None
        return player

    @staticmethod
    def _token_hash(player_token: str) -> str:
        return hashlib.sha256(player_token.encode("utf-8")).hexdigest()

    def _players(self, campaign_id: str) -> list[CampaignPlayerModel]:
        return list(
            self._db.scalars(
                select(CampaignPlayerModel)
                .where(CampaignPlayerModel.campaign_id == campaign_id)
                .order_by(CampaignPlayerModel.joined_at, CampaignPlayerModel.id)
            ).all()
        )

    def _sectors(self, campaign_id: str) -> list[CampaignSectorModel]:
        return list(
            self._db.scalars(
                select(CampaignSectorModel)
                .where(CampaignSectorModel.campaign_id == campaign_id)
                .order_by(CampaignSectorModel.sector_key)
            ).all()
        )

    def _sector(self, campaign_id: str, sector_id: str) -> CampaignSectorModel:
        sector = self._db.get(CampaignSectorModel, sector_id)
        if sector is None or sector.campaign_id != campaign_id:
            self._not_found("Sector not found")
        assert sector is not None
        return sector

    def _force(self, player_id: str, sector_id: str, unit_kind: str) -> CampaignForceModel | None:
        return self._db.scalar(
            select(CampaignForceModel).where(
                CampaignForceModel.player_id == player_id,
                CampaignForceModel.sector_id == sector_id,
                CampaignForceModel.unit_kind == unit_kind,
            )
        )

    def _connected(self, campaign_id: str, source_id: str, target_id: str) -> bool:
        return (
            self._db.scalar(
                select(CampaignSectorLinkModel.campaign_id).where(
                    CampaignSectorLinkModel.campaign_id == campaign_id,
                    or_(
                        (
                            (CampaignSectorLinkModel.sector_a_id == source_id)
                            & (CampaignSectorLinkModel.sector_b_id == target_id)
                        ),
                        (
                            (CampaignSectorLinkModel.sector_a_id == target_id)
                            & (CampaignSectorLinkModel.sector_b_id == source_id)
                        ),
                    ),
                )
            )
            is not None
        )

    @staticmethod
    def _unit_catalog(faction: str) -> list[StrategicUnitRead]:
        return [
            StrategicUnitRead(key=key, **definition)
            for key, definition in UNIT_CATALOG.items()
            if definition["faction"] == faction
        ]

    @staticmethod
    def _research_catalog(faction: str) -> list[StrategicUpgradeRead]:
        return [
            StrategicUpgradeRead(key=key, **definition)
            for key, definition in RESEARCH_CATALOG.items()
            if definition["faction"] == faction
        ]

    @staticmethod
    def _bad_request(detail: str) -> Never:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)

    @staticmethod
    def _not_found(detail: str) -> Never:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)

    @staticmethod
    def _conflict(detail: str) -> Never:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)
