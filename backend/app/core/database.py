from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


database_url = make_url(settings.database_url)
engine = create_engine(
    database_url,
    connect_args=(
        {"check_same_thread": False} if database_url.get_backend_name() == "sqlite" else {}
    ),
    pool_pre_ping=database_url.get_backend_name() != "sqlite",
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
