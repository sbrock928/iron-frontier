from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SaveGameWrite(BaseModel):
    mission_id: str = Field(min_length=1, max_length=64)
    payload: dict[str, Any]


class SaveGameRead(SaveGameWrite):
    model_config = ConfigDict(from_attributes=True)

    slot: str
    updated_at: datetime
