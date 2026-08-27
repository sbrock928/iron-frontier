from fastapi import HTTPException, status

from app.dao.mission_dao import MissionDAO
from app.dao.save_game_dao import SaveGameDAO
from app.schemas.save_game import SaveGameRead, SaveGameWrite


class SaveGameService:
    def __init__(self, save_dao: SaveGameDAO, mission_dao: MissionDAO) -> None:
        self._save_dao = save_dao
        self._mission_dao = mission_dao

    def list_saves(self) -> list[SaveGameRead]:
        return [SaveGameRead.model_validate(row) for row in self._save_dao.list_all()]

    def get_save(self, slot: str) -> SaveGameRead:
        row = self._save_dao.get(slot)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Save slot not found")
        return SaveGameRead.model_validate(row)

    def save(self, slot: str, command: SaveGameWrite) -> SaveGameRead:
        if self._mission_dao.get(command.mission_id) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown mission")
        row = self._save_dao.upsert(slot, command.mission_id, command.payload)
        return SaveGameRead.model_validate(row)
