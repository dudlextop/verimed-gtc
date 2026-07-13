from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import subprocess
import sys
from pathlib import Path

from app.services.showcase_storage import bundled_snapshot_path, prepare_showcase_database


def _sha256(path: Path) -> str:
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def test_showcase_snapshot_is_bundled_and_contains_expected_data() -> None:
    snapshot = bundled_snapshot_path()
    assert snapshot.is_file()
    assert snapshot.stat().st_size > 1_000_000
    with sqlite3.connect(snapshot) as connection:
        records = connection.execute("SELECT COUNT(*) FROM medical_records").fetchone()
        runs = connection.execute("SELECT COUNT(*) FROM analysis_runs").fetchone()
    assert records == (15_000,)
    assert runs == (3,)


def test_showcase_copy_is_reused_and_new_instance_starts_from_snapshot(tmp_path: Path) -> None:
    snapshot = bundled_snapshot_path()
    snapshot_hash = _sha256(snapshot)

    first = prepare_showcase_database(snapshot, tmp_path / "instance-a")
    with sqlite3.connect(first) as connection:
        connection.execute("CREATE TABLE instance_only (id INTEGER PRIMARY KEY)")
    assert prepare_showcase_database(snapshot, tmp_path / "instance-a") == first

    second = prepare_showcase_database(snapshot, tmp_path / "instance-b")
    with sqlite3.connect(second) as connection:
        instance_table = connection.execute(
            "SELECT name FROM sqlite_master WHERE name = 'instance_only'"
        ).fetchone()
    assert instance_table is None
    assert _sha256(second) == snapshot_hash
    assert _sha256(snapshot) == snapshot_hash


def test_showcase_application_works_without_database_url(tmp_path: Path) -> None:
    snapshot = bundled_snapshot_path()
    snapshot_hash = _sha256(snapshot)
    script = """
import json
from fastapi.testclient import TestClient
from app.database import effective_database_url, showcase_working_path
from app.main import app

with TestClient(app) as client:
    health = client.get('/api/health')
    summary = client.get('/api/analytics/summary')
    signals = client.get('/api/signals?page_size=1')
    patterns = client.get('/api/patterns?page_size=1')
    signal_id = signals.json()['items'][0]['id']
    review = client.post(
        f'/api/signals/{signal_id}/review',
        json={
            'status': 'На рассмотрении',
            'comment': 'Проверка рабочей копии снимка.',
            'reviewer_name': 'Эксперт проверки',
        },
    )
    print(json.dumps({
        'health_status': health.status_code,
        'health': health.json(),
        'summary_status': summary.status_code,
        'records': summary.json()['analysis']['records_count'],
        'signals': signals.json()['total'],
        'patterns': patterns.json()['total'],
        'review_status': review.status_code,
        'review_state': review.json()['status'],
        'database_url': effective_database_url,
        'working_path': str(showcase_working_path),
    }, ensure_ascii=False))
"""
    environment = os.environ.copy()
    environment.pop("DATABASE_URL", None)
    environment.update(
        {
            "VERCEL": "1",
            "VERIMED_SHOWCASE_MODE": "true",
            "AUTO_BOOTSTRAP_DATABASE": "false",
            "VERIMED_SHOWCASE_TEMP_DIR": str(tmp_path / "serverless-instance"),
        }
    )
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=Path(__file__).resolve().parents[1],
        env=environment,
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(result.stdout.strip().splitlines()[-1])
    assert payload["health_status"] == 200
    assert payload["health"] == {
        "status": "ok",
        "storage_mode": "showcase_sqlite",
        "database_ready": True,
        "snapshot_ready": True,
        "data_version": "20260712",
    }
    assert payload["summary_status"] == 200
    assert payload["records"] == 15_000
    assert payload["signals"] == 1_441
    assert payload["patterns"] == 73
    assert payload["review_status"] == 200
    assert payload["review_state"] == "На рассмотрении"
    assert payload["database_url"].startswith("sqlite:////")
    assert payload["working_path"].startswith(str(tmp_path))
    assert _sha256(snapshot) == snapshot_hash
