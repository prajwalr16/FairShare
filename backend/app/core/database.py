from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from .config import get_settings, normalize_database_url


def create_app_engine(database_url: str) -> Engine:
    url = normalize_database_url(database_url)
    connect_args = {}
    kwargs = {"pool_pre_ping": True}

    if url.startswith("sqlite:///"):
        connect_args["check_same_thread"] = False
        if url == "sqlite:///:memory:":
            kwargs["poolclass"] = StaticPool

    return create_engine(url, connect_args=connect_args, **kwargs)


engine = create_app_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
