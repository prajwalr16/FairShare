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

    # Production requests are short and PostgreSQL is remote from the API in
    # the current deployment. Avoid a SELECT 1 pre-ping on every checkout:
    # that extra network round trip is measurable on every GET/PUT. Recycle
    # pooled connections periodically so stale long-lived connections are
    # still replaced, while normal requests reuse warm connections.
    return create_engine(
        url,
        pool_pre_ping=False,
        pool_use_lifo=True,
        pool_size=10,
        max_overflow=10,
        pool_timeout=5,
        pool_recycle=900,
        pool_reset_on_return="rollback",
    )


engine = create_app_engine(get_settings().database_url)
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)

# Read endpoints do not need a transaction spanning multiple writes. Using an
# AUTOCOMMIT execution option avoids explicit BEGIN/ROLLBACK protocol chatter
# for remote PostgreSQL reads while leaving normal write sessions transactional.
ReadEngine = (
    engine.execution_options(isolation_level="AUTOCOMMIT")
    if engine.dialect.name == "postgresql"
    else engine
)
ReadSessionLocal = sessionmaker(
    bind=ReadEngine,
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
        # Startup should not fail just because warm-up is unavailable.
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

def get_read_db() -> Generator[Session, None, None]:
    session = ReadSessionLocal()
    try:
        yield session
    except Exception:
        # The DBAPI connection is in AUTOCOMMIT mode; rollback is harmless and
        # keeps the dependency symmetrical with the normal write session.
        session.rollback()
        raise
    finally:
        session.close()

