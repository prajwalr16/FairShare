"""Add is_placeholder and display_name to group_members for virtual onboarding.

Revision ID: 0010_placeholder_members
Revises: 0009_push_tokens
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0010_placeholder_members"
down_revision = "0009_push_tokens"
branch_labels = None
depends_on = None


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    insp = sa.inspect(bind)
    cols = [col["name"] for col in insp.get_columns(table_name)]
    return column_name in cols


def upgrade() -> None:
    bind = op.get_bind()
    if not _column_exists(bind, "group_members", "is_placeholder"):
        op.add_column(
            "group_members",
            sa.Column("is_placeholder", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        )
    if not _column_exists(bind, "group_members", "display_name"):
        op.add_column(
            "group_members",
            sa.Column("display_name", sa.String(length=120), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    if _column_exists(bind, "group_members", "display_name"):
        op.drop_column("group_members", "display_name")
    if _column_exists(bind, "group_members", "is_placeholder"):
        op.drop_column("group_members", "is_placeholder")
