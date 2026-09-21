import os
from uuid import UUID

TEST_DATABASE_URL = os.getenv('FAIRSHARE_TEST_DATABASE_URL', 'sqlite:///:memory:')
os.environ.setdefault('DATABASE_URL', TEST_DATABASE_URL)
os.environ.setdefault('SUPABASE_URL', 'https://test.supabase.co')
os.environ.setdefault('SUPABASE_PUBLISHABLE_KEY', 'test-publishable-key')
os.environ.setdefault('SUPABASE_SECRET_KEY', 'test-secret-key')
os.environ.setdefault('ENVIRONMENT', 'test')

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db, get_read_db
from app.core.security import CurrentUser, get_current_user
from app.main import app
from app.models import Base, User

engine_kwargs = {}
if TEST_DATABASE_URL.startswith('sqlite:///'):
    engine_kwargs.update(connect_args={'check_same_thread': False}, poolclass=StaticPool)
engine = create_engine(TEST_DATABASE_URL, **engine_kwargs)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)

USER_A = UUID('11111111-1111-1111-1111-111111111111')
USER_B = UUID('22222222-2222-2222-2222-222222222222')
USER_C = UUID('33333333-3333-3333-3333-333333333333')


@pytest.fixture(autouse=True)
def clean_db():
    if TEST_DATABASE_URL.startswith('postgresql') or os.getenv('FAIRSHARE_REUSE_SCHEMA') == '1':
        from sqlalchemy import text
        with engine.begin() as connection:
            connection.execute(text(
                'TRUNCATE TABLE public.expense_splits, public.expenses, public.settlements, public.group_members, public.groups, public.users RESTART IDENTITY CASCADE'
            ))
        yield
    else:
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        yield
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(monkeypatch):
    def override_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    def override_read_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    current = CurrentUser(id=USER_A, email='a@example.com', full_name='A')
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_read_db] = override_read_db
    app.dependency_overrides[get_current_user] = lambda: current

    # The production write dependency sets the PostgreSQL JWT claim context.
    # SQLite does not provide set_config(), so disable only that DB-specific
    # context call in the local test environment. Authorization itself is still
    # exercised through the real dependency/service logic.
    if TEST_DATABASE_URL.startswith('sqlite:///'):
        monkeypatch.setattr('app.api.routes.set_database_user_context', lambda session, user_id: None)

    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def seed_users():
    session = TestingSessionLocal()
    users = [
        User(id=USER_A, email='a@example.com', full_name='A'),
        User(id=USER_B, email='b@example.com', full_name='B'),
        User(id=USER_C, email='c@example.com', full_name='C'),
    ]
    session.add_all(users)
    session.commit()
    session.close()
    return users
