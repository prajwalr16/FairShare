"""Add expense categories and align DB write protection with the FastAPI boundary."""

from alembic import op
import sqlalchemy as sa

revision = "0003_categories_api_db"
down_revision = "0002_revoke_legacy_postgrest_api"
branch_labels = None
depends_on = None

CATEGORIES = "Food, Fuel, Stay, Transport, Activities, Shopping, Bills, Other"


def upgrade() -> None:
    bind = op.get_bind()

    # Existing deployments already have expenses; add a safe default for legacy rows.
    columns = {
        row[0]
        for row in bind.execute(
            sa.text(
                "select column_name from information_schema.columns "
                "where table_schema='public' and table_name='expenses'"
            )
        )
    }
    if "category" not in columns:
        op.add_column(
            "expenses",
            sa.Column(
                "category",
                sa.String(30),
                nullable=False,
                server_default="Other",
            ),
            schema="public",
        )

    bind.execute(
        sa.text(
            "update public.expenses set category='Other' "
            "where category is null or category not in "
            "('Food','Fuel','Stay','Transport','Activities','Shopping','Bills','Other')"
        )
    )

    checks = {
        row[0]
        for row in bind.execute(
            sa.text(
                "select constraint_name from information_schema.table_constraints "
                "where table_schema='public' and table_name='expenses' "
                "and constraint_type='CHECK'"
            )
        )
    }
    if "ck_expenses_category" not in checks:
        op.create_check_constraint(
            "ck_expenses_category",
            "expenses",
            "category IN ('Food','Fuel','Stay','Transport','Activities','Shopping','Bills','Other')",
            schema="public",
        )

    indexes = {
        row[0]
        for row in bind.execute(
            sa.text(
                "select indexname from pg_indexes "
                "where schemaname='public' and tablename='expenses'"
            )
        )
    }
    if "ix_expenses_group_category_created" not in indexes:
        op.create_index(
            "ix_expenses_group_category_created",
            "expenses",
            ["group_id", "category", "created_at"],
            schema="public",
        )

    # Replace the legacy Supabase auth.uid()-based triggers. The FastAPI layer
    # is the application data boundary. When Supabase PostgREST provides a JWT,
    # request.jwt.claim.sub is honored for defense-in-depth; trusted backend
    # database connections without a request JWT are allowed to write.
    op.execute(
        """
        create schema if not exists private;

        create or replace function private.is_group_write_member(p_group_id uuid, p_user_id uuid)
        returns boolean
        language sql
        stable
        security definer
        set search_path = public
        as $$
          select exists (select 1 from public.groups g where g.id = p_group_id and g.owner_id = p_user_id)
             or exists (
               select 1 from public.group_members gm
               where gm.group_id = p_group_id
                 and gm.user_id = p_user_id
                 and gm.status = 'active'
                 and gm.role in ('owner','admin','member')
             );
        $$;

        -- Supabase creates these roles, but a clean CI PostgreSQL instance may not.
        -- Revoke from PUBLIC unconditionally, and from provider roles only when they exist.
        revoke all on function private.is_group_write_member(uuid,uuid) from public;
        do $$
        begin
          if exists (select 1 from pg_roles where rolname = 'anon') then
            execute 'revoke all on function private.is_group_write_member(uuid,uuid) from anon';
          end if;
          if exists (select 1 from pg_roles where rolname = 'authenticated') then
            execute 'revoke all on function private.is_group_write_member(uuid,uuid) from authenticated';
          end if;
        end;
        $$;

        create or replace function private.block_viewer_expense_write()
        returns trigger
        language plpgsql
        security definer
        set search_path = public
        as $$
        declare
          v_user_id uuid;
          v_group_id uuid;
        begin
          if nullif(current_setting('request.jwt.claim.sub', true), '') is null then
            if tg_op = 'DELETE' then
              return old;
            end if;
            return new;
          end if;

          v_user_id := current_setting('request.jwt.claim.sub', true)::uuid;
          v_group_id := case when tg_op = 'DELETE' then old.group_id else new.group_id end;
          if not private.is_group_write_member(v_group_id, v_user_id) then
            raise exception 'Viewers cannot create, edit, or delete expenses';
          end if;
          if tg_op = 'DELETE' then
            return old;
          end if;
          return new;
        end;
        $$;

        -- Revoke function access from PUBLIC unconditionally and from optional
        -- Supabase roles only when those roles exist.
        revoke all on function private.block_viewer_expense_write() from public;
        do $$
        begin
          if exists (select 1 from pg_roles where rolname = 'anon') then
            execute 'revoke all on function private.block_viewer_expense_write() from anon';
          end if;
          if exists (select 1 from pg_roles where rolname = 'authenticated') then
            execute 'revoke all on function private.block_viewer_expense_write() from authenticated';
          end if;
        end;
        $$;

        create or replace function private.block_viewer_settlement_write()
        returns trigger
        language plpgsql
        security definer
        set search_path = public
        as $$
        declare
          v_user_id uuid;
          v_group_id uuid;
        begin
          if nullif(current_setting('request.jwt.claim.sub', true), '') is null then
            if tg_op = 'DELETE' then
              return old;
            end if;
            return new;
          end if;

          v_user_id := current_setting('request.jwt.claim.sub', true)::uuid;
          v_group_id := case when tg_op = 'DELETE' then old.group_id else new.group_id end;
          if not private.is_group_write_member(v_group_id, v_user_id) then
            raise exception 'Viewers cannot create, edit, or delete settlements';
          end if;
          if tg_op = 'DELETE' then
            return old;
          end if;
          return new;
        end;
        $$;

        revoke all on function private.block_viewer_settlement_write() from public;
        do $$
        begin
          if exists (select 1 from pg_roles where rolname = 'anon') then
            execute 'revoke all on function private.block_viewer_settlement_write() from anon';
          end if;
          if exists (select 1 from pg_roles where rolname = 'authenticated') then
            execute 'revoke all on function private.block_viewer_settlement_write() from authenticated';
          end if;
        end;
        $$;

        drop trigger if exists prevent_viewer_expense_write on public.expenses;
        create trigger prevent_viewer_expense_write
        before insert or update or delete on public.expenses
        for each row execute function private.block_viewer_expense_write();

        drop trigger if exists prevent_viewer_settlement_write on public.settlements;
        create trigger prevent_viewer_settlement_write
        before insert or update or delete on public.settlements
        for each row execute function private.block_viewer_settlement_write();
        """
    )

    op.alter_column(
        "expenses",
        "category",
        server_default=None,
        schema="public",
    )


def downgrade() -> None:
    # Keep the database backward-compatible; category can safely remain as an
    # application field. Restoring the old auth.uid() triggers would break the
    # FastAPI write boundary.
    pass
