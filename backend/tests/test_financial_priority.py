from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    AnalysisRun,
    FinancialImpactSnapshot,
    MedicalOrganization,
    MedicalRecord,
    OrganizationComparisonSnapshot,
    OrganizationPrioritySnapshot,
    ReviewPriority,
    ReviewStatus,
    RiskLevel,
    RiskSignal,
)
from app.services.analysis_pipeline import run_analysis
from app.services.financial_priority import (
    calculate_review_priority,
    priority_level_for_score,
)
from app.services.organization_model import form_peer_group


def test_financial_snapshot_has_no_double_count(db_session: Session) -> None:
    run_id = db_session.scalar(select(AnalysisRun.id).order_by(AnalysisRun.id.desc()))
    snapshot = db_session.scalar(
        select(FinancialImpactSnapshot).where(
            FinancialImpactSnapshot.analysis_run_id == run_id,
            FinancialImpactSnapshot.scope_type == "period",
            FinancialImpactSnapshot.scope_key == "all",
        )
    )
    assert snapshot is not None
    assert len(snapshot.unique_record_ids) == len(set(snapshot.unique_record_ids))
    expected = db_session.scalar(
        select(func.sum(MedicalRecord.amount)).where(
            MedicalRecord.id.in_(snapshot.unique_record_ids)
        )
    )
    assert snapshot.signal_services_amount == expected


def test_priority_formula_and_contributions() -> None:
    result = calculate_review_priority(
        risk_score=82,
        financial_percentile=90,
        repetition_count=3,
        affected_patients=2,
        status=ReviewStatus.UNREVIEWED,
        has_confirmed_history=False,
        financial_amount=Decimal("4800000"),
        duration_days=90,
    )
    assert result.score == sum(factor.contribution for factor in result.factors)
    assert [factor.weight for factor in result.factors] == [40, 25, 15, 10, 10]
    assert result.level in {RiskLevel.HIGH, RiskLevel.CRITICAL}


def test_priority_levels() -> None:
    assert priority_level_for_score(0) == RiskLevel.LOW
    assert priority_level_for_score(29) == RiskLevel.LOW
    assert priority_level_for_score(30) == RiskLevel.MEDIUM
    assert priority_level_for_score(60) == RiskLevel.HIGH
    assert priority_level_for_score(80) == RiskLevel.CRITICAL
    assert priority_level_for_score(100) == RiskLevel.CRITICAL


def test_priority_increases_with_risk_or_amount() -> None:
    common = dict(
        repetition_count=2,
        affected_patients=1,
        status=ReviewStatus.UNREVIEWED,
        has_confirmed_history=False,
        financial_amount=Decimal("100000"),
        duration_days=10,
    )
    baseline = calculate_review_priority(40, 20, **common)
    higher_risk = calculate_review_priority(80, 20, **common)
    higher_amount = calculate_review_priority(40, 90, **common)
    assert higher_risk.score > baseline.score
    assert higher_amount.score > baseline.score


def test_priorities_are_reproducible(db_session: Session) -> None:
    first = list(
        db_session.execute(
            select(RiskSignal.medical_record_id, ReviewPriority.score)
            .join(ReviewPriority)
            .order_by(RiskSignal.medical_record_id)
        ).all()
    )
    run_analysis(db_session, 20260712)
    second = list(
        db_session.execute(
            select(RiskSignal.medical_record_id, ReviewPriority.score)
            .join(ReviewPriority)
            .order_by(RiskSignal.medical_record_id)
        ).all()
    )
    assert first == second


def test_comparison_uses_existing_peer_group(db_session: Session) -> None:
    organizations = list(db_session.scalars(select(MedicalOrganization)).all())
    organization = organizations[0]
    peer_group = form_peer_group(organization, organizations)
    run_id = db_session.scalar(select(AnalysisRun.id).order_by(AnalysisRun.id.desc()))
    row = db_session.scalar(
        select(OrganizationComparisonSnapshot).where(
            OrganizationComparisonSnapshot.analysis_run_id == run_id,
            OrganizationComparisonSnapshot.organization_id == organization.id,
        )
    )
    assert row is not None
    assert row.peer_group_size == len(peer_group.organization_ids)
    assert row.reliability in {"Высокая", "Средняя", "Низкая"}
    if peer_group.limitation:
        assert row.limitation == peer_group.limitation


def test_history_snapshots_are_saved(db_session: Session) -> None:
    organization_id = db_session.scalar(
        select(MedicalOrganization.id).order_by(MedicalOrganization.id)
    )
    assert organization_id is not None
    before = (
        db_session.scalar(
            select(func.count(OrganizationPrioritySnapshot.id)).where(
                OrganizationPrioritySnapshot.organization_id == organization_id
            )
        )
        or 0
    )
    run_analysis(db_session, 20260712)
    after = (
        db_session.scalar(
            select(func.count(OrganizationPrioritySnapshot.id)).where(
                OrganizationPrioritySnapshot.organization_id == organization_id
            )
        )
        or 0
    )
    assert after == before + 1


def test_financial_and_priority_api_are_structured(client: TestClient) -> None:
    financial = client.get("/api/analytics/financial-impact")
    priority = client.get("/api/analytics/priority-summary")
    assert financial.status_code == 200
    assert priority.status_code == 200
    assert financial.json()["period"]["signal_services_amount"]
    assert financial.json()["period"]["disclaimer"]
    assert priority.json()["top_organization"]["priority_score"] >= 0
    assert priority.json()["top_signal"]["financial_significance"]


def test_organization_financial_comparison_and_history_api(client: TestClient) -> None:
    organization_id = client.get("/api/organizations?page_size=1").json()["items"][0]["id"]
    comparison = client.get(f"/api/organizations/{organization_id}/comparison")
    financial = client.get(f"/api/organizations/{organization_id}/financial-impact")
    history = client.get(f"/api/organizations/{organization_id}/priority-history")
    assert comparison.status_code == 200
    assert len(comparison.json()["items"]) == 10
    assert financial.status_code == 200
    assert financial.json()["signal_amount_share"] >= 0
    assert history.status_code == 200
    assert len(history.json()) >= 3


def test_signal_queue_sorts_by_priority(client: TestClient) -> None:
    response = client.get("/api/signals?page_size=50&sort=priority")
    assert response.status_code == 200
    scores = [item["priority_score"] for item in response.json()["items"]]
    assert scores == sorted(scores, reverse=True)
