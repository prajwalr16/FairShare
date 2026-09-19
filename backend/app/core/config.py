from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration.

    DATABASE_URL is the only database-specific setting used by the application.
    The same code can therefore point at any compatible PostgreSQL provider.
    Supabase remains the current PostgreSQL/auth provider, but is not embedded
    in the business/data access layer.
    """

    app_name: str = "FairShare API"
    app_version: str = "3.0.0"
    environment: str = "development"

    database_url: str = Field(description="SQLAlchemy database URL")

    supabase_url: str = Field(description="Supabase project URL for Auth")
    supabase_publishable_key: str = Field(description="Supabase publishable key")
    supabase_secret_key: str | None = None
    supabase_service_role_key: str | None = None

    cors_origins: str = "*"
    auth_timeout_seconds: float = Field(default=10.0, ge=1.0, le=60.0)
    api_prefix: str = "/api/v1"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @property
    def supabase_admin_key(self) -> str:
        value = self.supabase_secret_key or self.supabase_service_role_key
        if not value:
            raise RuntimeError(
                "Set SUPABASE_SECRET_KEY for invitations/admin auth operations."
            )
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


def normalize_database_url(value: str) -> str:
    """Normalize common URLs for SQLAlchemy.

    PostgreSQL URLs are accepted in either psycopg dialect form or the usual
    provider URL form. SQLite is allowed for automated tests.
    """

    value = value.strip()
    if value.startswith("postgres://"):
        return value.replace("postgres://", "postgresql+psycopg://", 1)
    if value.startswith("postgresql://"):
        return value.replace("postgresql://", "postgresql+psycopg://", 1)
    if value.startswith("postgresql+psycopg://"):
        return value
    if value.startswith("sqlite:///"):
        return value
    raise ValueError(
        "DATABASE_URL must be a PostgreSQL URL (postgresql:// or postgres://) "
        "or a sqlite:/// URL for tests."
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
