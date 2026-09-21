"""Add Trip/Journey foundation and ordered itinerary stops."""

from alembic import op
import sqlalchemy as sa

revision = "0004_trip_journey_foundation"
down_revision = "0003_categories_api_db"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "trips",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("group_id", sa.Uuid(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("timezone", sa.String(length=64), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["group_id"], ["public.groups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("group_id", name="uq_trips_group_id"),
        schema="public",
    )
    op.create_index(
        "ix_trips_group_id",
        "trips",
        ["group_id"],
        unique=False,
        schema="public",
    )

    op.create_table(
        "trip_stops",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("trip_id", sa.Uuid(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("stop_type", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=True),
        sa.Column("address", sa.String(length=300), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("sequence >= 0", name="ck_trip_stops_sequence_nonnegative"),
        sa.CheckConstraint(
            "stop_type IN ('start', 'stop', 'destination')",
            name="ck_trip_stops_type",
        ),
        sa.ForeignKeyConstraint(["trip_id"], ["public.trips.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("trip_id", "sequence", name="uq_trip_stops_trip_sequence"),
        schema="public",
    )
    op.create_index(
        "ix_trip_stops_trip_id",
        "trip_stops",
        ["trip_id"],
        unique=False,
        schema="public",
    )
    op.create_index(
        "ix_trip_stops_trip_id_sequence",
        "trip_stops",
        ["trip_id", "sequence"],
        unique=False,
        schema="public",
    )

    # Preserve the application-data boundary: client-facing Supabase roles do
    # not receive direct access to the new trip tables.
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
                REVOKE ALL ON public.trips, public.trip_stops FROM anon;
            END IF;
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                REVOKE ALL ON public.trips, public.trip_stops FROM authenticated;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.drop_index("ix_trip_stops_trip_id_sequence", table_name="trip_stops", schema="public")
    op.drop_index("ix_trip_stops_trip_id", table_name="trip_stops", schema="public")
    op.drop_table("trip_stops", schema="public")
    op.drop_index("ix_trips_group_id", table_name="trips", schema="public")
    op.drop_table("trips", schema="public")
