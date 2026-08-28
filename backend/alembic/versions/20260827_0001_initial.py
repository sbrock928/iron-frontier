"""Initial Iron Frontier and strategic campaign schema.

Revision ID: 20260827_0001
Revises:
Create Date: 2026-08-27
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260827_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "missions",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column("definition", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "save_games",
        sa.Column("slot", sa.String(length=64), nullable=False),
        sa.Column("mission_id", sa.String(length=64), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("slot"),
    )
    op.create_table(
        "campaigns",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("join_code", sa.String(length=8), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("turn_number", sa.Integer(), nullable=False),
        sa.Column("max_players", sa.Integer(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_campaigns_join_code", "campaigns", ["join_code"], unique=True)
    op.create_table(
        "campaign_players",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("campaign_id", sa.String(length=36), nullable=False),
        sa.Column("display_name", sa.String(length=60), nullable=False),
        sa.Column("faction", sa.String(length=16), nullable=False),
        sa.Column("access_token_hash", sa.String(length=64), nullable=False),
        sa.Column("credits", sa.Integer(), nullable=False),
        sa.Column("ready", sa.Boolean(), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("campaign_id", "display_name", name="uq_campaign_player_name"),
        sa.UniqueConstraint("campaign_id", "faction", name="uq_campaign_player_faction"),
    )
    op.create_index("ix_campaign_players_campaign_id", "campaign_players", ["campaign_id"])
    op.create_index(
        "ix_campaign_players_access_token_hash",
        "campaign_players",
        ["access_token_hash"],
        unique=True,
    )
    op.create_table(
        "campaign_sectors",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("campaign_id", sa.String(length=36), nullable=False),
        sa.Column("sector_key", sa.String(length=32), nullable=False),
        sa.Column("label", sa.String(length=80), nullable=False),
        sa.Column("map_x", sa.Integer(), nullable=False),
        sa.Column("map_y", sa.Integer(), nullable=False),
        sa.Column("resource_yield", sa.Integer(), nullable=False),
        sa.Column("base_level", sa.Integer(), nullable=False),
        sa.Column("owner_player_id", sa.String(length=36), nullable=True),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"]),
        sa.ForeignKeyConstraint(["owner_player_id"], ["campaign_players.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("campaign_id", "sector_key", name="uq_campaign_sector_key"),
    )
    op.create_index("ix_campaign_sectors_campaign_id", "campaign_sectors", ["campaign_id"])
    op.create_index("ix_campaign_sectors_owner_player_id", "campaign_sectors", ["owner_player_id"])
    op.create_table(
        "campaign_sector_links",
        sa.Column("campaign_id", sa.String(length=36), nullable=False),
        sa.Column("sector_a_id", sa.String(length=36), nullable=False),
        sa.Column("sector_b_id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"]),
        sa.ForeignKeyConstraint(["sector_a_id"], ["campaign_sectors.id"]),
        sa.ForeignKeyConstraint(["sector_b_id"], ["campaign_sectors.id"]),
        sa.PrimaryKeyConstraint("campaign_id", "sector_a_id", "sector_b_id"),
    )
    op.create_table(
        "campaign_forces",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("campaign_id", sa.String(length=36), nullable=False),
        sa.Column("player_id", sa.String(length=36), nullable=False),
        sa.Column("sector_id", sa.String(length=36), nullable=False),
        sa.Column("unit_kind", sa.String(length=40), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"]),
        sa.ForeignKeyConstraint(["player_id"], ["campaign_players.id"]),
        sa.ForeignKeyConstraint(["sector_id"], ["campaign_sectors.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("player_id", "sector_id", "unit_kind", name="uq_campaign_force_stack"),
    )
    op.create_index("ix_campaign_forces_campaign_id", "campaign_forces", ["campaign_id"])
    op.create_index("ix_campaign_forces_player_id", "campaign_forces", ["player_id"])
    op.create_index("ix_campaign_forces_sector_id", "campaign_forces", ["sector_id"])
    op.create_table(
        "campaign_research",
        sa.Column("player_id", sa.String(length=36), nullable=False),
        sa.Column("upgrade_key", sa.String(length=64), nullable=False),
        sa.Column("campaign_id", sa.String(length=36), nullable=False),
        sa.Column("completed_turn", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"]),
        sa.ForeignKeyConstraint(["player_id"], ["campaign_players.id"]),
        sa.PrimaryKeyConstraint("player_id", "upgrade_key"),
    )
    op.create_index("ix_campaign_research_campaign_id", "campaign_research", ["campaign_id"])
    op.create_table(
        "campaign_orders",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("campaign_id", sa.String(length=36), nullable=False),
        sa.Column("player_id", sa.String(length=36), nullable=False),
        sa.Column("turn_number", sa.Integer(), nullable=False),
        sa.Column("order_type", sa.String(length=20), nullable=False),
        sa.Column("source_sector_id", sa.String(length=36), nullable=True),
        sa.Column("target_sector_id", sa.String(length=36), nullable=True),
        sa.Column("unit_kind", sa.String(length=40), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=True),
        sa.Column("upgrade_key", sa.String(length=64), nullable=True),
        sa.Column("cost", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"]),
        sa.ForeignKeyConstraint(["player_id"], ["campaign_players.id"]),
        sa.ForeignKeyConstraint(["source_sector_id"], ["campaign_sectors.id"]),
        sa.ForeignKeyConstraint(["target_sector_id"], ["campaign_sectors.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_campaign_orders_campaign_id", "campaign_orders", ["campaign_id"])
    op.create_index("ix_campaign_orders_player_id", "campaign_orders", ["player_id"])
    op.create_index("ix_campaign_orders_turn_number", "campaign_orders", ["turn_number"])
    op.create_table(
        "campaign_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("campaign_id", sa.String(length=36), nullable=False),
        sa.Column("turn_number", sa.Integer(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("message", sa.String(length=500), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "campaign_id",
            "turn_number",
            "sequence",
            name="uq_campaign_event_sequence",
        ),
    )
    op.create_index("ix_campaign_events_campaign_id", "campaign_events", ["campaign_id"])
    op.create_index("ix_campaign_events_turn_number", "campaign_events", ["turn_number"])


def downgrade() -> None:
    op.drop_index("ix_campaign_events_turn_number", table_name="campaign_events")
    op.drop_index("ix_campaign_events_campaign_id", table_name="campaign_events")
    op.drop_table("campaign_events")
    op.drop_index("ix_campaign_orders_turn_number", table_name="campaign_orders")
    op.drop_index("ix_campaign_orders_player_id", table_name="campaign_orders")
    op.drop_index("ix_campaign_orders_campaign_id", table_name="campaign_orders")
    op.drop_table("campaign_orders")
    op.drop_index("ix_campaign_research_campaign_id", table_name="campaign_research")
    op.drop_table("campaign_research")
    op.drop_index("ix_campaign_forces_sector_id", table_name="campaign_forces")
    op.drop_index("ix_campaign_forces_player_id", table_name="campaign_forces")
    op.drop_index("ix_campaign_forces_campaign_id", table_name="campaign_forces")
    op.drop_table("campaign_forces")
    op.drop_table("campaign_sector_links")
    op.drop_index("ix_campaign_sectors_owner_player_id", table_name="campaign_sectors")
    op.drop_index("ix_campaign_sectors_campaign_id", table_name="campaign_sectors")
    op.drop_table("campaign_sectors")
    op.drop_index("ix_campaign_players_access_token_hash", table_name="campaign_players")
    op.drop_index("ix_campaign_players_campaign_id", table_name="campaign_players")
    op.drop_table("campaign_players")
    op.drop_index("ix_campaigns_join_code", table_name="campaigns")
    op.drop_table("campaigns")
    op.drop_table("save_games")
    op.drop_table("missions")
