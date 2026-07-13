from collections.abc import Generator
from typing import Literal

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings
from app.services.showcase_storage import (
    bundled_snapshot_path,
    default_work_directory,
    prepare_showcase_database,
)


class Base(DeclarativeBase):
    pass


showcase_snapshot_path = bundled_snapshot_path()
showcase_working_path = None
storage_mode: Literal["showcase_sqlite", "postgres", "local_sqlite"]
if settings.verimed_showcase_mode:
    showcase_working_path = prepare_showcase_database(
        showcase_snapshot_path,
        settings.verimed_showcase_temp_dir or default_work_directory(),
    )
    effective_database_url = f"sqlite:///{showcase_working_path}"
    storage_mode = "showcase_sqlite"
elif settings.database_url.startswith("sqlite"):
    effective_database_url = settings.database_url
    storage_mode = "local_sqlite"
else:
    effective_database_url = settings.database_url
    storage_mode = "postgres"

connect_args = {"check_same_thread": False} if effective_database_url.startswith("sqlite") else {}
engine = create_engine(effective_database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session
