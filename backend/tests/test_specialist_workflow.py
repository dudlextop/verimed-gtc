from datetime import date, datetime
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.database import Base
from app.models import AnalysisRun, MedicalOrganization, ReviewStatus, RiskLevel, RiskSignal
from app.services.analytics import get_changes


def _analysis_run(run_id: int, **values: object) -> AnalysisRun:
    defaults: dict[str, object] = {
        "id": run_id,
        "started_at": datetime(2026, 7, 12, 9, 0),
        "completed_at": datetime(2026, 7, 12, 9, run_id),
        "period_start": date(2026, 1, 1),
        "period_end": date(2026, 6, 30),
        "records_processed": 100,
        "status": "Обработка завершена",
        "signals_created": 0,
        "signal_record_ids": [],
        "high_risk_record_ids": [],
        "organization_risk_scores": {},
        "review_amount": Decimal("0"),
        "selected_for_review_rate": 0.0,
        "completed_reviews_count": 0,
    }
    defaults.update(values)
    return AnalysisRun(**defaults)


def test_command_center_returns_live_aggregates(client: TestClient, db_session: Session) -> None:
    response = client.get("/api/analytics/command-center")
    assert response.status_code == 200
    payload = response.json()
    expected_unreviewed = db_session.scalar(
        select(func.count(RiskSignal.id)).where(RiskSignal.status == ReviewStatus.UNREVIEWED)
    )
    expected_organizations = db_session.scalar(
        select(func.count(MedicalOrganization.id)).where(MedicalOrganization.risk_score >= 60)
    )
    assert payload["signals_without_decision"] == expected_unreviewed
    assert payload["high_risk_organizations"] == expected_organizations
    assert payload["priority_organization"]["high_risk_signals"] > 0
    assert payload["review_amount"] != "0.00"


def test_priority_organization_is_reproducible(client: TestClient) -> None:
    first = client.get("/api/analytics/command-center").json()["priority_organization"]
    second = client.get("/api/analytics/command-center").json()["priority_organization"]
    assert first == second


def test_changes_compare_two_analysis_runs() -> None:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add_all(
            [
                _analysis_run(
                    1,
                    signal_record_ids=[1, 2, 3],
                    organization_risk_scores={"1": 40, "2": 75},
                    review_amount=Decimal("100000"),
                    selected_for_review_rate=0.03,
                ),
                _analysis_run(
                    2,
                    signal_record_ids=[2, 3, 4, 5],
                    organization_risk_scores={"1": 56, "2": 60},
                    review_amount=Decimal("145000"),
                    selected_for_review_rate=0.04,
                    completed_reviews_count=7,
                ),
            ]
        )
        db.commit()
        changes = get_changes(db)
    assert changes.comparison_available is True
    assert changes.new_signals == 2
    assert changes.resolved_signals == 1
    assert changes.organizations_risk_increased == 1
    assert changes.organizations_risk_decreased == 1
    assert changes.review_amount_change == Decimal("45000")
    assert changes.completed_reviews == 7
    assert changes.selected_for_review_rate_change == 0.01


def test_changes_explain_absent_previous_run() -> None:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add(_analysis_run(1, signal_record_ids=[1, 2]))
        db.commit()
        changes = get_changes(db)
    assert changes.comparison_available is False
    assert changes.current_run_id == 1
    assert changes.previous_run_id is None


def test_signal_preview_contains_required_context(client: TestClient) -> None:
    signal_id = client.get("/api/signals?page_size=1").json()["items"][0]["id"]
    response = client.get(f"/api/signals/{signal_id}/preview")
    assert response.status_code == 200
    payload = response.json()
    assert payload["score"] >= 0
    assert payload["level"] in {level.value for level in RiskLevel}
    assert payload["factors"]
    assert payload["limitations"]
    assert payload["related_services"]
    assert all("relationship_explanation" in item for item in payload["related_services"])


def test_review_updates_preview_status_and_history(client: TestClient) -> None:
    signal_id = client.get("/api/signals?page_size=1").json()["items"][0]["id"]
    response = client.post(
        f"/api/signals/{signal_id}/review",
        json={
            "status": "Направлено на углублённую проверку",
            "comment": "Проверить временную последовательность услуг.",
            "reviewer_name": "Аналитик",
        },
    )
    assert response.status_code == 200
    preview = client.get(f"/api/signals/{signal_id}/preview").json()
    assert preview["status"] == "Направлено на углублённую проверку"
    assert preview["reviews"][0]["comment"] == "Проверить временную последовательность услуг."


def test_rejection_requires_comment(client: TestClient) -> None:
    signal_id = client.get("/api/signals?page_size=1").json()["items"][0]["id"]
    response = client.post(
        f"/api/signals/{signal_id}/review",
        json={"status": "Сигнал не подтверждён", "comment": "", "reviewer_name": "Аналитик"},
    )
    assert response.status_code == 422
