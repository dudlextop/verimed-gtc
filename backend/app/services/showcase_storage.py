from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path

SHOWCASE_DATA_VERSION = "20260712"
SHOWCASE_DATABASE_NAME = "verimed-showcase.db"


def bundled_snapshot_path() -> Path:
    """Return the immutable SQLite snapshot shipped with the backend package."""
    return Path(__file__).resolve().parents[1] / "showcase" / SHOWCASE_DATABASE_NAME


def default_work_directory() -> Path:
    """Return a writable directory supported by serverless Python runtimes."""
    return Path(tempfile.gettempdir()) / "verimed-showcase"


def prepare_showcase_database(snapshot: Path, work_directory: Path) -> Path:
    """Copy the bundled snapshot once and return the writable instance-local copy."""
    if not snapshot.is_file():
        raise RuntimeError("Снимок данных публичной версии не найден")

    work_directory.mkdir(parents=True, exist_ok=True)
    work_database = work_directory / f"verimed-showcase-{SHOWCASE_DATA_VERSION}.db"
    if work_database.is_file() and work_database.stat().st_size > 0:
        return work_database

    temporary_copy = work_directory / f".{work_database.name}.{os.getpid()}.tmp"
    try:
        shutil.copyfile(snapshot, temporary_copy)
        os.replace(temporary_copy, work_database)
    finally:
        temporary_copy.unlink(missing_ok=True)
    return work_database
