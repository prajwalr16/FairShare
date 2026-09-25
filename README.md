# FairShare

FairShare is a React Native/Expo expense-sharing application backed by a FastAPI application layer and PostgreSQL.

## Architecture

```text
React Native / Expo
        |
        v
     FastAPI
        |
        v
    Services
        |
        v
   Repositories
        |
        v
    SQLAlchemy
        |
        v
    PostgreSQL
```

Supabase currently provides PostgreSQL and authentication. Mobile authentication/session operations continue to use Supabase Auth. Application data and business operations go through FastAPI.

`DATABASE_URL` is the database-provider boundary. Any compatible PostgreSQL provider can be selected by changing the backend connection URL. PostgreSQL is the database contract for this release; this package does not claim transparent MySQL/SQLite production portability.

## Project structure

```text
mobile/       React Native + Expo application
backend/      FastAPI + SQLAlchemy + Alembic
supabase/     Supabase infrastructure kept for the invitation compatibility function
 database/     Historical prototype SQL migrations for audit/reference
 docs/         Architecture, roadmap and verification material
```

## Backend setup

Python 3.12+ is recommended.

```powershell
cd backend
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
python -m pip install -r requirements.txt
copy .env.example .env
```

Set `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` in `backend/.env`.

Apply the canonical schema:

```powershell
alembic upgrade head
```

Start the API:

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API health endpoint is `GET /api/v1/health`. Development OpenAPI is available at `/docs`.

## Mobile setup

```powershell
cd mobile
npm install
npx expo start
```

Create `mobile/.env` from `mobile/.env.example` and set `EXPO_PUBLIC_API_URL` to a URL reachable by the device, for example:

```text
http://192.168.1.10:8000/api/v1
```

## Testing

Backend:

```powershell
cd backend
pytest -q
```

Mobile static validation:

```powershell
cd mobile
npx tsc --noEmit
```

CI additionally starts a clean PostgreSQL 16 service, applies Alembic migrations twice, verifies the schema, and runs the API test suite against that migrated schema.

## Database migration policy

Alembic migrations under `backend/alembic/versions` are the canonical schema source. The historical SQL files in `database/legacy` are retained for reference only.

For an existing FairShare Supabase database, migration `0001_initial_schema` adopts the existing application data and decouples application foreign keys from `auth.users`. Migration `0002_revoke_legacy_postgrest_api` removes client-facing access to legacy table/RPC operations.

Do not put `.env` files or production secrets into Git.
