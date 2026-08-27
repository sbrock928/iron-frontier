from fastapi import HTTPException, status

from app.dao.mission_dao import MissionDAO
from app.schemas.mission import MissionRead


class MissionService:
    def __init__(self, dao: MissionDAO) -> None:
        self._dao = dao

    def list_missions(self) -> list[MissionRead]:
        return [MissionRead.model_validate(row) for row in self._dao.list_all()]

    def get_mission(self, mission_id: str) -> MissionRead:
        row = self._dao.get(mission_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mission not found")
        return MissionRead.model_validate(row)
