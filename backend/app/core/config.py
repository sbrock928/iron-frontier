import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class Settings:
    app_name: str = "Iron Frontier API"
    api_prefix: str = "/api/v1"
    database_url: str = os.getenv(
        "IRON_FRONTIER_DATABASE_URL",
        f"sqlite:///{Path(__file__).resolve().parents[2] / 'iron_frontier.db'}",
    )
    # The local demo remains zero-setup. Deployed databases should set this to
    # false and apply the checked-in Alembic migrations instead.
    auto_create_schema: bool = os.getenv("IRON_FRONTIER_AUTO_CREATE_SCHEMA", "true").lower() in {
        "1",
        "true",
        "yes",
    }


settings = Settings()
