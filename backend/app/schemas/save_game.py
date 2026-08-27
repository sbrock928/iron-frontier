from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SaveGameWrite(BaseModel):
    mission_id: str = Field(min_length=1, max_length=64)
    payload: dict[str, Any]


class SaveGameRead(SaveGameWrite):
    model_config = ConfigDict(from_attributes=True)

    slot: str
    updated_at: datetime

    @field_validator("updated_at")
    @classmethod
    def _ensure_timezone(cls, value: datetime) -> datetime:
        """
        Re-attach UTC to timestamps read back from storage.

        The column is declared ``DateTime(timezone=True)`` and always written
        with ``datetime.now(UTC)``, but SQLite has no native timestamp type and
        silently discards the offset. Serialising the naive value would emit an
        ISO string with no timezone, which JavaScript's ``Date.parse`` interprets
        as *local* time -- so a save made "now" would appear hours in the future
        for any client east of UTC. Values are UTC by construction, so saying so
        explicitly is both correct and unambiguous on the wire.
        """
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value
