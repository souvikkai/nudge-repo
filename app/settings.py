from __future__ import annotations

from pydantic import ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Minimal settings container for the FastAPI service.

    Notes:
    - DATABASE_URL is included now so local dev envs can be shaped,
      but the service does not connect to our Neon Postgres yet (no SQLAlchemy/Alembic).
      DATABASE_URL is required. We fail fast at import time with a clear error
      if it is missing, to avoid ambiguous runtime behavior.
    """


    app_name: str = "nudge-backend"
    environment: str = "dev"

    #Required (no default): supports both local docker Postgres and Neon.
    #Make sure to use SQLAlchemy-compatible URL.
    #Local dev example: postgresql+psycopg://postgres:postgres@localhost:5432/nudge
    #Neon example: postgresql+psycopg://USER:PASSWORD@HOST/DB?sslmode=require
    database_url: str



    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")


try:
    settings = Settings()
except ValidationError as e:
    #This makes the most common failure mode (missing DATABASE_URL) obvious.
    raise RuntimeError(
        "Missing required environment variable DATABASE_URL. "
        "Set DATABASE_URL in your .env (local) or hosting provider (Neon)."
    ) from e
