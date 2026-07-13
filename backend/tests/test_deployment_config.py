import pytest
from pydantic import ValidationError

from app.config import Settings


def test_vercel_requires_external_database() -> None:
    with pytest.raises(ValidationError, match="внешняя база данных"):
        Settings(database_url="sqlite:///./verimed.db", vercel=True, _env_file=None)


def test_vercel_does_not_bootstrap_database_on_application_start() -> None:
    deployed = Settings(
        database_url="postgresql+psycopg://verimed:secret@db.example/verimed",
        vercel=True,
        _env_file=None,
    )
    assert deployed.bootstrap_database_on_start is False


def test_local_development_keeps_explicit_bootstrap() -> None:
    local = Settings(
        database_url="sqlite:///./verimed.db",
        auto_bootstrap_database=True,
        _env_file=None,
    )
    assert local.bootstrap_database_on_start is True


def test_common_postgres_url_uses_installed_psycopg_driver() -> None:
    deployed = Settings(
        database_url="postgresql://verimed:secret@db.example/verimed",
        vercel=True,
        _env_file=None,
    )
    assert deployed.database_url.startswith("postgresql+psycopg://")
