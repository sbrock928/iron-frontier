from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.dependencies import get_mission_service
from app.schemas.mission import MissionRead
from app.services.mission_service import MissionService

router = APIRouter(prefix="/missions", tags=["missions"])


@router.get("", response_model=list[MissionRead])
def list_missions(service: Annotated[MissionService, Depends(get_mission_service)]) -> list[MissionRead]:
    return service.list_missions()


@router.get("/{mission_id}", response_model=MissionRead)
def get_mission(
    mission_id: str,
    service: Annotated[MissionService, Depends(get_mission_service)],
) -> MissionRead:
    return service.get_mission(mission_id)
