import json
import os
import subprocess
import sys

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


def test_showcase_mode_uses_bundled_storage_without_database_url() -> None:
    deployed = Settings(
        vercel=True,
        verimed_showcase_mode=True,
        _env_file=None,
    )
    assert deployed.verimed_showcase_mode is True
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


def test_serving_import_does_not_load_ml_stack() -> None:
    environment = os.environ.copy()
    environment.update(
        {
            "VERIMED_SHOWCASE_MODE": "true",
            "AUTO_BOOTSTRAP_DATABASE": "false",
        }
    )
    completed = subprocess.run(
        [
            sys.executable,
            "-c",
            (
                "import json, sys; import app.main; "
                "print(json.dumps([name for name in ('pandas', 'numpy', 'sklearn') "
                "if name in sys.modules]))"
            ),
        ],
        check=True,
        capture_output=True,
        text=True,
        env=environment,
    )
    assert json.loads(completed.stdout.strip()) == []
