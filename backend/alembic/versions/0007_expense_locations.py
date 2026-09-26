"""Add optional location metadata to expenses.

Revision ID: 0007_expense_locations
Revises: 0006_cascade_trigger_delete
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0007_expense_locations"
down_revision = "0006_cascade_trigger_delete"
branch_labels = None
depends_on = None


def _column_exists(bind, table: str, column: str) -> bool:
    row = bind.execute(
        sa.text(
            "select 1 from information_schema.columns "
            "where table_schema='public' and table_name=:table_name "
            "and column_name=:column_name"
        ),
        {"table_name": table, "column_name": column},
    ).first()
    return row is not None


def _constraint_exists(bind, table: str, constraint_name: str) -> bool:
    row = bind.execute(
        sa.text(
            "select 1 from information_schema.table_constraints "
            "where table_schema='public' and table_name=:table_name "
            "and constraint_name=:constraint_name"
        ),
        {
            "table_name": table,
            "constraint_name": constraint_name,
        },
    ).first()
    return row is not None


def _index_exists(bind, index_name: str) -> bool:
    row = bind.execute(
        sa.text(
            "select 1 from pg_indexes "
            "where schemaname='public' and indexname=:index_name"
        ),
        {"index_name": index_name},
    ).first()
    return row is not None


def upgrade() -> None:
    bind = op.get_bind()

    # Existing expenses remain valid because every new location field is optional.
    if not _column_exists(bind, "expenses", "location_name"):
        op.add_column(
            "expenses",
            sa.Column("location_name", sa.String(200), nullable=True),
            schema="public",
        )

    if not _column_exists(bind, "expenses", "journey_stop_id"):
        op.add_column(
            "expenses",
            sa.Column(
                "journey_stop_id",
                postgresql.UUID(as_uuid=True),
                nullable=True,
            ),
            schema="public",
        )

    if not _column_exists(bind, "expenses", "latitude"):
        op.add_column(
            "expenses",
            sa.Column("latitude", sa.Float(), nullable=True),
            schema="public",
        )

    if not _column_exists(bind, "expenses", "longitude"):
        op.add_column(
            "expenses",
            sa.Column("longitude", sa.Float(), nullable=True),
            schema="public",
        )

    # A Journey place can be deleted without deleting historical expenses.
    # Keep the stored name/coordinates and only clear the optional reference.
    if not _constraint_exists(bind, "expenses", "fk_expenses_journey_stop"):
        op.create_foreign_key(
            "fk_expenses_journey_stop",
            "expenses",
            "trip_stops",
            ["journey_stop_id"],
            ["id"],
            source_schema="public",
            referent_schema="public",
            ondelete="SET NULL",
        )

    # These indexes mirror the SQLAlchemy Expense model:
    #   journey_stop_id has index=True
    #   ix_expenses_group_location is explicitly declared on (group_id, journey_stop_id)
    if not _index_exists(bind, "ix_expenses_journey_stop_id"):
        op.create_index(
            "ix_expenses_journey_stop_id",
            "expenses",
            ["journey_stop_id"],
            schema="public",
        )

    if not _index_exists(bind, "ix_expenses_group_location"):
        op.create_index(
            "ix_expenses_group_location",
            "expenses",
            ["group_id", "journey_stop_id"],
            schema="public",
        )


def downgrade() -> None:
    bind = op.get_bind()

    if _index_exists(bind, "ix_expenses_group_location"):
        op.drop_index(
            "ix_expenses_group_location",
            table_name="expenses",
            schema="public",
        )

    if _index_exists(bind, "ix_expenses_journey_stop_id"):
        op.drop_index(
            "ix_expenses_journey_stop_id",
            table_name="expenses",
            schema="public",
        )

    if _constraint_exists(bind, "expenses", "fk_expenses_journey_stop"):
        op.drop_constraint(
            "fk_expenses_journey_stop",
            "expenses",
            type_="foreignkey",
            schema="public",
        )

    for column in ("longitude", "latitude", "journey_stop_id", "location_name"):
        if _column_exists(bind, "expenses", column):
            op.drop_column("expenses", column, schema="public")
