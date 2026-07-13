from __future__ import annotations

from typing import Literal

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.schemas import HealthStatus
from app.services.showcase_storage import SHOWCASE_DATA_VERSION

StorageMode = Literal["showcase_sqlite", "postgres", "local_sqlite"]


def get_storage_health(
    db: Session,
    *,
    storage_mode: StorageMode,
    snapshot_ready: bool,
) -> HealthStatus:
    database_ready = True
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        database_ready = False

    required_snapshot_ready = snapshot_ready if storage_mode == "showcase_sqlite" else True
    return HealthStatus(
        status="ok" if database_ready and required_snapshot_ready else "error",
        storage_mode=storage_mode,
        database_ready=database_ready,
        snapshot_ready=snapshot_ready,
        data_version=(SHOWCASE_DATA_VERSION if storage_mode == "showcase_sqlite" else None),
    )
