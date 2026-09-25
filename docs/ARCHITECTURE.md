# FairShare Production Architecture

## Responsibilities

- Mobile: presentation, navigation, form UX, optimistic/local calculations for feedback.
- FastAPI: authenticated API boundary, authorization, validation, business rules, transactions, and orchestration.
- SQLAlchemy: persistence abstraction and PostgreSQL data access.
- Alembic: versioned, reproducible database migrations.
- Supabase Auth: authentication/session provider.
- PostgreSQL: durable application state.

## Provider portability

The application data layer depends on `DATABASE_URL` and SQLAlchemy, not on Supabase client APIs. A different PostgreSQL provider can therefore be configured through backend environment variables. Supabase Auth can remain the identity provider until a separate identity migration is desired.

The project does not promise that one migration script is portable across every SQL database engine. PostgreSQL is the database contract for this release.

## Database migration policy

Never manually edit the production schema as the normal workflow. Create an Alembic migration, test it against a fresh PostgreSQL database, then run `alembic upgrade head` in the target environment.

The second migration revokes legacy Supabase PostgREST table/RPC privileges so the mobile client cannot bypass the FastAPI application boundary. Legacy SQL is retained only under `database/legacy/`.
