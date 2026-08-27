from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class Settings:
    app_name: str = "Iron Frontier API"
    api_prefix: str = "/api/v1"
    database_url: str = f"sqlite:///{Path(__file__).resolve().parents[2] / 'iron_frontier.db'}"


settings = Settings()
