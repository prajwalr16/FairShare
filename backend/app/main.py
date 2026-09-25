from time import perf_counter

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .api.route_routes import route_router
from .api.routes import router
from .api.trip_routes import trip_router
from .core.config import get_settings
from .core.security import warm_jwks_cache

settings = get_settings()
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url="/redoc" if settings.environment != "production" else None,
)


@app.on_event("startup")
def warm_auth_keys() -> None:
    warm_jwks_cache()


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=settings.cors_origins.strip() != "*",
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


@app.middleware("http")
async def add_response_timing(request: Request, call_next):
    started = perf_counter()
    response = await call_next(request)
    elapsed_ms = (perf_counter() - started) * 1000
    response.headers["X-Response-Time-Ms"] = f"{elapsed_ms:.1f}"
    return response


app.include_router(router)
app.include_router(trip_router)
app.include_router(route_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"status": "healthy", "app": settings.app_name, "version": settings.app_version}
