from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from .config import get_settings, normalize_database_url


def create_app_engine(database_url: str) -> Engine:
    url = normalize_database_url(database_url)

    if url.startswith("sqlite:///"):
        connect_args = {"check_same_thread": False}
        kwargs = {
            "pool_pre_ping": True,
            "poolclass": StaticPool if url == "sqlite:///:memory:" else None,
        }
        if kwargs["poolclass"] is None:
            kwargs.pop("poolclass")
        return create_engine(url, connect_args=connect_args, **kwargs)

    # FairShare uses a long-lived FastAPI process. Keep a warm pool so the
    # first user request does not repeatedly pay PostgreSQL connection setup.
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=10,
        pool_timeout=5,
        pool_recycle=1800,
    )


engine = create_app_engine(get_settings().database_url)
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


def warm_database_connection() -> None:
    """Establish one pooled PostgreSQL connection during backend startup."""
    try:
        with engine.connect() as connection:
            connection.execute(text("select 1"))
    except Exception:
        # Startup should not fail just because the warm-up is unavailable.
        # The normal request path will surface a database error if required.
        pass


def get_db() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
