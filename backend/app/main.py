from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.campaigns import router as campaigns_router
from app.api.missions import router as missions_router
from app.api.saves import router as saves_router
from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.seed import seed_database


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    if settings.auto_create_schema:
        Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_database(db)
    yield


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["system"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(missions_router, prefix=settings.api_prefix)
    app.include_router(saves_router, prefix=settings.api_prefix)
    app.include_router(campaigns_router, prefix=settings.api_prefix)
    return app


app = create_app()
