"""Add previous_amount to expenses table for edit tracking.

Revision ID: 0011_expense_previous_amount
Revises: 0010_placeholder_members
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0011_expense_previous_amount"
down_revision = "0010_placeholder_members"
branch_labels = None
depends_on = None


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    insp = sa.inspect(bind)
    cols = [col["name"] for col in insp.get_columns(table_name)]
    return column_name in cols


def upgrade() -> None:
    bind = op.get_bind()
    if not _column_exists(bind, "expenses", "previous_amount"):
        op.add_column(
            "expenses",
            sa.Column("previous_amount", sa.Numeric(precision=14, scale=2), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    if _column_exists(bind, "expenses", "previous_amount"):
        op.drop_column("expenses", "previous_amount")
