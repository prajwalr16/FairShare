"""Add push_tokens table for push notifications.

Revision ID: 0009_push_tokens
Revises: 0008_expense_date_and_updated_at
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0009_push_tokens"
down_revision = "0008_expense_date_and_updated_at"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    insp = sa.inspect(bind)
    return table_name in insp.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    if not _table_exists(bind, "push_tokens"):
        op.create_table(
            "push_tokens",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("token", sa.String(length=255), nullable=False),
            sa.Column("platform", sa.String(length=32), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )
        op.create_index("ix_push_tokens_user_id", "push_tokens", ["user_id"])
        op.create_index("ix_push_tokens_token", "push_tokens", ["token"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    if _table_exists(bind, "push_tokens"):
        op.drop_index("ix_push_tokens_token", table_name="push_tokens")
        op.drop_index("ix_push_tokens_user_id", table_name="push_tokens")
        op.drop_table("push_tokens")
