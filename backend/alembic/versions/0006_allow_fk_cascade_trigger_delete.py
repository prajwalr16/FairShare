"""Allow child-row deletes caused by a parent group cascade.

The application intentionally keeps database triggers that block direct
viewer writes to expenses and settlements. PostgreSQL implements ON DELETE
CASCADE using internal triggers, so a legitimate owner-initiated group delete
can otherwise be rejected by those child-row protections.

This revision keeps direct DELETE protection intact while allowing DELETEs
that are nested inside a PostgreSQL trigger (the foreign-key cascade).
"""
from __future__ import annotations

from alembic import op

revision = "0006_cascade_trigger_delete"
down_revision = "0005_trip_day_number"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
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
          -- PostgreSQL's ON DELETE CASCADE is implemented by internal
          -- constraint triggers. A child expense deleted by that cascade is
          -- not a user-initiated expense DELETE and must not be blocked by
          -- the viewer-write guard.
          if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
            return old;
          end if;

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
          -- See the expense trigger above. Allow only nested deletes produced
          -- by PostgreSQL's referential-action cascade.
          if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
            return old;
          end if;

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
        """
    )


def downgrade() -> None:
    # Restore the previous trigger bodies without the nested-cascade exception.
    op.execute(
        """
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
        """
    )
