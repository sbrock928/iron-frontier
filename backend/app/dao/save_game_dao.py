from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.save_game import SaveGameModel


class SaveGameDAO:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_all(self) -> list[SaveGameModel]:
        stmt = select(SaveGameModel).order_by(SaveGameModel.updated_at.desc())
        return list(self._db.scalars(stmt).all())

    def get(self, slot: str) -> SaveGameModel | None:
        return self._db.get(SaveGameModel, slot)

    def upsert(self, slot: str, mission_id: str, payload: dict[str, object]) -> SaveGameModel:
        row = self._db.get(SaveGameModel, slot)
        if row is None:
            row = SaveGameModel(slot=slot, mission_id=mission_id, payload=payload)
            self._db.add(row)
        else:
            row.mission_id = mission_id
            row.payload = payload
            row.updated_at = datetime.now(UTC)
        self._db.commit()
        self._db.refresh(row)
        return row
