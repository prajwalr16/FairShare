"""Add expense_date and updated_at timestamps.

Revision ID: 0008_expense_date_and_updated_at
Revises: 0007_expense_locations
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0008_expense_date_and_updated_at"
down_revision = "0007_expense_locations"
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
    is_postgres = bind.dialect.name == "postgresql"

    # 1. Expenses: expense_date & updated_at
    if not is_postgres or not _column_exists(bind, "expenses", "expense_date"):
        op.add_column(
            "expenses",
            sa.Column("expense_date", sa.DateTime(timezone=True), nullable=True),
            schema="public",
        )
        op.execute(sa.text("UPDATE public.expenses SET expense_date = created_at WHERE expense_date IS NULL"))
        with op.batch_alter_table("expenses", schema="public") as batch_op:
            batch_op.alter_column(
                "expense_date",
                nullable=False,
                server_default=sa.func.now(),
            )

    if not is_postgres or not _column_exists(bind, "expenses", "updated_at"):
        op.add_column(
            "expenses",
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            schema="public",
        )
        op.execute(sa.text("UPDATE public.expenses SET updated_at = created_at WHERE updated_at IS NULL"))
        with op.batch_alter_table("expenses", schema="public") as batch_op:
            batch_op.alter_column(
                "updated_at",
                nullable=False,
                server_default=sa.func.now(),
            )

    if not is_postgres or not _index_exists(bind, "ix_expenses_expense_date"):
        op.create_index(
            "ix_expenses_expense_date",
            "expenses",
            ["expense_date"],
            schema="public",
        )

    # 2. Groups: updated_at
    if not is_postgres or not _column_exists(bind, "groups", "updated_at"):
        op.add_column(
            "groups",
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            schema="public",
        )
        op.execute(sa.text("UPDATE public.groups SET updated_at = created_at WHERE updated_at IS NULL"))
        with op.batch_alter_table("groups", schema="public") as batch_op:
            batch_op.alter_column(
                "updated_at",
                nullable=False,
                server_default=sa.func.now(),
            )

    # 3. Group Members: updated_at
    if not is_postgres or not _column_exists(bind, "group_members", "updated_at"):
        op.add_column(
            "group_members",
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            schema="public",
        )
        op.execute(sa.text("UPDATE public.group_members SET updated_at = created_at WHERE updated_at IS NULL"))
        with op.batch_alter_table("group_members", schema="public") as batch_op:
            batch_op.alter_column(
                "updated_at",
                nullable=False,
                server_default=sa.func.now(),
            )

    # 4. Settlements: updated_at
    if not is_postgres or not _column_exists(bind, "settlements", "updated_at"):
        op.add_column(
            "settlements",
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            schema="public",
        )
        op.execute(sa.text("UPDATE public.settlements SET updated_at = created_at WHERE updated_at IS NULL"))
        with op.batch_alter_table("settlements", schema="public") as batch_op:
            batch_op.alter_column(
                "updated_at",
                nullable=False,
                server_default=sa.func.now(),
            )

    # 5. PostgreSQL Triggers for automatic updated_at timestamp maintenance
    if is_postgres:
        op.execute(
            """
            create or replace function public.set_updated_at()
            returns trigger
            language plpgsql
            as $$
            begin
              new.updated_at = now();
              return new;
            end;
            $$;
            """
        )
        for tbl in ("expenses", "groups", "group_members", "settlements"):
            op.execute(
                f"""
                drop trigger if exists tr_{tbl}_set_updated_at on public.{tbl};
                create trigger tr_{tbl}_set_updated_at
                before update on public.{tbl}
                for each row execute function public.set_updated_at();
                """
            )


def downgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    if is_postgres:
        for tbl in ("expenses", "groups", "group_members", "settlements"):
            op.execute(f"drop trigger if exists tr_{tbl}_set_updated_at on public.{tbl};")
        op.execute("drop function if exists public.set_updated_at();")

    for tbl, cols in (
        ("expenses", ("expense_date", "updated_at")),
        ("groups", ("updated_at",)),
        ("group_members", ("updated_at",)),
        ("settlements", ("updated_at",)),
    ):
        with op.batch_alter_table(tbl, schema="public") as batch_op:
            for col in cols:
                if not is_postgres or _column_exists(bind, tbl, col):
                    if tbl == "expenses" and col == "expense_date" and (not is_postgres or _index_exists(bind, "ix_expenses_expense_date")):
                        try:
                            op.drop_index("ix_expenses_expense_date", table_name="expenses", schema="public")
                        except Exception:
                            pass
                    batch_op.drop_column(col)

