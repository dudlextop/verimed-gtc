from datetime import date, time
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AnalysisMetric,
    MedicalOrganization,
    MedicalRecord,
    MedicalService,
    OrganizationAnomalyScore,
    RiskLevel,
)
from app.services.analysis_pipeline import calculate_metric_values, run_analysis
from app.services.detection import (
    RuleDetection,
    detect_short_interval_repeats,
    detect_temporal_conflicts,
)
from app.services.organization_model import OrganizationModelResult, PeerGroup, form_peer_group
from app.services.risk import calculate_risk, risk_level_for_score
from app.synthetic.catalog import ANOMALY_LABELS


def _organization(identifier: int, region: str = "Астана") -> MedicalOrganization:
    return MedicalOrganization(
        id=identifier,
        name=f"Организация {identifier}",
        region=region,
        organization_type="Городская поликлиника",
        specialization="Общий профиль",
        capacity=500,
    )


def _service() -> MedicalService:
    return MedicalService(
        id=1,
        code="TEST-1",
        name="Тестовая медицинская услуга",
        category="Консультации",
        typical_cost=Decimal("10000"),
        minimum_interval_days=7,
        expected_duration_minutes=30,
        maximum_frequency_30d=3,
        allowed_organization_types=["Городская поликлиника"],
    )


def _record(
    identifier: int,
    organization: MedicalOrganization,
    service: MedicalService,
    day: date,
    start: time,
) -> MedicalRecord:
    return MedicalRecord(
        id=identifier,
        organization_id=organization.id,
        patient_id=1,
        doctor_id=1,
        service_id=service.id,
        service_date=day,
        service_time=start,
        amount=Decimal("10000"),
        organization=organization,
        service=service,
    )


def test_normal_boundary_at_minimum_interval_has_no_signal() -> None:
    organization = _organization(1)
    service = _service()
    first = _record(1, organization, service, date(2026, 1, 1), time(9))
    second = _record(2, organization, service, date(2026, 1, 8), time(9))
    assert detect_short_interval_repeats([first, second]) == []


def test_sequential_services_in_one_organization_are_not_temporal_conflict() -> None:
    organization = _organization(1)
    service = _service()
    first = _record(1, organization, service, date(2026, 1, 1), time(9))
    second = _record(2, organization, service, date(2026, 1, 1), time(9, 30))
    assert detect_temporal_conflicts([first, second]) == []


@pytest.mark.parametrize(
    "score, expected",
    [
        (0, RiskLevel.LOW),
        (29, RiskLevel.LOW),
        (30, RiskLevel.MEDIUM),
        (59, RiskLevel.MEDIUM),
        (60, RiskLevel.HIGH),
        (79, RiskLevel.HIGH),
        (80, RiskLevel.CRITICAL),
        (100, RiskLevel.CRITICAL),
    ],
)
def test_risk_levels(score: int, expected: RiskLevel) -> None:
    assert risk_level_for_score(score) == expected


def test_risk_formula_and_factor_contributions() -> None:
    detection = RuleDetection(
        record_id=1,
        anomaly_type="price_deviation",
        severity=80,
        related_record_ids=(1,),
        actual_value="18 400 тенге",
        typical_value="10 900 тенге",
        explanation="Стоимость выше устойчивого диапазона.",
    )
    peer_group = PeerGroup("Группа", (1, 2, 3, 4), "")
    organization_result = OrganizationModelResult(
        organization_id=1,
        score=50,
        peer_group=peer_group,
        explanation="Отклонение от медианы группы.",
        feature_deviations={},
        top_category="",
    )
    result = calculate_risk([detection], organization_result, financial_score=60)
    assert result.score == round(0.55 * 80 + 0.30 * 50 + 0.15 * 60)
    assert sum(factor.contribution for factor in result.factors) == result.score
    assert len(result.limitations) >= 4


def test_metric_calculation() -> None:
    result = calculate_metric_values(100, {1, 2, 3, 4}, {1, 2, 5})
    assert result.true_positive_count == 2
    assert result.false_positive_count == 1
    assert result.false_negative_count == 2
    assert result.precision == pytest.approx(2 / 3, abs=0.0001)
    assert result.recall == 0.5
    assert result.selected_for_review_rate == 0.03
    assert result.manual_review_reduction == 0.97


def test_peer_group_expands_when_exact_group_is_small() -> None:
    organizations = [_organization(index, f"Регион {index}") for index in range(1, 5)]
    group = form_peer_group(organizations[0], organizations)
    assert group.organization_ids == (1, 2, 3, 4)
    assert "расширена" in group.limitation.lower()


@pytest.mark.parametrize("anomaly_type", list(ANOMALY_LABELS))
def test_each_anomaly_type_is_detected(db_session: Session, anomaly_type: str) -> None:
    metric = db_session.scalar(
        select(AnalysisMetric)
        .where(AnalysisMetric.anomaly_type == anomaly_type)
        .order_by(AnalysisMetric.analysis_run_id.desc())
    )
    assert metric is not None
    assert metric.true_positive_count > 0
    assert metric.recall >= 0.65


def test_isolation_forest_is_reproducible(db_session: Session) -> None:
    first = run_analysis(db_session, 20260712)
    first_scores = dict(
        db_session.execute(
            select(OrganizationAnomalyScore.organization_id, OrganizationAnomalyScore.score).where(
                OrganizationAnomalyScore.analysis_run_id == first.analysis_run_id
            )
        ).all()
    )
    second = run_analysis(db_session, 20260712)
    second_scores = dict(
        db_session.execute(
            select(OrganizationAnomalyScore.organization_id, OrganizationAnomalyScore.score).where(
                OrganizationAnomalyScore.analysis_run_id == second.analysis_run_id
            )
        ).all()
    )
    assert first_scores == second_scores
