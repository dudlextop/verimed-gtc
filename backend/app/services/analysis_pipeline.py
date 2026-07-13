from __future__ import annotations

import bisect
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    AnalysisMetric,
    AnalysisRun,
    ExpertDecisionEvent,
    ExpertReview,
    MedicalOrganization,
    MedicalRecord,
    PatternSignal,
    ReviewPriority,
    ReviewStatus,
    RiskFactor,
    RiskLevel,
    RiskSignal,
    SignalFingerprintHistory,
    utc_now,
)
from app.services.detection import RuleDetection, load_records, run_deterministic_rules
from app.services.expert_decisions import restore_signal_status
from app.services.financial_priority import store_financial_priorities_and_comparisons
from app.services.fingerprints import signal_fingerprint, signal_fingerprint_payload
from app.services.organization_model import (
    OrganizationModelResult,
    calculate_organization_features,
    train_organization_models,
)
from app.services.recurring_patterns import build_patterns
from app.services.risk import calculate_risk
from app.synthetic.catalog import ANOMALY_LABELS


@dataclass(frozen=True)
class MetricValues:
    precision: float
    recall: float
    f1: float
    false_positive_rate: float
    true_positive_count: int
    false_positive_count: int
    false_negative_count: int
    selected_for_review_rate: float
    manual_review_reduction: float


@dataclass(frozen=True)
class AnalysisExecution:
    analysis_run_id: int
    status: str
    random_seed: int
    records_processed: int
    anomalies_injected: int
    signals_created: int
    metrics: MetricValues


def _model_detections(
    records: list[MedicalRecord],
    model_results: dict[int, OrganizationModelResult],
) -> list[RuleDetection]:
    detections: list[RuleDetection] = []
    for record in records:
        result = model_results[record.organization_id]
        if result.score < 55 or not result.top_category:
            continue
        if record.service.category != result.top_category:
            continue
        detections.append(
            RuleDetection(
                record_id=record.id,
                anomaly_type="peer_group_anomaly",
                severity=result.score,
                related_record_ids=(record.id,),
                actual_value=(
                    f"оценка поведения организации {result.score:.1f}".replace(".", ",") + " из 100"
                ),
                typical_value=(
                    f"сопоставимая группа из {len(result.peer_group.organization_ids)} организаций"
                ),
                explanation=(
                    "Структура услуг организации отличается от медианных значений "
                    f"сопоставимой группы. {result.explanation}"
                ),
                limitation=result.peer_group.limitation,
            )
        )
    return detections


def calculate_metric_values(
    total_records: int, truth: set[int], predicted: set[int]
) -> MetricValues:
    true_positive = len(truth & predicted)
    false_positive = len(predicted - truth)
    false_negative = len(truth - predicted)
    true_negative = total_records - true_positive - false_positive - false_negative
    precision = true_positive / max(1, true_positive + false_positive)
    recall = true_positive / max(1, true_positive + false_negative)
    f1 = 2 * precision * recall / max(precision + recall, 1e-12)
    false_positive_rate = false_positive / max(1, false_positive + true_negative)
    selected_rate = len(predicted) / max(1, total_records)
    return MetricValues(
        precision=round(precision, 4),
        recall=round(recall, 4),
        f1=round(f1, 4),
        false_positive_rate=round(false_positive_rate, 4),
        true_positive_count=true_positive,
        false_positive_count=false_positive,
        false_negative_count=false_negative,
        selected_for_review_rate=round(selected_rate, 4),
        manual_review_reduction=round(1 - selected_rate, 4),
    )


def _store_metric(
    db: Session,
    run_id: int,
    anomaly_type: str | None,
    values: MetricValues,
) -> None:
    db.add(
        AnalysisMetric(
            analysis_run_id=run_id,
            anomaly_type=anomaly_type,
            **values.__dict__,
        )
    )


def run_analysis(db: Session, random_seed: int) -> AnalysisExecution:
    completed_reviews = (
        db.scalar(
            select(func.count(ExpertDecisionEvent.id)).where(
                ExpertDecisionEvent.decision_status == ReviewStatus.COMPLETED.value
            )
        )
        or 0
    )
    db.execute(delete(PatternSignal))
    db.execute(delete(ReviewPriority))
    db.execute(delete(RiskFactor))
    db.execute(delete(ExpertReview))
    db.execute(delete(RiskSignal))
    db.flush()
    records = load_records(db)
    organizations = list(
        db.scalars(
            select(MedicalOrganization).options(selectinload(MedicalOrganization.doctors))
        ).all()
    )
    run = AnalysisRun(
        started_at=utc_now(),
        completed_at=utc_now(),
        period_start=min((record.service_date for record in records), default=date(2026, 1, 1)),
        period_end=max((record.service_date for record in records), default=date(2026, 6, 30)),
        records_processed=len(records),
        status="Выполняется анализ",
        model_version="rules-iforest-v1",
        random_seed=random_seed,
        anomalies_injected=sum(record.is_ground_truth_anomaly for record in records),
        signals_created=0,
    )
    db.add(run)
    db.flush()

    rule_detections = run_deterministic_rules(records)
    features = calculate_organization_features(organizations, records, rule_detections)
    model_results = train_organization_models(
        db, run, organizations, features, random_seed=random_seed
    )
    all_detections = rule_detections + _model_detections(records, model_results)
    detections_by_record: dict[int, list[RuleDetection]] = defaultdict(list)
    for detection in all_detections:
        detections_by_record[detection.record_id].append(detection)

    sorted_amounts = sorted(float(record.amount) for record in records)
    records_by_id = {record.id: record for record in records}
    signal_scores_by_org: dict[int, list[int]] = defaultdict(list)
    high_risk_record_ids: list[int] = []
    high_risk_amount = Decimal("0")
    for record_id, detections in detections_by_record.items():
        record = records_by_id[record_id]
        financial_score = (
            100 * bisect.bisect_right(sorted_amounts, float(record.amount)) / len(sorted_amounts)
        )
        result = calculate_risk(detections, model_results[record.organization_id], financial_score)
        primary = max(detections, key=lambda item: item.severity)
        related_ids = sorted(
            {related_id for detection in detections for related_id in detection.related_record_ids}
        )
        signal = RiskSignal(
            medical_record_id=record_id,
            organization_id=record.organization_id,
            analysis_run_id=run.id,
            score=result.score,
            level=result.level,
            primary_reason=ANOMALY_LABELS[primary.anomaly_type],
            anomaly_type=primary.anomaly_type,
            related_record_ids=related_ids,
            severity=max(item.severity for item in detections),
            rule_score=result.rule_score,
            organization_score=result.organization_score,
            financial_score=result.financial_score,
            limitations=list(result.limitations),
            recommendation=result.recommendation,
            created_at=utc_now(),
        )
        signal.factors = [
            RiskFactor(
                name=factor.name,
                contribution=factor.contribution,
                actual_value=factor.actual_value,
                typical_value=factor.typical_value,
                explanation=factor.explanation,
            )
            for factor in result.factors
        ]
        db.add(signal)
        signal.fingerprint = signal_fingerprint(signal, record)
        restore_signal_status(db, signal)
        signal_scores_by_org[record.organization_id].append(result.score)
        if result.level in {RiskLevel.HIGH, RiskLevel.CRITICAL}:
            high_risk_record_ids.append(record_id)
            high_risk_amount += record.amount
    db.flush()

    for organization in organizations:
        scores = sorted(signal_scores_by_org[organization.id], reverse=True)
        organization.risk_score = (
            round(sum(scores[:20]) / len(scores[:20]))
            if scores
            else round(model_results[organization.id].score)
        )

    store_financial_priorities_and_comparisons(db, run, organizations, records, features)
    current_signals = list(
        db.scalars(
            select(RiskSignal)
            .where(RiskSignal.analysis_run_id == run.id)
            .options(selectinload(RiskSignal.record), selectinload(RiskSignal.review_priority))
        ).all()
    )
    representative_by_fingerprint: dict[str, RiskSignal] = {}
    for signal in current_signals:
        if signal.fingerprint is None:
            continue
        previous = representative_by_fingerprint.get(signal.fingerprint)
        if previous is None or signal.score > previous.score:
            representative_by_fingerprint[signal.fingerprint] = signal
    for signal in representative_by_fingerprint.values():
        db.add(
            SignalFingerprintHistory(
                entity_fingerprint=signal.fingerprint,
                analysis_run_id=run.id,
                current_signal_id=signal.id,
                medical_record_id=signal.medical_record_id,
                medical_organization_id=signal.organization_id,
                anomaly_type=signal.anomaly_type,
                risk_score=signal.score,
                priority_score=(signal.review_priority.score if signal.review_priority else None),
                financial_significance=(
                    signal.review_priority.financial_significance
                    if signal.review_priority
                    else None
                ),
                status_at_run=signal.status.value,
                context_signature=signal_fingerprint_payload(signal, signal.record),
                appeared_at=utc_now(),
            )
        )
    build_patterns(db, run)

    truth_ids = {record.id for record in records if record.is_ground_truth_anomaly}
    predicted_ids = set(detections_by_record)
    overall_metrics = calculate_metric_values(len(records), truth_ids, predicted_ids)
    _store_metric(db, run.id, None, overall_metrics)
    for anomaly_type in ANOMALY_LABELS:
        truth_for_type = {
            record.id for record in records if record.ground_truth_anomaly_type == anomaly_type
        }
        predicted_for_type = {
            detection.record_id
            for detection in all_detections
            if detection.anomaly_type == anomaly_type
        }
        _store_metric(
            db,
            run.id,
            anomaly_type,
            calculate_metric_values(len(records), truth_for_type, predicted_for_type),
        )

    run.completed_at = utc_now()
    run.signals_created = len(predicted_ids)
    run.signal_record_ids = sorted(predicted_ids)
    run.high_risk_record_ids = sorted(high_risk_record_ids)
    run.organization_risk_scores = {
        str(organization.id): organization.risk_score for organization in organizations
    }
    run.review_amount = high_risk_amount
    run.selected_for_review_rate = overall_metrics.selected_for_review_rate
    run.completed_reviews_count = completed_reviews
    run.status = "Обработка завершена"
    db.commit()
    return AnalysisExecution(
        analysis_run_id=run.id,
        status=run.status,
        random_seed=random_seed,
        records_processed=len(records),
        anomalies_injected=len(truth_ids),
        signals_created=len(predicted_ids),
        metrics=overall_metrics,
    )


def latest_metrics(db: Session) -> AnalysisMetric | None:
    return db.scalar(
        select(AnalysisMetric)
        .where(AnalysisMetric.anomaly_type.is_(None))
        .order_by(AnalysisMetric.analysis_run_id.desc())
    )


def latest_metrics_by_type(db: Session) -> list[AnalysisMetric]:
    latest_run_id = db.scalar(select(AnalysisRun.id).order_by(AnalysisRun.id.desc()))
    if latest_run_id is None:
        return []
    return list(
        db.scalars(
            select(AnalysisMetric)
            .where(
                AnalysisMetric.analysis_run_id == latest_run_id,
                AnalysisMetric.anomaly_type.is_not(None),
            )
            .order_by(AnalysisMetric.anomaly_type)
        ).all()
    )
