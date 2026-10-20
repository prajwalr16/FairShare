# FairShare Backend Local Startup Script
# Usage: Run from powershell via .\start.ps1 (or .\backend\start.ps1 from project root)

$ErrorActionPreference = "Stop"

# Ensure script runs inside the backend directory
$BackendDir = $PSScriptRoot
Set-Location $BackendDir

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FairShare API - Local Dev Environment " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Verify virtual environment exists
$VenvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"
$VenvAlembic = Join-Path $BackendDir ".venv\Scripts\alembic.exe"
$VenvUvicorn = Join-Path $BackendDir ".venv\Scripts\uvicorn.exe"

if (-not (Test-Path $VenvPython)) {
    Write-Host "[ERROR] Virtual environment not found at $BackendDir\.venv" -ForegroundColor Red
    Write-Host "Run the following first:" -ForegroundColor Yellow
    Write-Host "  python -m venv .venv" -ForegroundColor Yellow
    Write-Host "  .\.venv\Scripts\pip install -r requirements.txt" -ForegroundColor Yellow
    exit 1
}

# 2. Verify .env exists
$EnvFile = Join-Path $BackendDir ".env"
if (-not (Test-Path $EnvFile)) {
    Write-Host "[WARNING] .env file not found at $BackendDir\.env" -ForegroundColor Yellow
    Write-Host "Copying from .env.example..." -ForegroundColor Yellow
    if (Test-Path (Join-Path $BackendDir ".env.example")) {
        Copy-Item (Join-Path $BackendDir ".env.example") $EnvFile
        Write-Host "Created .env. Please configure your DATABASE_URL before proceeding." -ForegroundColor Yellow
    }
}

# 3. Run database migrations
Write-Host "`n[1/2] Checking & applying database migrations..." -ForegroundColor Cyan
& $VenvAlembic upgrade head

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n[ERROR] Alembic migration failed! Server will not start." -ForegroundColor Red
    Write-Host "Please check your DATABASE_URL and database connectivity." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "[OK] Database schema is up to date." -ForegroundColor Green

# 4. Start Uvicorn API server
Write-Host "`n[2/2] Starting FairShare FastAPI server..." -ForegroundColor Cyan
Write-Host "  Local API:   http://localhost:8000/api/v1" -ForegroundColor Green
Write-Host "  Swagger UI:  http://localhost:8000/docs" -ForegroundColor Green
Write-Host "  Health check: http://localhost:8000/api/v1/health" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server.`n" -ForegroundColor DarkGray

& $VenvUvicorn app.main:app --reload --host 0.0.0.0 --port 8000

