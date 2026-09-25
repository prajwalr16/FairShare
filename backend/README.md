# FairShare Backend

FastAPI application layer for FairShare.

## Runtime architecture

`Mobile -> FastAPI -> service layer -> repository layer -> SQLAlchemy -> PostgreSQL`

Supabase is currently used for PostgreSQL and Auth. The application data layer uses only `DATABASE_URL`, so another PostgreSQL provider can be used later by changing configuration rather than mobile/business code.

## Local setup

Python 3.12+ is recommended.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
copy .env.example .env
```

Set `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` in `.env`.

Run migrations:

```powershell
alembic upgrade head
```

Start the API:

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The health endpoint is `GET /api/v1/health` and development OpenAPI is at `/docs`.

## Testing

```powershell
pytest -q
```

Tests use SQLite through SQLAlchemy for deterministic application-level integration coverage. Production remains PostgreSQL.
