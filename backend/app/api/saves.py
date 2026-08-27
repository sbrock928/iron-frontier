from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.dependencies import get_save_game_service
from app.schemas.save_game import SaveGameRead, SaveGameWrite
from app.services.save_game_service import SaveGameService

router = APIRouter(prefix="/saves", tags=["saves"])


@router.get("", response_model=list[SaveGameRead])
def list_saves(service: Annotated[SaveGameService, Depends(get_save_game_service)]) -> list[SaveGameRead]:
    return service.list_saves()


@router.get("/{slot}", response_model=SaveGameRead)
def get_save(slot: str, service: Annotated[SaveGameService, Depends(get_save_game_service)]) -> SaveGameRead:
    return service.get_save(slot)


@router.put("/{slot}", response_model=SaveGameRead)
def put_save(
    slot: str,
    command: SaveGameWrite,
    service: Annotated[SaveGameService, Depends(get_save_game_service)],
) -> SaveGameRead:
    return service.save(slot, command)
