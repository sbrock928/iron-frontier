from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class CampaignModel(Base):
    __tablename__ = "campaigns"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    join_code: Mapped[str] = mapped_column(String(8), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="waiting")
    turn_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    max_players: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )

    # SQLAlchemy includes the prior version in every UPDATE's WHERE clause.
    # This protects turn resolution on both SQLite and SQL Server, whose
    # dialect intentionally ignores the generic SELECT ... FOR UPDATE hint.
    __mapper_args__ = {"version_id_col": version}


class CampaignPlayerModel(Base):
    __tablename__ = "campaign_players"
    __table_args__ = (
        UniqueConstraint("campaign_id", "faction", name="uq_campaign_player_faction"),
        UniqueConstraint("campaign_id", "display_name", name="uq_campaign_player_name"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    campaign_id: Mapped[str] = mapped_column(ForeignKey("campaigns.id"), nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(60), nullable=False)
    faction: Mapped[str] = mapped_column(String(16), nullable=False)
    access_token_hash: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True
    )
    credits: Mapped[int] = mapped_column(Integer, nullable=False, default=2400)
    ready: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )


class CampaignSectorModel(Base):
    __tablename__ = "campaign_sectors"
    __table_args__ = (UniqueConstraint("campaign_id", "sector_key", name="uq_campaign_sector_key"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    campaign_id: Mapped[str] = mapped_column(ForeignKey("campaigns.id"), nullable=False, index=True)
    sector_key: Mapped[str] = mapped_column(String(32), nullable=False)
    label: Mapped[str] = mapped_column(String(80), nullable=False)
    map_x: Mapped[int] = mapped_column(Integer, nullable=False)
    map_y: Mapped[int] = mapped_column(Integer, nullable=False)
    resource_yield: Mapped[int] = mapped_column(Integer, nullable=False, default=250)
    base_level: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    owner_player_id: Mapped[str | None] = mapped_column(
        ForeignKey("campaign_players.id"), nullable=True, index=True
    )


class CampaignSectorLinkModel(Base):
    __tablename__ = "campaign_sector_links"

    campaign_id: Mapped[str] = mapped_column(ForeignKey("campaigns.id"), primary_key=True)
    sector_a_id: Mapped[str] = mapped_column(ForeignKey("campaign_sectors.id"), primary_key=True)
    sector_b_id: Mapped[str] = mapped_column(ForeignKey("campaign_sectors.id"), primary_key=True)


class CampaignForceModel(Base):
    __tablename__ = "campaign_forces"
    __table_args__ = (
        UniqueConstraint("player_id", "sector_id", "unit_kind", name="uq_campaign_force_stack"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    campaign_id: Mapped[str] = mapped_column(ForeignKey("campaigns.id"), nullable=False, index=True)
    player_id: Mapped[str] = mapped_column(
        ForeignKey("campaign_players.id"), nullable=False, index=True
    )
    sector_id: Mapped[str] = mapped_column(
        ForeignKey("campaign_sectors.id"), nullable=False, index=True
    )
    unit_kind: Mapped[str] = mapped_column(String(40), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class CampaignResearchModel(Base):
    __tablename__ = "campaign_research"

    player_id: Mapped[str] = mapped_column(ForeignKey("campaign_players.id"), primary_key=True)
    upgrade_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    campaign_id: Mapped[str] = mapped_column(ForeignKey("campaigns.id"), nullable=False, index=True)
    completed_turn: Mapped[int] = mapped_column(Integer, nullable=False)


class CampaignOrderModel(Base):
    __tablename__ = "campaign_orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    campaign_id: Mapped[str] = mapped_column(ForeignKey("campaigns.id"), nullable=False, index=True)
    player_id: Mapped[str] = mapped_column(
        ForeignKey("campaign_players.id"), nullable=False, index=True
    )
    turn_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    order_type: Mapped[str] = mapped_column(String(20), nullable=False)
    source_sector_id: Mapped[str | None] = mapped_column(
        ForeignKey("campaign_sectors.id"), nullable=True
    )
    target_sector_id: Mapped[str | None] = mapped_column(
        ForeignKey("campaign_sectors.id"), nullable=True
    )
    unit_kind: Mapped[str | None] = mapped_column(String(40), nullable=True)
    quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    upgrade_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    cost: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CampaignEventModel(Base):
    __tablename__ = "campaign_events"
    __table_args__ = (
        UniqueConstraint(
            "campaign_id",
            "turn_number",
            "sequence",
            name="uq_campaign_event_sequence",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    campaign_id: Mapped[str] = mapped_column(ForeignKey("campaigns.id"), nullable=False, index=True)
    turn_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    payload: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
