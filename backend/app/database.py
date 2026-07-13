from collections.abc import Generator
from typing import Any, Literal

from sqlalchemy import create_engine, event
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

is_sqlite = effective_database_url.startswith("sqlite")
connect_args = {"check_same_thread": False, "timeout": 30} if is_sqlite else {}
engine = create_engine(
    effective_database_url,
    connect_args=connect_args,
    pool_pre_ping=not is_sqlite,
)


if is_sqlite:

    @event.listens_for(engine, "connect")
    def configure_sqlite(dbapi_connection: Any, _: Any) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.execute("PRAGMA temp_store=MEMORY")
        cursor.execute("PRAGMA cache_size=-20000")
        if storage_mode == "showcase_sqlite":
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.execute("PRAGMA mmap_size=67108864")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session
