from sqlalchemy.orm import Session

from app.models.mission import MissionModel


MISSION_01: dict[str, object] = {
    "world_width": 2400,
    "world_height": 1400,
    "starting_credits": 5000,
    "player_spawn": {"x": 420, "y": 720},
    "enemy_spawn": {"x": 1950, "y": 700},
    "ore_fields": [
        {"x": 760, "y": 410},
        {"x": 870, "y": 980},
        {"x": 1430, "y": 720},
    ],
    "objectives": [
        {"id": "economy", "label": "Establish a functioning economy", "type": "earn", "target": "credits"},
        {"id": "destroy", "label": "Destroy the hostile command core", "type": "destroy", "target": "enemy_conyard"},
    ],
    "enemy": {
        "attack_interval_seconds": 32,
        "starting_units": 5,
        "production_multiplier": 1.0,
    },
}

MISSION_02: dict[str, object] = {
    "world_width": 2800,
    "world_height": 1680,
    "starting_credits": 6200,
    "player_spawn": {"x": 460, "y": 1100},
    "enemy_spawn": {"x": 2250, "y": 540},
    "ore_fields": [
        {"x": 860, "y": 930},
        {"x": 1180, "y": 530},
        {"x": 1650, "y": 1040},
        {"x": 2050, "y": 820},
    ],
    "objectives": [
        {"id": "air", "label": "Unlock and field your faction advanced air unit", "type": "build", "target": "advanced_air"},
        {"id": "destroy", "label": "Break the central hostile command core", "type": "destroy", "target": "enemy_conyard"},
    ],
    "enemy": {
        "attack_interval_seconds": 26,
        "starting_units": 8,
        "production_multiplier": 1.25,
    },
}

MISSION_03: dict[str, object] = {
    "world_width": 3000,
    "world_height": 1760,
    "starting_credits": 6800,
    "player_spawn": {"x": 520, "y": 860},
    "enemy_spawn": {"x": 2500, "y": 880},
    "ore_fields": [
        {"x": 860, "y": 520},
        {"x": 900, "y": 1260},
        {"x": 1500, "y": 860},
        {"x": 2140, "y": 520},
        {"x": 2180, "y": 1280},
    ],
    "objectives": [
        {"id": "tech", "label": "Construct an advanced research structure and complete a tier-3 upgrade", "type": "research", "target": "tier3"},
        {"id": "air", "label": "Establish air production and contest the center", "type": "build", "target": "airfield"},
        {"id": "destroy", "label": "Destroy the opposing command core", "type": "destroy", "target": "enemy_conyard"},
    ],
    "enemy": {
        "attack_interval_seconds": 24,
        "starting_units": 8,
        "production_multiplier": 1.2,
    },
}

SKIRMISH_01: dict[str, object] = {
    "world_width": 3200,
    "world_height": 1900,
    "starting_credits": 7200,
    "player_spawn": {"x": 520, "y": 1450},
    "enemy_spawn": {"x": 2650, "y": 540},
    "ore_fields": [
        {"x": 900, "y": 1340},
        {"x": 1130, "y": 760},
        {"x": 1610, "y": 990},
        {"x": 2040, "y": 1260},
        {"x": 2440, "y": 900},
    ],
    "objectives": [
        {"id": "expand", "label": "Expand and hold the map's ore lanes", "type": "earn", "target": "credits"},
        {"id": "annihilate", "label": "Destroy all hostile command structures", "type": "destroy", "target": "enemy_conyard"},
    ],
    "enemy": {
        "attack_interval_seconds": 22,
        "starting_units": 10,
        "production_multiplier": 1.45,
    },
}

MISSIONS = [
    (
        "mission_01",
        "Operation Iron Dawn",
        "Build an economy, climb your faction tech tree, and destroy the opposing command core.",
        MISSION_01,
    ),
    (
        "mission_02",
        "Black Skies Counterstroke",
        "Push into a fortified frontier, unlock advanced air technology, and break the opposing fortress.",
        MISSION_02,
    ),
    (
        "mission_03",
        "Fractured Convergence",
        "A tech-heavy three-race battlefield designed around advanced research, air control, and tier-3 units.",
        MISSION_03,
    ),
    (
        "skirmish_01",
        "Ash Meridian Skirmish",
        "A larger sandbox skirmish with denser ore lanes, a full faction tech tree, and an economy-driven enemy AI.",
        SKIRMISH_01,
    ),
]


def seed_database(db: Session) -> None:
    changed = False
    for mission_id, name, description, definition in MISSIONS:
      if db.get(MissionModel, mission_id) is not None:
          continue
      db.add(MissionModel(id=mission_id, name=name, description=description, definition=definition))
      changed = True
    if changed:
        db.commit()
