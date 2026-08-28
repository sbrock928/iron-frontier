from typing import Annotated

from fastapi import APIRouter, Depends, Header, status

from app.api.dependencies import get_campaign_service
from app.schemas.campaign import (
    CampaignCreate,
    CampaignJoin,
    CampaignOrderCreate,
    CampaignReadyWrite,
    CampaignStateRead,
    CampaignSummaryRead,
)
from app.services.campaign_service import CampaignService

router = APIRouter(prefix="/campaigns", tags=["campaigns"])
CampaignToken = Annotated[
    str,
    Header(alias="X-Campaign-Token", min_length=32, max_length=100),
]


@router.get("", response_model=list[CampaignSummaryRead])
def list_campaigns(
    service: Annotated[CampaignService, Depends(get_campaign_service)],
) -> list[CampaignSummaryRead]:
    return service.list_campaigns()


@router.post("", response_model=CampaignStateRead, status_code=status.HTTP_201_CREATED)
def create_campaign(
    command: CampaignCreate,
    service: Annotated[CampaignService, Depends(get_campaign_service)],
) -> CampaignStateRead:
    return service.create_campaign(command)


@router.post("/join", response_model=CampaignStateRead)
def join_campaign(
    command: CampaignJoin,
    service: Annotated[CampaignService, Depends(get_campaign_service)],
) -> CampaignStateRead:
    return service.join_campaign(command)


@router.get("/{campaign_id}", response_model=CampaignStateRead)
def get_campaign(
    campaign_id: str,
    player_token: CampaignToken,
    service: Annotated[CampaignService, Depends(get_campaign_service)],
) -> CampaignStateRead:
    return service.get_campaign(campaign_id, player_token)


@router.post("/{campaign_id}/orders", response_model=CampaignStateRead)
def submit_order(
    campaign_id: str,
    command: CampaignOrderCreate,
    player_token: CampaignToken,
    service: Annotated[CampaignService, Depends(get_campaign_service)],
) -> CampaignStateRead:
    return service.submit_order(campaign_id, player_token, command)


@router.delete("/{campaign_id}/orders/{order_id}", response_model=CampaignStateRead)
def cancel_order(
    campaign_id: str,
    order_id: str,
    player_token: CampaignToken,
    service: Annotated[CampaignService, Depends(get_campaign_service)],
) -> CampaignStateRead:
    return service.cancel_order(campaign_id, order_id, player_token)


@router.put("/{campaign_id}/ready", response_model=CampaignStateRead)
def set_campaign_ready(
    campaign_id: str,
    command: CampaignReadyWrite,
    player_token: CampaignToken,
    service: Annotated[CampaignService, Depends(get_campaign_service)],
) -> CampaignStateRead:
    return service.set_ready(campaign_id, player_token, command.ready)
