from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.mission import MissionModel


class MissionDAO:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_all(self) -> list[MissionModel]:
        return list(self._db.scalars(select(MissionModel).order_by(MissionModel.id)).all())

    def get(self, mission_id: str) -> MissionModel | None:
        return self._db.get(MissionModel, mission_id)

    def add(self, mission: MissionModel) -> MissionModel:
        self._db.add(mission)
        self._db.commit()
        self._db.refresh(mission)
        return mission
