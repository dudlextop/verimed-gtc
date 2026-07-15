from fastapi.testclient import TestClient

import app.api as api_module
from app.services.analysis_pipeline import AnalysisExecution, MetricValues


def test_health(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "storage_mode": "local_sqlite",
        "database_ready": True,
        "snapshot_ready": True,
        "data_version": None,
    }


def test_summary_contains_live_counts(client: TestClient) -> None:
    response = client.get("/api/analytics/summary")
    assert response.status_code == 200
    payload = response.json()
    assert payload["analysis"]["records_count"] == 15000
    assert payload["analysis"]["organizations_count"] == 20
    assert len(payload["metrics"]) == 5


def test_page_aggregates_are_compact_and_consistent(client: TestClient) -> None:
    home = client.get("/api/analytics/home")
    overview = client.get("/api/analytics/overview")
    assert home.status_code == overview.status_code == 200
    home_payload = home.json()
    overview_payload = overview.json()
    assert home_payload["schema_version"] == 1
    assert overview_payload["schema_version"] == 2
    assert home_payload["summary"] == overview_payload["summary"]
    assert home_payload["command_center"] == overview_payload["command_center"]
    assert overview_payload["pattern_distribution"]


def test_signal_list_is_paginated_and_does_not_embed_detail(client: TestClient) -> None:
    response = client.get("/api/signals?page=2&page_size=7&sort=priority")
    assert response.status_code == 200
    payload = response.json()
    assert payload["page"] == 2
    assert payload["page_size"] == 7
    assert len(payload["items"]) == 7
    assert payload["items"][0]["priority_factors"] == []
    assert payload["items"][0]["priority_explanation"] is None


def test_cache_headers_exclude_mutable_review_data(client: TestClient) -> None:
    stable = client.get("/api/analytics/summary")
    mutable = client.get("/api/signals?page_size=1")
    assert stable.headers["cache-control"].startswith("public")
    assert mutable.headers["cache-control"] == "no-store"


def test_organizations_and_detail(client: TestClient) -> None:
    response = client.get("/api/organizations?page_size=5")
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 20
    detail = client.get(f"/api/organizations/{payload['items'][0]['id']}")
    assert detail.status_code == 200
    assert detail.json()["comparison"]


def test_signal_review_workflow(client: TestClient) -> None:
    listing = client.get("/api/signals?page_size=1").json()
    signal_id = listing["items"][0]["id"]
    response = client.post(
        f"/api/signals/{signal_id}/review",
        json={
            "status": "На рассмотрении",
            "comment": "Проверить медицинское обоснование.",
            "reviewer_name": "Аналитик",
        },
    )
    assert response.status_code == 200
    assert response.json()["status"] == "На рассмотрении"
    assert response.json()["reviews"][0]["comment"] == "Проверить медицинское обоснование."


def test_signals_can_be_filtered_by_recent_period(client: TestClient) -> None:
    all_signals = client.get("/api/signals?page_size=100").json()
    recent = client.get("/api/signals?page_size=100&period_months=1")
    assert recent.status_code == 200
    payload = recent.json()
    assert 0 < payload["total"] <= all_signals["total"]
    assert all(item["date"] >= "2026-06-01" for item in payload["items"])


def test_methodology_is_neutral(client: TestClient) -> None:
    response = client.get("/api/methodology")
    assert response.status_code == 200
    assert "Финальный вывод" in response.json()["disclaimer"]


def test_analysis_metrics_api(client: TestClient) -> None:
    response = client.get("/api/analysis/metrics")
    assert response.status_code == 200
    payload = response.json()
    assert payload["precision"] > 0.7
    assert payload["recall"] > 0.8
    assert payload["manual_review_reduction"] > 0.85


def test_selected_record_count_matches_signal_count(client: TestClient) -> None:
    metrics = client.get("/api/analysis/metrics").json()
    signals = client.get("/api/signals?page_size=1").json()
    assert metrics["true_positive_count"] + metrics["false_positive_count"] == 1441
    assert signals["total"] == 1441


def test_analysis_metrics_by_type_api(client: TestClient) -> None:
    response = client.get("/api/analysis/metrics/by-anomaly-type")
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 8
    assert all(item["anomaly_label"] for item in payload)


def test_run_analysis_api(client: TestClient) -> None:
    response = client.post("/api/analysis/run", json={"seed": 20260712})
    assert response.status_code == 200
    payload = response.json()
    assert payload["records_processed"] == 15000
    assert payload["anomalies_injected"] == 1200
    assert payload["metrics"]["f1"] > 0.8


def test_regenerate_and_run_api_contract(client: TestClient, monkeypatch) -> None:
    expected = AnalysisExecution(
        analysis_run_id=99,
        status="Обработка завершена",
        random_seed=42,
        records_processed=15000,
        anomalies_injected=1200,
        signals_created=1400,
        metrics=MetricValues(
            precision=0.8,
            recall=0.9,
            f1=0.85,
            false_positive_rate=0.02,
            true_positive_count=1080,
            false_positive_count=270,
            false_negative_count=120,
            selected_for_review_rate=0.09,
            manual_review_reduction=0.91,
        ),
    )
    monkeypatch.setattr(api_module, "regenerate_and_run", lambda db, seed: expected)
    response = client.post("/api/analysis/regenerate-and-run", json={"seed": 42})
    assert response.status_code == 200
    assert response.json()["random_seed"] == 42


def test_all_public_read_routes_return_structured_responses(client: TestClient) -> None:
    organization = client.get("/api/organizations?page_size=1").json()["items"][0]
    signal = client.get("/api/signals?page_size=1").json()["items"][0]
    pattern = client.get("/api/patterns?page_size=1").json()["items"][0]
    signal_detail = client.get(f"/api/signals/{signal['id']}").json()

    event = client.post(
        f"/api/signals/{signal['id']}/decision-events",
        json={
            "action_type": "Добавлен комментарий",
            "decision_status": "На рассмотрении",
            "reason_code": "иная причина",
            "comment": "Проверка доступности журнала.",
            "reviewer_id": "audit-expert",
            "reviewer_display_name": "Эксперт проверки",
        },
    )
    assert event.status_code == 200
    event_id = event.json()["id"]

    paths = [
        "/api/health",
        "/api/analytics/summary",
        "/api/analytics/home",
        "/api/analytics/overview",
        "/api/analytics/risk-distribution",
        "/api/analytics/timeline",
        "/api/analytics/key-findings",
        "/api/analytics/command-center",
        "/api/analytics/changes",
        "/api/analytics/financial-impact",
        "/api/analytics/priority-summary",
        "/api/analytics/pattern-summary",
        "/api/analytics/pattern-changes",
        "/api/analytics/expert-review-summary",
        "/api/analytics/expert-review-by-signal-type",
        "/api/analytics/expert-review-by-pattern-type",
        "/api/decision-journal",
        "/api/decision-journal/integrity",
        f"/api/decision-journal/{event_id}",
        "/api/organizations?page_size=1",
        f"/api/organizations/{organization['id']}",
        f"/api/organizations/{organization['id']}/signals?page_size=1",
        f"/api/organizations/{organization['id']}/comparison",
        f"/api/organizations/{organization['id']}/financial-impact",
        f"/api/organizations/{organization['id']}/priority-history",
        f"/api/organizations/{organization['id']}/patterns",
        "/api/signals?page_size=1",
        f"/api/signals/by-fingerprint/{signal_detail['fingerprint']}/decision-history",
        f"/api/signals/{signal['id']}",
        f"/api/signals/{signal['id']}/preview",
        f"/api/signals/{signal['id']}/decision-history",
        f"/api/signals/{signal['id']}/recurrence-history",
        f"/api/signals/{signal['id']}/patterns",
        "/api/patterns?page_size=1",
        f"/api/patterns/by-fingerprint/{pattern['fingerprint']}/decision-history",
        f"/api/patterns/{pattern['id']}",
        f"/api/patterns/{pattern['id']}/signals",
        f"/api/patterns/{pattern['id']}/graph",
        f"/api/patterns/{pattern['id']}/timeline",
        f"/api/patterns/{pattern['id']}/decision-history",
        f"/api/patterns/{pattern['id']}/recurrence-history",
        "/api/methodology",
        "/api/analysis/metrics",
        "/api/analysis/metrics/by-anomaly-type",
    ]
    statuses = {path: client.get(path).status_code for path in paths}
    assert len(paths) == 44
    assert statuses == {path: 200 for path in paths}
