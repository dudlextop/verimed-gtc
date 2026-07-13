from __future__ import annotations

import os
import sqlite3
import sys
from pathlib import Path

SEED = 20260712
ANALYSIS_RUNS = 3
BACKEND_ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = BACKEND_ROOT / "app" / "showcase" / "verimed-showcase.db"
sys.path.insert(0, str(BACKEND_ROOT))


def main() -> None:
    SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT.unlink(missing_ok=True)
    os.environ["DATABASE_URL"] = f"sqlite:///{SNAPSHOT}"
    os.environ["AUTO_BOOTSTRAP_DATABASE"] = "true"
    os.environ.pop("VERIMED_SHOWCASE_MODE", None)

    from alembic.config import Config

    from alembic import command

    alembic_config = Config(str(BACKEND_ROOT / "alembic.ini"))
    alembic_config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    command.upgrade(alembic_config, "head")

    from app.database import SessionLocal
    from app.seed import seed_database
    from app.services.analysis_pipeline import run_analysis

    with SessionLocal() as db:
        execution = seed_database(db, force=True, random_seed=SEED)
        if execution is None:
            raise RuntimeError("Не удалось сформировать исходный анализ")
        for _ in range(ANALYSIS_RUNS - 1):
            run_analysis(db, SEED)

    with sqlite3.connect(SNAPSHOT) as connection:
        connection.execute("VACUUM")
        integrity = connection.execute("PRAGMA integrity_check").fetchone()
    if integrity is None or integrity[0] != "ok":
        raise RuntimeError("Проверка целостности снимка данных не пройдена")

    print(f"Снимок создан: {SNAPSHOT.name}, {SNAPSHOT.stat().st_size} байт")


if __name__ == "__main__":
    main()
