from __future__ import annotations

from uuid import UUID

from pydantic import ValidationError, Field
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

    #Minimal MVP auth:
    #If X-User-Id header is missing, we fall back to this fixed UUID.
    #Set it in .env for local dev; do NOT use this in production auth.
    dev_user_id: UUID = UUID("00000000-0000-0000-0000-000000000001")
    
        # -----------------------------
    # LLM tier registry (provider-agnostic)
    # -----------------------------
    llm_default_model_key: str = Field(
        default="mid",
        validation_alias="LLM_DEFAULT_MODEL_KEY",
    )

    llm_strong_provider: str = Field(default="placeholder", validation_alias="LLM_STRONG_PROVIDER")
    llm_strong_model: str = Field(default="placeholder", validation_alias="LLM_STRONG_MODEL")
    llm_strong_base_url: str | None = Field(default=None, validation_alias="LLM_STRONG_BASE_URL")
    llm_strong_api_key: str | None = Field(default=None, validation_alias="LLM_STRONG_API_KEY")

    llm_mid_provider: str = Field(default="placeholder", validation_alias="LLM_MID_PROVIDER")
    llm_mid_model: str = Field(default="placeholder", validation_alias="LLM_MID_MODEL")
    llm_mid_base_url: str | None = Field(default=None, validation_alias="LLM_MID_BASE_URL")
    llm_mid_api_key: str | None = Field(default=None, validation_alias="LLM_MID_API_KEY")

    llm_budget_provider: str = Field(default="placeholder", validation_alias="LLM_BUDGET_PROVIDER")
    llm_budget_model: str = Field(default="placeholder", validation_alias="LLM_BUDGET_MODEL")
    llm_budget_base_url: str | None = Field(default=None, validation_alias="LLM_BUDGET_BASE_URL")
    llm_budget_api_key: str | None = Field(default=None, validation_alias="LLM_BUDGET_API_KEY")

    def get_model_config(self, model_key: str) -> dict:
        """
        Return the tier config for a given model_key ∈ {"strong","mid","budget"}.

        Returns dict with:
          provider, model, base_url, api_key
        """
        key = (model_key or "").strip().lower()
        if key == "strong":
            return {
                "provider": self.llm_strong_provider,
                "model": self.llm_strong_model,
                "base_url": self.llm_strong_base_url,
                "api_key": self.llm_strong_api_key,
            }
        if key == "mid":
            return {
                "provider": self.llm_mid_provider,
                "model": self.llm_mid_model,
                "base_url": self.llm_mid_base_url,
                "api_key": self.llm_mid_api_key,
            }
        if key == "budget":
            return {
                "provider": self.llm_budget_provider,
                "model": self.llm_budget_model,
                "base_url": self.llm_budget_base_url,
                "api_key": self.llm_budget_api_key,
            }
        raise ValueError("Invalid model_key")

    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")


try:
    settings = Settings()
except ValidationError as e:
    #This makes the most common failure mode (missing DATABASE_URL) obvious.
    raise RuntimeError(
        "Missing required environment variable DATABASE_URL. "
        "Set DATABASE_URL in your .env (local) or hosting provider (Neon)."
    ) from e
