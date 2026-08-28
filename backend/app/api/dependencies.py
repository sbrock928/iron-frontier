from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dao.mission_dao import MissionDAO
from app.dao.save_game_dao import SaveGameDAO
from app.services.campaign_service import CampaignService
from app.services.mission_service import MissionService
from app.services.save_game_service import SaveGameService


def get_mission_service(db: Session = Depends(get_db)) -> MissionService:
    return MissionService(MissionDAO(db))


def get_save_game_service(db: Session = Depends(get_db)) -> SaveGameService:
    return SaveGameService(SaveGameDAO(db), MissionDAO(db))


def get_campaign_service(db: Session = Depends(get_db)) -> CampaignService:
    return CampaignService(db)
