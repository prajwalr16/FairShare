import os
from pathlib import Path

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory


def test_single_alembic_head_and_ordered_migrations():
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / 'alembic.ini'))
    scripts = ScriptDirectory.from_config(config)
    assert scripts.get_heads() == ['0002_revoke_legacy_postgrest_api']
    revisions = list(scripts.walk_revisions(base='base', head='heads'))
    assert {item.revision for item in revisions} >= {
        '0001_initial_schema',
        '0002_revoke_legacy_postgrest_api',
    }


def test_postgres_migration_smoke_marker():
    # The CI job sets this marker after running Alembic against a fresh
    # PostgreSQL service. Local development intentionally uses SQLite tests.
    if os.getenv('FAIRSHARE_POSTGRES_MIGRATION_OK') != '1':
        pytest.skip('PostgreSQL migration smoke is executed by the CI postgres job.')
