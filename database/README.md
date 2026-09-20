# FairShare database

`backend/alembic/` is the canonical migration system for the application.

The files under `database/legacy/` are the historical Supabase SQL migrations from the prototype. They are preserved for audit/reference only and are not the runtime migration path. `0002_revoke_legacy_postgrest_api` removes client-facing privileges from those legacy operations on an existing Supabase database.

## Fresh PostgreSQL database

```powershell
cd backend
alembic upgrade head
```

## Existing FairShare Supabase database

The initial Alembic migration is designed to adopt the existing application tables and data, create the application-owned `public.users` registry, and decouple application foreign keys from `auth.users`.
