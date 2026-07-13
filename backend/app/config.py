from functools import lru_cache
from typing import Self

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Verimed API"
    database_url: str = "sqlite:///./verimed.db"
    backend_cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    seed: int = 20260712
    vercel: bool = False
    vercel_env: str | None = None
    auto_bootstrap_database: bool | None = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_postgres_url(cls, value: object) -> object:
        if isinstance(value, str) and value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)
        if isinstance(value, str) and value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    @property
    def cors_origins(self) -> list[str]:
        return [value.strip() for value in self.backend_cors_origins.split(",") if value.strip()]

    @property
    def is_vercel_deployment(self) -> bool:
        return self.vercel or self.vercel_env in {"production", "preview", "development"}

    @property
    def bootstrap_database_on_start(self) -> bool:
        if self.is_vercel_deployment:
            return False
        return self.auto_bootstrap_database if self.auto_bootstrap_database is not None else True

    @model_validator(mode="after")
    def validate_deployed_database(self) -> Self:
        deployment_without_bootstrap = (
            self.is_vercel_deployment or self.auto_bootstrap_database is False
        )
        if deployment_without_bootstrap and self.database_url.startswith("sqlite"):
            raise ValueError(
                "Для развёртывания требуется внешняя база данных в DATABASE_URL; "
                "локальная SQLite предназначена только для разработки и тестов"
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
