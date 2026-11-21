"""Create trip_checklists and trip_checklist_user_status tables.

Revision ID: 0012_trip_checklists
Revises: 0011_expense_previous_amount
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0012_trip_checklists"
down_revision = "0011_expense_previous_amount"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    insp = sa.inspect(bind)
    return table_name in insp.get_table_names()


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    insp = sa.inspect(bind)
    cols = [col["name"] for col in insp.get_columns(table_name)]
    return column_name in cols


def upgrade() -> None:
    bind = op.get_bind()
    if not _column_exists(bind, "trips", "budget"):
        op.add_column(
            "trips",
            sa.Column("budget", sa.Numeric(precision=14, scale=2), nullable=True),
        )

    if not _table_exists(bind, "trip_checklists"):
        op.create_table(
            "trip_checklists",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("group_id", sa.Uuid(), sa.ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("title", sa.String(length=200), nullable=False),
            sa.Column("category", sa.String(length=50), nullable=False, server_default="General"),
            sa.Column("scope", sa.String(length=20), nullable=False, server_default="personal"),
            sa.Column("is_private", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("assigned_to", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
            sa.Column("is_packed_group", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )

    if not _table_exists(bind, "trip_checklist_user_status"):
        op.create_table(
            "trip_checklist_user_status",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("checklist_id", sa.Uuid(), sa.ForeignKey("trip_checklists.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("is_packed", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("packed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("checklist_id", "user_id", name="uq_checklist_user_status"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    if _table_exists(bind, "trip_checklist_user_status"):
        op.drop_table("trip_checklist_user_status")
    if _table_exists(bind, "trip_checklists"):
        op.drop_table("trip_checklists")
    if _column_exists(bind, "trips", "budget"):
        op.drop_column("trips", "budget")
