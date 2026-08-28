from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError

from app.core.database import Base
from app.models.campaign import CampaignModel


def test_campaign_version_rejects_a_stale_concurrent_update(tmp_path: Path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'concurrency.db'}")
    Base.metadata.create_all(engine)
    campaign_id = "11111111-1111-4111-8111-111111111111"

    with Session(engine) as setup:
        setup.add(CampaignModel(id=campaign_id, join_code="IRON42", name="Original"))
        setup.commit()

    first_session = Session(engine)
    second_session = Session(engine)
    try:
        first = first_session.get(CampaignModel, campaign_id)
        second = second_session.get(CampaignModel, campaign_id)
        assert first is not None and second is not None

        first.name = "First update"
        first_session.commit()

        second.name = "Stale update"
        with pytest.raises(StaleDataError):
            second_session.commit()
    finally:
        first_session.close()
        second_session.close()
