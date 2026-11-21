import os
from pathlib import Path

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory


def test_single_alembic_head_and_ordered_migrations():
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))
    scripts = ScriptDirectory.from_config(config)

    assert scripts.get_heads() == ["0011_expense_previous_amount"]

    revisions = list(scripts.walk_revisions(base="base", head="heads"))
    assert {item.revision for item in revisions} >= {
        "0001_initial_schema",
        "0002_revoke_legacy_postgrest_api",
        "0003_categories_api_db",
        "0004_trip_journey_foundation",
        "0005_trip_day_number",
        "0006_cascade_trigger_delete",
        "0007_expense_locations",
        "0008_expense_date_and_updated_at",
        "0009_push_tokens",
        "0010_placeholder_members",
        "0011_expense_previous_amount",
    }

    # Keep the new migration attached to the existing linear chain.
    revision_map = {item.revision: item for item in revisions}
    assert revision_map["0007_expense_locations"].down_revision == "0006_cascade_trigger_delete"
    assert revision_map["0008_expense_date_and_updated_at"].down_revision == "0007_expense_locations"
    assert revision_map["0009_push_tokens"].down_revision == "0008_expense_date_and_updated_at"
    assert revision_map["0010_placeholder_members"].down_revision == "0009_push_tokens"
    assert revision_map["0011_expense_previous_amount"].down_revision == "0010_placeholder_members"


def test_postgres_migration_smoke_marker():
    if os.getenv("FAIRSHARE_POSTGRES_MIGRATION_OK") != "1":
        pytest.skip("PostgreSQL migration smoke is executed by the CI postgres job.")
