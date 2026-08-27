from pydantic import BaseModel, ConfigDict, Field


class Point(BaseModel):
    x: int
    y: int


class Objective(BaseModel):
    id: str
    label: str
    type: str
    target: str | None = None


class EnemyConfig(BaseModel):
    attack_interval_seconds: int = Field(ge=10, le=600)
    starting_units: int = Field(ge=0, le=100)
    production_multiplier: float = Field(gt=0, le=10)


class MissionDefinition(BaseModel):
    world_width: int = Field(ge=800, le=10000)
    world_height: int = Field(ge=600, le=10000)
    starting_credits: int = Field(ge=0)
    player_spawn: Point
    enemy_spawn: Point
    ore_fields: list[Point]
    objectives: list[Objective]
    enemy: EnemyConfig


class MissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str
    definition: MissionDefinition
