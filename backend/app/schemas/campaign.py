from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Faction = Literal["aegis", "noctis", "veyra"]
CampaignOrderType = Literal["move", "produce", "research"]


class CampaignCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=3, max_length=100)
    commander_name: str = Field(min_length=2, max_length=60)
    faction: Faction
    max_players: int = Field(default=2, ge=2, le=3)


class CampaignJoin(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    join_code: str = Field(min_length=6, max_length=8)
    commander_name: str = Field(min_length=2, max_length=60)
    faction: Faction

    @field_validator("join_code")
    @classmethod
    def normalize_join_code(cls, value: str) -> str:
        return value.upper()


class CampaignOrderCreate(BaseModel):
    order_type: CampaignOrderType
    source_sector_id: str | None = None
    target_sector_id: str | None = None
    unit_kind: str | None = Field(default=None, max_length=40)
    quantity: int | None = Field(default=None, ge=1, le=999)
    upgrade_key: str | None = Field(default=None, max_length=64)

    @model_validator(mode="after")
    def validate_order_shape(self) -> "CampaignOrderCreate":
        if self.order_type == "move":
            if (
                not self.source_sector_id
                or not self.target_sector_id
                or not self.unit_kind
                or not self.quantity
            ):
                raise ValueError("Move orders require source, target, unit kind, and quantity")
        elif self.order_type == "produce":
            if not self.target_sector_id or not self.unit_kind or not self.quantity:
                raise ValueError(
                    "Production orders require a target sector, unit kind, and quantity"
                )
        elif not self.upgrade_key:
            raise ValueError("Research orders require an upgrade key")
        return self


class CampaignReadyWrite(BaseModel):
    ready: bool = True


class CampaignSummaryRead(BaseModel):
    id: str
    join_code: str
    name: str
    status: str
    turn_number: int
    player_count: int
    max_players: int
    created_at: datetime

    @field_validator("created_at")
    @classmethod
    def ensure_timezone(cls, value: datetime) -> datetime:
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value


class CampaignPlayerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    display_name: str
    faction: Faction
    credits: int
    ready: bool


class CampaignForceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    player_id: str
    unit_kind: str
    quantity: int


class CampaignSectorRead(BaseModel):
    id: str
    sector_key: str
    label: str
    map_x: int
    map_y: int
    resource_yield: int
    base_level: int
    owner_player_id: str | None
    neighbor_ids: list[str]
    forces: list[CampaignForceRead]


class CampaignOrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    turn_number: int
    order_type: CampaignOrderType
    source_sector_id: str | None
    target_sector_id: str | None
    unit_kind: str | None
    quantity: int | None
    upgrade_key: str | None
    cost: int
    status: str
    created_at: datetime

    @field_validator("created_at")
    @classmethod
    def ensure_timezone(cls, value: datetime) -> datetime:
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value


class CampaignEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    turn_number: int
    sequence: int
    event_type: str
    message: str
    payload: dict[str, object]
    created_at: datetime

    @field_validator("created_at")
    @classmethod
    def ensure_timezone(cls, value: datetime) -> datetime:
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value


class StrategicUnitRead(BaseModel):
    key: str
    faction: Faction
    label: str
    cost: int
    power: int


class StrategicUpgradeRead(BaseModel):
    key: str
    faction: Faction
    label: str
    description: str
    cost: int


class CampaignStateRead(BaseModel):
    id: str
    join_code: str
    name: str
    status: str
    turn_number: int
    max_players: int
    version: int
    viewer_player_id: str
    viewer_token: str
    players: list[CampaignPlayerRead]
    sectors: list[CampaignSectorRead]
    completed_research: list[str]
    pending_orders: list[CampaignOrderRead]
    events: list[CampaignEventRead]
    unit_catalog: list[StrategicUnitRead]
    research_catalog: list[StrategicUpgradeRead]
