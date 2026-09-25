"""Add day number to trip itinerary stops for day-by-day planning."""

from alembic import op
import sqlalchemy as sa

revision = "0005_trip_day_number"
down_revision = "0004_trip_journey_foundation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "trip_stops",
        sa.Column("day_number", sa.Integer(), nullable=False, server_default="1"),
        schema="public",
    )
    op.create_check_constraint(
        "ck_trip_stops_day_number_positive",
        "trip_stops",
        "day_number >= 1",
        schema="public",
    )
    op.create_index(
        "ix_trip_stops_trip_day",
        "trip_stops",
        ["trip_id", "day_number"],
        unique=False,
        schema="public",
    )
    op.alter_column(
        "trip_stops",
        "day_number",
        server_default=None,
        schema="public",
    )


def downgrade() -> None:
    op.drop_index("ix_trip_stops_trip_day", table_name="trip_stops", schema="public")
    op.drop_constraint("ck_trip_stops_day_number_positive", "trip_stops", schema="public", type_="check")
    op.drop_column("trip_stops", "day_number", schema="public")
