# FairShare Production Refactor Status

## Current release
Architecture refactor baseline: FastAPI + SQLAlchemy + Alembic + PostgreSQL, with Supabase Auth retained.

## Completed in this package

- FastAPI application boundary for FairShare data and business operations.
- SQLAlchemy models and repository/service layers.
- Alembic canonical migration chain with existing-Supabase adoption logic.
- Supabase Auth verification from FastAPI.
- Groups, members, invitations, roles and permissions.
- Expenses, all four split modes, payer selection, edit and delete.
- Balances, direct/simplified debts and settlement lifecycle.
- Group settings and currency rules.
- History and categorized Group Details UI.
- Mobile data services migrated from direct Supabase data access to FastAPI.
- Legacy client-facing Supabase table/RPC privileges revoked by Alembic migration.
- Automated backend tests against SQLite.
- PostgreSQL migration/API test job defined in GitHub Actions.

## Verification boundary

Local execution in this build environment validated Python compilation, backend API tests, Alembic revision chain metadata, mobile TS/TSX transpilation and local import resolution.

A live PostgreSQL service and full Expo install are not available in this environment, so PostgreSQL and Expo runtime checks are defined in CI but were not falsely marked as locally executed.
