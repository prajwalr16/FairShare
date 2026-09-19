"""Revoke legacy Supabase PostgREST data/RPC access.

The prototype exposed application operations through public SQL functions.
The FastAPI service is now the application API boundary, so authenticated and
anonymous PostgREST roles must not retain execute privileges on those legacy
functions. The functions are left in place for safe rollback/reference, but
they are no longer callable by the client-facing PostgREST roles.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0002_revoke_legacy_postgrest_api"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    op.execute("""
        DO $$
        DECLARE fn record;
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
               OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                FOR fn IN
                    SELECT n.nspname AS schema_name, p.oid::regprocedure AS signature
                    FROM pg_proc p
                    JOIN pg_namespace n ON n.oid = p.pronamespace
                    WHERE n.nspname IN ('public', 'private')
                      AND p.proname IN (
                        'get_group_balances',
                        'record_group_settlement',
                        'update_group_settlement',
                        'delete_group_settlement',
                        'update_expense_with_splits',
                        'delete_expense',
                        'create_expense_with_splits',
                        'create_equal_expense',
                        'get_group_member_roles',
                        'get_group_settings',
                        'update_group_settings',
                        'leave_group',
                        'delete_group',
                        'update_group_member_role',
                        'lookup_user_by_email',
                        'accept_group_invitation'
                      )
                LOOP
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
                        EXECUTE 'REVOKE ALL ON FUNCTION ' || fn.signature || ' FROM anon';
                    END IF;
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                        EXECUTE 'REVOKE ALL ON FUNCTION ' || fn.signature || ' FROM authenticated';
                    END IF;
                END LOOP;
            END IF;
        END $$;
    """)

    # Keep explicit table privileges revoked as a second layer.
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
                REVOKE ALL ON public.users, public.groups, public.group_members, public.expenses, public.expense_splits, public.settlements FROM anon;
            END IF;
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                REVOKE ALL ON public.users, public.groups, public.group_members, public.expenses, public.expense_splits, public.settlements FROM authenticated;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    # Privilege restoration is intentionally not automatic: restoring legacy
    # client-facing RPC access would bypass the FastAPI application boundary.
    pass
