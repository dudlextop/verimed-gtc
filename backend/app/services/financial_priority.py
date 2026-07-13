from __future__ import annotations

import bisect
import math
import statistics
from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    AnalysisRun,
    ExpertDecisionEvent,
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
from app.schemas import (
    FinancialImpactItem,
    FinancialImpactSummary,
    OrganizationComparison,
    OrganizationComparisonItem,
    PriorityHistoryPoint,
    PriorityOrganization,
    PrioritySignalSummary,
    PrioritySummary,
)
from app.services.organization_model import form_peer_group

FINANCIAL_DISCLAIMER = (
    "Финансовая значимость отражает объём медицинских услуг, связанных с выявленными "
    "сигналами риска. Окончательную оценку выполняет уполномоченный специалист."
)

COMPARISON_LABELS = {
    "services_per_patient": "Количество услуг на одного пациента",
    "average_cost_per_patient": "Средняя стоимость на пациента",
    "median_cost": "Медианная стоимость услуги",
    "repeat_share": "Доля повторных услуг",
    "high_cost_share": "Доля дорогостоящих услуг",
    "signals_per_1000": "Сигналы на 1 000 услуг",
    "month_end_share": "Доля услуг в последние пять дней месяца",
    "services_per_doctor": "Нагрузка на одного врача",
    "signal_services_amount": "Сумма услуг, связанных с сигналами",
    "high_critical_share": "Доля услуг высокого и критического риска",
}


def _amount_text(value: Decimal) -> str:
    return f"{value:,.0f}".replace(",", " ")


def _decimal_text(value: float) -> str:
    return f"{value:.1f}".replace(".", ",")


@dataclass(frozen=True)
class PriorityFactorValue:
    name: str
    weight: int
    normalized_value: float
    contribution: int
    actual_value: str
    typical_value: str
    explanation: str


@dataclass(frozen=True)
class PriorityResult:
    score: int
    level: RiskLevel
    factors: tuple[PriorityFactorValue, ...]


@dataclass(frozen=True)
class SignalFinancialContext:
    record_ids: tuple[int, ...]
    amount: Decimal
    repetition_count: int
    affected_patients: int
    duration_days: int


def priority_level_for_score(score: int) -> RiskLevel:
    if score >= 80:
        return RiskLevel.CRITICAL
    if score >= 60:
        return RiskLevel.HIGH
    if score >= 30:
        return RiskLevel.MEDIUM
    return RiskLevel.LOW


def _allocate_contributions(values: list[float], weights: list[int]) -> list[int]:
    raw = [
        max(0.0, min(100.0, value)) * weight / 100
        for value, weight in zip(values, weights, strict=True)
    ]
    target = round(sum(raw))
    result = [math.floor(value) for value in raw]
    order = sorted(range(len(raw)), key=lambda index: raw[index] - result[index], reverse=True)
    for index in order[: target - sum(result)]:
        result[index] += 1
    return result


def calculate_review_priority(
    risk_score: int,
    financial_percentile: float,
    repetition_count: int,
    affected_patients: int,
    status: ReviewStatus,
    has_confirmed_history: bool,
    financial_amount: Decimal,
    duration_days: int,
) -> PriorityResult:
    repeat_value = min(100.0, repetition_count / 5 * 100)
    patient_value = min(100.0, affected_patients / 5 * 100)
    history_value = (
        100.0 if status == ReviewStatus.UNREVIEWED else 70.0 if has_confirmed_history else 25.0
    )
    values = [float(risk_score), financial_percentile, repeat_value, patient_value, history_value]
    weights = [40, 25, 15, 10, 10]
    contributions = _allocate_contributions(values, weights)
    definitions = [
        (
            "Оценка риска",
            f"{risk_score} из 100",
            "шкала оценки риска",
            "Высокая оценка риска повышает приоритет экспертной проверки.",
        ),
        (
            "Финансовая значимость",
            f"{_amount_text(financial_amount)} тенге",
            f"{financial_percentile:.1f}-й процентиль".replace(".", ","),
            "Учитывается уникальная сумма текущей и связанных медицинских записей.",
        ),
        (
            "Повторяемость",
            f"{repetition_count} связанных записей за {duration_days} дней",
            "пять повторений соответствуют верхней границе фактора",
            "Большее число связанных записей и длительный период повышают приоритет.",
        ),
        (
            "Затронутые пациенты",
            f"{affected_patients} обезличенных пациентов",
            "пять пациентов соответствуют верхней границе фактора",
            "Используется число уникальных обезличенных пациентов в связанных записях.",
        ),
        (
            "История решений",
            status.value,
            "наличие решения и предыдущих подтверждений",
            "Отсутствие текущего экспертного решения повышает рабочий приоритет.",
        ),
    ]
    factors = tuple(
        PriorityFactorValue(
            name=name,
            weight=weight,
            normalized_value=round(value, 2),
            contribution=contribution,
            actual_value=actual,
            typical_value=typical,
            explanation=explanation,
        )
        for (name, actual, typical, explanation), weight, value, contribution in zip(
            definitions, weights, values, contributions, strict=True
        )
    )
    score = sum(contributions)
    return PriorityResult(score=score, level=priority_level_for_score(score), factors=factors)


def _factor_dicts(factors: tuple[PriorityFactorValue, ...]) -> list[dict[str, str | int | float]]:
    return [
        {
            "name": factor.name,
            "weight": factor.weight,
            "normalized_value": factor.normalized_value,
            "contribution": factor.contribution,
            "actual_value": factor.actual_value,
            "typical_value": factor.typical_value,
            "explanation": factor.explanation,
        }
        for factor in factors
    ]


def _context_for_signal(
    signal: RiskSignal, records_by_id: dict[int, MedicalRecord]
) -> SignalFinancialContext:
    record_ids = sorted(
        record_id
        for record_id in {signal.medical_record_id, *signal.related_record_ids}
        if record_id in records_by_id
    )
    records = [records_by_id[record_id] for record_id in record_ids]
    dates = [record.service_date for record in records]
    return SignalFinancialContext(
        record_ids=tuple(record_ids),
        amount=sum((record.amount for record in records), Decimal("0")),
        repetition_count=len(records),
        affected_patients=len({record.patient_id for record in records}),
        duration_days=(max(dates) - min(dates)).days + 1 if dates else 0,
    )


def _sum_unique(record_ids: set[int], records_by_id: dict[int, MedicalRecord]) -> Decimal:
    return sum((records_by_id[record_id].amount for record_id in record_ids), Decimal("0"))


def _store_financial_snapshot(
    db: Session,
    run_id: int,
    scope_type: str,
    scope_key: str,
    signals: list[RiskSignal],
    contexts: dict[int, SignalFinancialContext],
    records_by_id: dict[int, MedicalRecord],
    total_record_ids: set[int],
) -> FinancialImpactSnapshot:
    all_ids = {record_id for signal in signals for record_id in contexts[signal.id].record_ids}
    high_ids = {
        record_id
        for signal in signals
        if signal.level in {RiskLevel.HIGH, RiskLevel.CRITICAL}
        for record_id in contexts[signal.id].record_ids
    }
    status_ids: dict[ReviewStatus, set[int]] = defaultdict(set)
    for signal in signals:
        status_ids[signal.status].update(contexts[signal.id].record_ids)
    snapshot = FinancialImpactSnapshot(
        analysis_run_id=run_id,
        scope_type=scope_type,
        scope_key=scope_key,
        total_services_amount=_sum_unique(total_record_ids, records_by_id),
        signal_services_amount=_sum_unique(all_ids, records_by_id),
        high_critical_amount=_sum_unique(high_ids, records_by_id),
        confirmed_amount=_sum_unique(status_ids[ReviewStatus.CONFIRMED], records_by_id),
        rejected_amount=_sum_unique(status_ids[ReviewStatus.REJECTED], records_by_id),
        unreviewed_amount=_sum_unique(status_ids[ReviewStatus.UNREVIEWED], records_by_id),
        affected_records=len(all_ids),
        affected_patients=len({records_by_id[item].patient_id for item in all_ids}),
        unique_record_ids=sorted(all_ids),
    )
    db.add(snapshot)
    return snapshot


def _typical_range(values: list[float]) -> tuple[float, float]:
    if not values:
        return 0.0, 0.0
    if len(values) < 4:
        return min(values), max(values)
    quartiles = statistics.quantiles(values, n=4, method="inclusive")
    return quartiles[0], quartiles[2]


def store_financial_priorities_and_comparisons(
    db: Session,
    run: AnalysisRun,
    organizations: list[MedicalOrganization],
    records: list[MedicalRecord],
    features: dict[int, dict[str, float]],
) -> None:
    db.flush()
    signals = list(
        db.scalars(
            select(RiskSignal).options(selectinload(RiskSignal.reviews)).order_by(RiskSignal.id)
        ).all()
    )
    records_by_id = {record.id: record for record in records}
    contexts = {signal.id: _context_for_signal(signal, records_by_id) for signal in signals}
    amounts = sorted(float(context.amount) for context in contexts.values())
    for signal in signals:
        context = contexts[signal.id]
        percentile = (
            100 * bisect.bisect_right(amounts, float(context.amount)) / max(1, len(amounts))
        )
        confirmed_history = signal.status == ReviewStatus.CONFIRMED or bool(
            signal.fingerprint
            and db.scalar(
                select(ExpertDecisionEvent.id).where(
                    ExpertDecisionEvent.entity_fingerprint == signal.fingerprint,
                    ExpertDecisionEvent.decision_status == ReviewStatus.CONFIRMED.value,
                )
            )
        )
        priority = calculate_review_priority(
            signal.score,
            percentile,
            context.repetition_count,
            context.affected_patients,
            signal.status,
            confirmed_history,
            context.amount,
            context.duration_days,
        )
        db.add(
            ReviewPriority(
                analysis_run_id=run.id,
                signal_id=signal.id,
                score=priority.score,
                level=priority.level,
                financial_significance=context.amount,
                linked_record_ids=list(context.record_ids),
                repetition_count=context.repetition_count,
                affected_patients=context.affected_patients,
                duration_days=context.duration_days,
                factors=_factor_dicts(priority.factors),
                explanation=(
                    f"{priority.level.value} приоритет сформирован из-за оценки риска "
                    f"{signal.score} из 100, финансовой значимости "
                    f"{_amount_text(context.amount)} тенге, "
                    f"{context.repetition_count} связанных записей "
                    "и текущего статуса экспертной проверки."
                ),
            )
        )
    db.flush()

    signals_by_org: dict[int, list[RiskSignal]] = defaultdict(list)
    signals_by_region: dict[str, list[RiskSignal]] = defaultdict(list)
    signals_by_type: dict[str, list[RiskSignal]] = defaultdict(list)
    organizations_by_id = {organization.id: organization for organization in organizations}
    for signal in signals:
        signals_by_org[signal.organization_id].append(signal)
        signals_by_region[organizations_by_id[signal.organization_id].region].append(signal)
        signals_by_type[signal.anomaly_type].append(signal)
    all_record_ids = set(records_by_id)
    _store_financial_snapshot(
        db, run.id, "period", "all", signals, contexts, records_by_id, all_record_ids
    )
    org_impacts: dict[int, FinancialImpactSnapshot] = {}
    for organization in organizations:
        org_record_ids = {
            record.id for record in records if record.organization_id == organization.id
        }
        org_impacts[organization.id] = _store_financial_snapshot(
            db,
            run.id,
            "organization",
            str(organization.id),
            signals_by_org[organization.id],
            contexts,
            records_by_id,
            org_record_ids,
        )
    for region, region_signals in signals_by_region.items():
        region_ids = {
            record.id
            for record in records
            if organizations_by_id[record.organization_id].region == region
        }
        _store_financial_snapshot(
            db, run.id, "region", region, region_signals, contexts, records_by_id, region_ids
        )
    for anomaly_type, type_signals in signals_by_type.items():
        _store_financial_snapshot(
            db,
            run.id,
            "anomaly_type",
            anomaly_type,
            type_signals,
            contexts,
            records_by_id,
            all_record_ids,
        )

    max_org_amount = max(
        (float(item.signal_services_amount) for item in org_impacts.values()), default=1.0
    )
    max_patients = max((item.affected_patients for item in org_impacts.values()), default=1)
    for organization in organizations:
        org_signals = signals_by_org[organization.id]
        impact = org_impacts[organization.id]
        risk_value = float(organization.risk_score)
        finance_value = 100 * float(impact.signal_services_amount) / max(1.0, max_org_amount)
        repeat_value = min(100.0, len(org_signals) / 50 * 100)
        patient_value = 100 * impact.affected_patients / max(1, max_patients)
        unreviewed_share = sum(
            signal.status == ReviewStatus.UNREVIEWED for signal in org_signals
        ) / max(1, len(org_signals))
        confirmed_share = sum(
            signal.status == ReviewStatus.CONFIRMED for signal in org_signals
        ) / max(1, len(org_signals))
        history_value = min(100.0, unreviewed_share * 80 + confirmed_share * 20)
        values = [risk_value, finance_value, repeat_value, patient_value, history_value]
        weights = [40, 25, 15, 10, 10]
        contributions = _allocate_contributions(values, weights)
        duration = 0
        dates = [records_by_id[signal.medical_record_id].service_date for signal in org_signals]
        if dates:
            duration = (max(dates) - min(dates)).days + 1
        factor_defs = [
            ("Оценка риска", f"{organization.risk_score} из 100", "шкала риска"),
            (
                "Финансовая значимость",
                f"{_amount_text(impact.signal_services_amount)} тенге",
                "максимум среди организаций",
            ),
            (
                "Повторяемость",
                f"{len(org_signals)} сигналов за {duration} дней",
                "50 сигналов — верхняя граница фактора",
            ),
            (
                "Затронутые пациенты",
                str(impact.affected_patients),
                f"максимум в выборке: {max_patients}",
            ),
            (
                "История решений",
                f"{_decimal_text(unreviewed_share * 100)}% без решения",
                "доля сигналов без решения и подтверждённая история",
            ),
        ]
        factors = [
            {
                "name": name,
                "weight": weight,
                "normalized_value": round(value, 2),
                "contribution": contribution,
                "actual_value": actual,
                "typical_value": typical,
                "explanation": (
                    "Фактор рассчитан по текущему запуску и сохранён для воспроизводимости."
                ),
            }
            for (name, actual, typical), weight, value, contribution in zip(
                factor_defs, weights, values, contributions, strict=True
            )
        ]
        score = sum(contributions)
        db.add(
            OrganizationPrioritySnapshot(
                analysis_run_id=run.id,
                organization_id=organization.id,
                score=score,
                level=priority_level_for_score(score),
                financial_significance=impact.signal_services_amount,
                high_critical_signals=sum(
                    signal.level in {RiskLevel.HIGH, RiskLevel.CRITICAL} for signal in org_signals
                ),
                affected_patients=impact.affected_patients,
                duration_days=duration,
                unreviewed_share=unreviewed_share,
                factors=factors,
                explanation=(
                    f"Приоритет {score} из 100: риск {organization.risk_score}, "
                    f"{len(org_signals)} сигналов на сумму "
                    f"{_amount_text(impact.signal_services_amount)} тенге."
                ),
            )
        )

    comparison_values: dict[int, dict[str, float]] = {}
    for organization in organizations:
        org_records = [record for record in records if record.organization_id == organization.id]
        patient_count = len({record.patient_id for record in org_records})
        impact = org_impacts[organization.id]
        comparison_values[organization.id] = {
            "services_per_patient": features[organization.id].get("services_per_patient", 0.0),
            "average_cost_per_patient": float(
                sum((record.amount for record in org_records), Decimal("0"))
            )
            / max(1, patient_count),
            "median_cost": features[organization.id].get("median_cost", 0.0),
            "repeat_share": features[organization.id].get("repeat_share", 0.0),
            "high_cost_share": features[organization.id].get("high_cost_share", 0.0),
            "signals_per_1000": len(signals_by_org[organization.id])
            / max(1, len(org_records))
            * 1000,
            "month_end_share": features[organization.id].get("month_end_share", 0.0),
            "services_per_doctor": features[organization.id].get("services_per_doctor", 0.0),
            "signal_services_amount": float(impact.signal_services_amount),
            "high_critical_share": sum(
                signal.level in {RiskLevel.HIGH, RiskLevel.CRITICAL}
                for signal in signals_by_org[organization.id]
            )
            / max(1, len(org_records)),
        }
    for organization in organizations:
        peer_group = form_peer_group(organization, organizations)
        peer_ids = list(peer_group.organization_ids)
        reliability = (
            "Высокая"
            if len(peer_ids) >= 5 and not peer_group.limitation
            else "Средняя"
            if len(peer_ids) >= 4
            else "Низкая"
        )
        for metric_key, label in COMPARISON_LABELS.items():
            values = [comparison_values[item_id][metric_key] for item_id in peer_ids]
            value = comparison_values[organization.id][metric_key]
            median = statistics.median(values) if values else 0.0
            low, high = _typical_range(values)
            deviation = (value - median) / max(abs(median), 0.0001) * 100
            position = sorted(values, reverse=True).index(value) + 1
            direction = "выше" if deviation > 0 else "ниже" if deviation < 0 else "на уровне"
            db.add(
                OrganizationComparisonSnapshot(
                    analysis_run_id=run.id,
                    organization_id=organization.id,
                    metric_key=metric_key,
                    metric_label=label,
                    value=value,
                    peer_median=median,
                    typical_low=low,
                    typical_high=high,
                    deviation_percent=round(deviation, 2),
                    position=position,
                    peer_group_size=len(peer_ids),
                    reliability=reliability,
                    limitation=peer_group.limitation,
                    explanation=(
                        f"Показатель {direction} медианы сопоставимой группы "
                        f"на {_decimal_text(abs(deviation))}%."
                    ),
                )
            )
    db.flush()


def refresh_signal_priority(db: Session, signal: RiskSignal) -> None:
    priority = signal.review_priority
    if priority is None:
        return
    all_amounts = sorted(
        float(value) for value in db.scalars(select(ReviewPriority.financial_significance)).all()
    )
    percentile = (
        100
        * bisect.bisect_right(all_amounts, float(priority.financial_significance))
        / max(1, len(all_amounts))
    )
    confirmed_history = signal.status == ReviewStatus.CONFIRMED or bool(
        signal.fingerprint
        and db.scalar(
            select(ExpertDecisionEvent.id).where(
                ExpertDecisionEvent.entity_fingerprint == signal.fingerprint,
                ExpertDecisionEvent.decision_status == ReviewStatus.CONFIRMED.value,
            )
        )
    )
    result = calculate_review_priority(
        signal.score,
        percentile,
        priority.repetition_count,
        priority.affected_patients,
        signal.status,
        confirmed_history,
        priority.financial_significance,
        priority.duration_days,
    )
    priority.score = result.score
    priority.level = result.level
    priority.factors = _factor_dicts(result.factors)


def _financial_item(snapshot: FinancialImpactSnapshot) -> FinancialImpactItem:
    share = (
        float(snapshot.signal_services_amount / snapshot.total_services_amount)
        if snapshot.total_services_amount
        else 0.0
    )
    return FinancialImpactItem(
        scope_type=snapshot.scope_type,
        scope_key=snapshot.scope_key,
        total_services_amount=snapshot.total_services_amount,
        signal_services_amount=snapshot.signal_services_amount,
        high_critical_amount=snapshot.high_critical_amount,
        confirmed_amount=snapshot.confirmed_amount,
        rejected_amount=snapshot.rejected_amount,
        unreviewed_amount=snapshot.unreviewed_amount,
        affected_records=snapshot.affected_records,
        affected_patients=snapshot.affected_patients,
        signal_amount_share=round(share, 4),
        disclaimer=FINANCIAL_DISCLAIMER,
    )


def get_financial_impact_summary(db: Session) -> FinancialImpactSummary:
    run_id = db.scalar(select(AnalysisRun.id).order_by(AnalysisRun.id.desc()))
    if run_id is None:
        return FinancialImpactSummary(
            analysis_run_id=None, period=None, by_region=[], by_anomaly_type=[]
        )
    snapshots = list(
        db.scalars(
            select(FinancialImpactSnapshot).where(FinancialImpactSnapshot.analysis_run_id == run_id)
        ).all()
    )
    period = next(
        (item for item in snapshots if item.scope_type == "period" and item.scope_key == "all"),
        None,
    )
    return FinancialImpactSummary(
        analysis_run_id=run_id,
        period=_financial_item(period) if period else None,
        by_region=[_financial_item(item) for item in snapshots if item.scope_type == "region"],
        by_anomaly_type=[
            _financial_item(item) for item in snapshots if item.scope_type == "anomaly_type"
        ],
    )


def get_organization_financial_impact(
    db: Session, organization_id: int
) -> FinancialImpactItem | None:
    snapshot = db.scalar(
        select(FinancialImpactSnapshot)
        .where(
            FinancialImpactSnapshot.scope_type == "organization",
            FinancialImpactSnapshot.scope_key == str(organization_id),
        )
        .order_by(FinancialImpactSnapshot.analysis_run_id.desc())
    )
    return _financial_item(snapshot) if snapshot else None


def _priority_organization(
    db: Session, snapshot: OrganizationPrioritySnapshot
) -> PriorityOrganization:
    organization = db.get(MedicalOrganization, snapshot.organization_id)
    factors = snapshot.factors
    strongest = (
        max(factors, key=lambda item: float(item.get("contribution", 0))) if factors else None
    )
    main_reason = str(strongest["name"]) if strongest else "Совокупность факторов"
    return PriorityOrganization(
        id=snapshot.organization_id,
        name=organization.name if organization else "Медицинская организация",
        high_risk_signals=snapshot.high_critical_signals,
        review_amount=snapshot.financial_significance,
        risk_score=organization.risk_score if organization else 0,
        priority_score=snapshot.score,
        priority_level=snapshot.level,
        main_reason=main_reason,
        summary=snapshot.explanation,
    )


def _priority_signal(signal: RiskSignal) -> PrioritySignalSummary | None:
    priority = signal.review_priority
    if priority is None:
        return None
    return PrioritySignalSummary(
        id=signal.id,
        organization_name=signal.organization.name,
        service_name=signal.record.service.name,
        priority_score=priority.score,
        priority_level=priority.level,
        financial_significance=priority.financial_significance,
    )


def get_priority_summary(db: Session) -> PrioritySummary:
    run_id = db.scalar(select(AnalysisRun.id).order_by(AnalysisRun.id.desc()))
    if run_id is None:
        return PrioritySummary(
            analysis_run_id=None,
            top_organization=None,
            top_signal=None,
            critical_priority_signals=0,
            high_priority_signals=0,
        )
    organization_snapshot = db.scalar(
        select(OrganizationPrioritySnapshot)
        .where(OrganizationPrioritySnapshot.analysis_run_id == run_id)
        .order_by(OrganizationPrioritySnapshot.score.desc())
    )
    top_signal = db.scalar(
        select(RiskSignal)
        .join(ReviewPriority)
        .options(
            selectinload(RiskSignal.organization),
            selectinload(RiskSignal.record).selectinload(MedicalRecord.service),
            selectinload(RiskSignal.review_priority),
        )
        .order_by(ReviewPriority.financial_significance.desc(), ReviewPriority.score.desc())
    )
    priorities = list(
        db.scalars(select(ReviewPriority).where(ReviewPriority.analysis_run_id == run_id)).all()
    )
    return PrioritySummary(
        analysis_run_id=run_id,
        top_organization=(
            _priority_organization(db, organization_snapshot) if organization_snapshot else None
        ),
        top_signal=_priority_signal(top_signal) if top_signal else None,
        critical_priority_signals=sum(item.level == RiskLevel.CRITICAL for item in priorities),
        high_priority_signals=sum(item.level == RiskLevel.HIGH for item in priorities),
    )


def get_organization_comparison(db: Session, organization_id: int) -> OrganizationComparison:
    run_id = db.scalar(select(AnalysisRun.id).order_by(AnalysisRun.id.desc()))
    if run_id is None:
        return OrganizationComparison(
            organization_id=organization_id,
            analysis_run_id=None,
            items=[],
            peer_group_size=0,
            reliability="Недоступна",
            limitation="Сравнение недоступно: анализ ещё не выполнялся.",
        )
    rows = list(
        db.scalars(
            select(OrganizationComparisonSnapshot)
            .where(
                OrganizationComparisonSnapshot.analysis_run_id == run_id,
                OrganizationComparisonSnapshot.organization_id == organization_id,
            )
            .order_by(OrganizationComparisonSnapshot.metric_key)
        ).all()
    )
    first = rows[0] if rows else None
    return OrganizationComparison(
        organization_id=organization_id,
        analysis_run_id=run_id,
        items=[OrganizationComparisonItem.model_validate(item) for item in rows],
        peer_group_size=first.peer_group_size if first else 0,
        reliability=first.reliability if first else "Недоступна",
        limitation=(
            first.limitation
            if first and first.limitation
            else ""
            if first
            else "Сравнение недоступно: недостаточно сопоставимых организаций."
        ),
    )


def get_organization_priority_history(
    db: Session, organization_id: int
) -> list[PriorityHistoryPoint]:
    rows = db.execute(
        select(OrganizationPrioritySnapshot, AnalysisRun)
        .join(AnalysisRun, AnalysisRun.id == OrganizationPrioritySnapshot.analysis_run_id)
        .where(OrganizationPrioritySnapshot.organization_id == organization_id)
        .order_by(OrganizationPrioritySnapshot.analysis_run_id)
    ).all()
    return [
        PriorityHistoryPoint(
            analysis_run_id=snapshot.analysis_run_id,
            period=run.completed_at.strftime("%d.%m.%Y %H:%M"),
            value=snapshot.score,
            level=snapshot.level,
            financial_significance=snapshot.financial_significance,
        )
        for snapshot, run in rows
    ]
