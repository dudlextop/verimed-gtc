from __future__ import annotations

import hashlib
import json
import math
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session, selectinload

from app.models import (
    AnalysisRun,
    DecisionEntityType,
    Doctor,
    MedicalOrganization,
    MedicalRecord,
    MedicalService,
    Patient,
    PatternDoctor,
    PatternFactor,
    PatternFingerprintHistory,
    PatternOrganization,
    PatternPatient,
    PatternReviewStatus,
    PatternService,
    PatternSignal,
    PatternSnapshot,
    RecurringPattern,
    ReviewPriority,
    RiskLevel,
    RiskSignal,
    utc_now,
)
from app.schemas import (
    PaginatedPatterns,
    PatternBuildResponse,
    PatternChanges,
    PatternDetail,
    PatternFactorItem,
    PatternGraph,
    PatternGraphEdge,
    PatternGraphNode,
    PatternListItem,
    PatternParticipant,
    PatternReviewCreate,
    PatternReviewItem,
    PatternSummary,
    PatternTimelinePoint,
    SignalListItem,
)
from app.services.expert_decisions import (
    add_pattern_event,
    decision_history,
    legacy_pattern_payload,
    restore_pattern_status,
)
from app.services.financial_priority import priority_level_for_score
from app.services.signals import to_list_item

PATTERN_DISCLAIMER = (
    "Повторяющаяся модель отражает устойчивое сочетание сигналов и связей в доступных "
    "данных. Это аналитический контекст, который требует экспертной оценки."
)

PATTERN_TYPES = {
    "repeated_service": "Повторяющаяся услуга",
    "service_sequence": "Повторяющаяся последовательность услуг",
    "doctor_concentration": "Концентрация на враче",
    "service_concentration": "Концентрация на услуге",
    "recurring_spike": "Повторяющийся всплеск",
    "recurring_price_deviation": "Повторяющееся ценовое отклонение",
    "linked_patient_group": "Связанная группа пациентов",
    "cross_organization": "Межорганизационная модель",
}

PATTERN_THRESHOLDS: dict[str, dict[str, float]] = {
    "repeated_service": {"signals": 4, "periods": 2},
    "service_sequence": {"signals": 3, "patients": 2},
    "doctor_concentration": {"signals": 4, "share": 0.22},
    "service_concentration": {"signals": 4, "share": 0.18},
    "recurring_spike": {"signals": 3, "periods": 2},
    "recurring_price_deviation": {"signals": 3, "periods": 2},
    "linked_patient_group": {"signals": 3, "patients": 3},
    "cross_organization": {"signals": 4, "organizations": 2},
}

MAX_PATTERNS_PER_TYPE = 12


def _ru_count(value: int, one: str, few: str, many: str) -> str:
    tail = value % 100
    if 11 <= tail <= 14:
        word = many
    elif value % 10 == 1:
        word = one
    elif 2 <= value % 10 <= 4:
        word = few
    else:
        word = many
    return f"{value} {word}"


def _decimal_text(value: float) -> str:
    return f"{value:.1f}".replace(".", ",")


@dataclass(frozen=True)
class PatternCandidate:
    pattern_type: str
    key_parts: tuple[str, ...]
    signal_ids: tuple[int, ...]
    sequence_signature: tuple[int, ...] = ()


@dataclass(frozen=True)
class CandidateContext:
    signals: tuple[RiskSignal, ...]
    record_ids: tuple[int, ...]
    organization_ids: tuple[int, ...]
    doctor_ids: tuple[int, ...]
    patient_ids: tuple[int, ...]
    service_ids: tuple[int, ...]
    periods: tuple[str, ...]
    financial_significance: Decimal


def pattern_fingerprint(
    pattern_type: str,
    key_parts: tuple[str, ...],
    sequence_signature: tuple[int, ...] = (),
) -> str:
    payload = {
        "type": pattern_type,
        "key": list(key_parts),
        "sequence": list(sequence_signature),
        "version": 1,
    }
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def stability_level(score: int) -> str:
    if score >= 80:
        return "Очень высокая"
    if score >= 60:
        return "Высокая"
    if score >= 30:
        return "Средняя"
    return "Низкая"


def _allocate(values: list[float], weights: list[int]) -> list[int]:
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


def calculate_stability(
    period_count: int,
    signal_count: int,
    participant_stability: float,
    sequence_similarity: float,
    financial_percentile: float,
    recurrence_runs: int,
) -> tuple[int, list[dict[str, str | int | float]]]:
    values = [
        min(100.0, period_count / 4 * 100),
        min(100.0, signal_count / 20 * 100),
        min(100.0, signal_count / 12 * 100),
        participant_stability,
        sequence_similarity,
        financial_percentile,
        min(100.0, recurrence_runs / 3 * 100),
    ]
    weights = [25, 20, 15, 10, 10, 10, 10]
    contributions = _allocate(values, weights)
    definitions = [
        (
            "Количество периодов",
            _ru_count(period_count, "период", "периода", "периодов"),
            "четыре периода",
        ),
        (
            "Число повторений",
            _ru_count(signal_count, "повторение", "повторения", "повторений"),
            "20 повторений",
        ),
        (
            "Связанные сигналы",
            _ru_count(signal_count, "сигнал", "сигнала", "сигналов"),
            "12 сигналов",
        ),
        (
            "Стабильность участников",
            f"{_decimal_text(participant_stability)} из 100",
            "100 из 100",
        ),
        (
            "Сходство последовательностей",
            f"{_decimal_text(sequence_similarity)} из 100",
            "100 из 100",
        ),
        (
            "Финансовая значимость",
            f"{_decimal_text(financial_percentile)}-й процентиль",
            "100-й процентиль",
        ),
        ("Повторение между запусками", f"{recurrence_runs} запусков", "три запуска"),
    ]
    factors: list[dict[str, str | int | float]] = [
        {
            "factor_group": "Устойчивость",
            "name": name,
            "weight": weight,
            "normalized_value": round(value, 2),
            "contribution": contribution,
            "actual_value": actual,
            "typical_value": typical,
            "explanation": (
                "Фактор показывает, насколько регулярно модель сохраняется в доступных данных."
            ),
        }
        for (name, actual, typical), weight, value, contribution in zip(
            definitions, weights, values, contributions, strict=True
        )
    ]
    return sum(contributions), factors


def calculate_importance(
    average_risk: float,
    average_priority: float,
    financial_percentile: float,
    patient_count: int,
    period_count: int,
    organization_count: int,
    stability_score: int,
) -> tuple[int, list[dict[str, str | int | float]]]:
    values = [
        average_risk,
        average_priority,
        financial_percentile,
        min(100.0, patient_count / 20 * 100),
        min(100.0, period_count / 4 * 100),
        min(100.0, organization_count / 3 * 100),
        float(stability_score),
    ]
    weights = [25, 25, 20, 10, 8, 5, 7]
    contributions = _allocate(values, weights)
    definitions = [
        ("Средняя оценка риска", f"{_decimal_text(average_risk)} из 100", "шкала риска"),
        (
            "Средний приоритет проверки",
            f"{_decimal_text(average_priority)} из 100",
            "шкала приоритета",
        ),
        (
            "Финансовая значимость",
            f"{_decimal_text(financial_percentile)}-й процентиль",
            "100-й процентиль",
        ),
        (
            "Затронутые пациенты",
            _ru_count(patient_count, "пациент", "пациента", "пациентов"),
            "20 пациентов",
        ),
        (
            "Длительность",
            _ru_count(period_count, "период", "периода", "периодов"),
            "четыре периода",
        ),
        (
            "Охват организаций",
            _ru_count(organization_count, "организация", "организации", "организаций"),
            "три организации",
        ),
        ("Устойчивость модели", f"{stability_score} из 100", "шкала устойчивости"),
    ]
    factors: list[dict[str, str | int | float]] = [
        {
            "factor_group": "Важность",
            "name": name,
            "weight": weight,
            "normalized_value": round(value, 2),
            "contribution": contribution,
            "actual_value": actual,
            "typical_value": typical,
            "explanation": "Фактор определяет рабочую важность модели для экспертной проверки.",
        }
        for (name, actual, typical), weight, value, contribution in zip(
            definitions, weights, values, contributions, strict=True
        )
    ]
    return sum(contributions), factors


def _period(signal: RiskSignal) -> str:
    return signal.record.service_date.strftime("%Y-%m")


def _meets_period_or_strong_link(signals: list[RiskSignal], minimum_periods: int) -> bool:
    periods = {_period(signal) for signal in signals}
    return len(periods) >= minimum_periods or (
        len({signal.record.patient_id for signal in signals}) >= 3
        and len({signal.record.doctor_id for signal in signals}) >= 2
    )


def _candidate_groups(signals: list[RiskSignal]) -> list[PatternCandidate]:
    candidates: list[PatternCandidate] = []
    by_org: dict[int, list[RiskSignal]] = defaultdict(list)
    by_org_service: dict[tuple[int, int], list[RiskSignal]] = defaultdict(list)
    by_org_doctor: dict[tuple[int, int], list[RiskSignal]] = defaultdict(list)
    by_type_service: dict[tuple[str, int], list[RiskSignal]] = defaultdict(list)
    by_patient_org: dict[tuple[int, int], list[RiskSignal]] = defaultdict(list)
    for signal in signals:
        record = signal.record
        by_org[record.organization_id].append(signal)
        by_org_service[(record.organization_id, record.service_id)].append(signal)
        by_org_doctor[(record.organization_id, record.doctor_id)].append(signal)
        by_type_service[(signal.anomaly_type, record.service_id)].append(signal)
        by_patient_org[(record.patient_id, record.organization_id)].append(signal)

    repeated_types = {"exact_duplicate", "short_interval_repeat", "excessive_frequency"}
    for (organization_id, service_id), grouped in by_org_service.items():
        repeated = [signal for signal in grouped if signal.anomaly_type in repeated_types]
        if len(repeated) >= 4 and _meets_period_or_strong_link(repeated, 2):
            candidates.append(
                PatternCandidate(
                    "repeated_service",
                    (str(organization_id), str(service_id)),
                    tuple(sorted(signal.id for signal in repeated)),
                )
            )

        share = len(grouped) / max(1, len(by_org[organization_id]))
        if (
            len(grouped) >= 4
            and share >= PATTERN_THRESHOLDS["service_concentration"]["share"]
            and _meets_period_or_strong_link(grouped, 2)
        ):
            candidates.append(
                PatternCandidate(
                    "service_concentration",
                    (str(organization_id), str(service_id)),
                    tuple(sorted(signal.id for signal in grouped)),
                )
            )

        price = [signal for signal in grouped if signal.anomaly_type == "price_deviation"]
        if len(price) >= 3 and len({_period(signal) for signal in price}) >= 2:
            candidates.append(
                PatternCandidate(
                    "recurring_price_deviation",
                    (str(organization_id), str(service_id)),
                    tuple(sorted(signal.id for signal in price)),
                )
            )

    for (organization_id, doctor_id), grouped in by_org_doctor.items():
        share = len(grouped) / max(1, len(by_org[organization_id]))
        if (
            len(grouped) >= 4
            and share >= PATTERN_THRESHOLDS["doctor_concentration"]["share"]
            and _meets_period_or_strong_link(grouped, 2)
        ):
            candidates.append(
                PatternCandidate(
                    "doctor_concentration",
                    (str(organization_id), str(doctor_id)),
                    tuple(sorted(signal.id for signal in grouped)),
                )
            )

    for organization_id, grouped in by_org.items():
        spike = [signal for signal in grouped if signal.anomaly_type == "end_of_month_spike"]
        if len(spike) >= 3 and len({_period(signal) for signal in spike}) >= 2:
            candidates.append(
                PatternCandidate(
                    "recurring_spike",
                    (str(organization_id), "last-five-days"),
                    tuple(sorted(signal.id for signal in spike)),
                )
            )

    sequence_groups: dict[tuple[int, tuple[int, ...]], set[int]] = defaultdict(set)
    sequence_patients: dict[tuple[int, tuple[int, ...]], set[int]] = defaultdict(set)
    for (patient_id, organization_id), patient_signals in by_patient_org.items():
        ordered = sorted(
            patient_signals,
            key=lambda item: (item.record.service_date, item.record.service_time, item.id),
        )
        if len(ordered) < 2:
            continue
        signature = tuple(signal.record.service_id for signal in ordered[:4])
        if len(signature) < 2:
            continue
        key = (organization_id, signature)
        sequence_groups[key].update(signal.id for signal in ordered)
        sequence_patients[key].add(patient_id)
    for (organization_id, signature), signal_ids in sequence_groups.items():
        if len(signal_ids) >= 3 and len(sequence_patients[(organization_id, signature)]) >= 2:
            candidates.append(
                PatternCandidate(
                    "service_sequence",
                    (str(organization_id), *(str(item) for item in signature)),
                    tuple(sorted(signal_ids)),
                    signature,
                )
            )

    patient_signature_groups: dict[tuple[int, str, tuple[int, ...]], set[int]] = defaultdict(set)
    patient_signature_people: dict[tuple[int, str, tuple[int, ...]], set[int]] = defaultdict(set)
    for (patient_id, organization_id), patient_signals in by_patient_org.items():
        services = tuple(sorted({signal.record.service_id for signal in patient_signals})[:4])
        dominant_type = Counter(signal.anomaly_type for signal in patient_signals).most_common(1)[
            0
        ][0]
        signature = services if len(services) >= 2 else (services[0],) if services else ()
        patient_key = (organization_id, dominant_type, signature)
        patient_signature_groups[patient_key].update(signal.id for signal in patient_signals)
        patient_signature_people[patient_key].add(patient_id)
    for (organization_id, anomaly_type, services), signal_ids in patient_signature_groups.items():
        people = patient_signature_people[(organization_id, anomaly_type, services)]
        if len(signal_ids) >= 3 and len(people) >= 3:
            candidates.append(
                PatternCandidate(
                    "linked_patient_group",
                    (str(organization_id), anomaly_type, *(str(item) for item in services)),
                    tuple(sorted(signal_ids)),
                )
            )

    for (anomaly_type, service_id), grouped in by_type_service.items():
        if (
            len(grouped) >= 4
            and len({signal.organization_id for signal in grouped}) >= 2
            and _meets_period_or_strong_link(grouped, 2)
        ):
            candidates.append(
                PatternCandidate(
                    "cross_organization",
                    (anomaly_type, str(service_id)),
                    tuple(sorted(signal.id for signal in grouped)),
                )
            )

    unique: dict[str, PatternCandidate] = {}
    for candidate in candidates:
        fingerprint = pattern_fingerprint(
            candidate.pattern_type, candidate.key_parts, candidate.sequence_signature
        )
        unique[fingerprint] = candidate
    selected: list[PatternCandidate] = []
    by_type: dict[str, list[PatternCandidate]] = defaultdict(list)
    for candidate in unique.values():
        by_type[candidate.pattern_type].append(candidate)
    for pattern_type in PATTERN_TYPES:
        selected.extend(
            sorted(by_type[pattern_type], key=lambda item: (-len(item.signal_ids), item.key_parts))[
                :MAX_PATTERNS_PER_TYPE
            ]
        )
    return selected


def _context(
    candidate: PatternCandidate,
    signals_by_id: dict[int, RiskSignal],
    records_by_id: dict[int, MedicalRecord],
) -> CandidateContext:
    signals = tuple(signals_by_id[signal_id] for signal_id in candidate.signal_ids)
    record_ids = {
        record_id
        for signal in signals
        for record_id in {signal.medical_record_id, *signal.related_record_ids}
        if record_id in records_by_id
    }
    primary_records = [signal.record for signal in signals]
    return CandidateContext(
        signals=signals,
        record_ids=tuple(sorted(record_ids)),
        organization_ids=tuple(sorted({record.organization_id for record in primary_records})),
        doctor_ids=tuple(sorted({record.doctor_id for record in primary_records})),
        patient_ids=tuple(sorted({record.patient_id for record in primary_records})),
        service_ids=tuple(sorted({record.service_id for record in primary_records})),
        periods=tuple(
            sorted({record.service_date.strftime("%Y-%m") for record in primary_records})
        ),
        financial_significance=sum(
            (records_by_id[record_id].amount for record_id in record_ids), Decimal("0")
        ),
    )


def _name_and_description(context: CandidateContext, pattern_type: str) -> tuple[str, str]:
    primary_org = Counter(signal.organization.name for signal in context.signals).most_common(1)[0][
        0
    ]
    primary_service = Counter(signal.record.service.name for signal in context.signals).most_common(
        1
    )[0][0]
    type_label = PATTERN_TYPES[pattern_type]
    name = f"{type_label}: {primary_service}"
    if pattern_type in {"doctor_concentration", "recurring_spike"}:
        name = f"{type_label}: {primary_org}"
    if pattern_type == "cross_organization":
        name = f"{type_label}: {primary_service}"
    signal_text = _ru_count(
        len(context.signals), "связанный сигнал", "связанных сигнала", "связанных сигналов"
    )
    description = (
        f"Периодов наблюдения: {len(context.periods)}. Сформировано "
        f"{signal_text}. "
        f"Связано организаций: {len(context.organization_ids)}, врачей: {len(context.doctor_ids)}, "
        f"обезличенных пациентов: {len(context.patient_ids)}."
    )
    return name, description


def _participant_stability(context: CandidateContext) -> float:
    if not context.signals:
        return 0.0
    doctor_share = Counter(signal.record.doctor_id for signal in context.signals).most_common(1)[0][
        1
    ] / len(context.signals)
    service_share = Counter(signal.record.service_id for signal in context.signals).most_common(1)[
        0
    ][1] / len(context.signals)
    return min(100.0, (doctor_share + service_share) * 50)


def _sequence_similarity(candidate: PatternCandidate, context: CandidateContext) -> float:
    if candidate.sequence_signature:
        return min(100.0, 65 + len(candidate.sequence_signature) * 8.75)
    dominant_share = Counter(signal.anomaly_type for signal in context.signals).most_common(1)[0][
        1
    ] / len(context.signals)
    return dominant_share * 100


def _add_participants(
    db: Session,
    pattern: RecurringPattern,
    context: CandidateContext,
    records_by_id: dict[int, MedicalRecord],
) -> None:
    signal_count = len(context.signals)
    counts = {
        "organization": Counter(signal.record.organization_id for signal in context.signals),
        "doctor": Counter(signal.record.doctor_id for signal in context.signals),
        "patient": Counter(signal.record.patient_id for signal in context.signals),
        "service": Counter(signal.record.service_id for signal in context.signals),
    }
    primary_org = counts["organization"].most_common(1)[0][0]
    primary_doctor = counts["doctor"].most_common(1)[0][0]
    primary_service = counts["service"].most_common(1)[0][0]
    for organization_id, count in sorted(counts["organization"].items()):
        ids = {
            record_id
            for record_id in context.record_ids
            if records_by_id[record_id].organization_id == organization_id
        }
        db.add(
            PatternOrganization(
                pattern_id=pattern.id,
                organization_id=organization_id,
                signal_count=count,
                financial_significance=sum(
                    (records_by_id[item].amount for item in ids), Decimal("0")
                ),
                is_primary=organization_id == primary_org,
            )
        )
    for doctor_id, count in sorted(counts["doctor"].items()):
        db.add(
            PatternDoctor(
                pattern_id=pattern.id,
                doctor_id=doctor_id,
                signal_count=count,
                share=count / signal_count,
                is_primary=doctor_id == primary_doctor,
            )
        )
    for patient_id, count in sorted(counts["patient"].items()):
        db.add(
            PatternPatient(
                pattern_id=pattern.id,
                patient_id=patient_id,
                signal_count=count,
                share=count / signal_count,
            )
        )
    for service_id, count in sorted(counts["service"].items()):
        ids = {
            record_id
            for record_id in context.record_ids
            if records_by_id[record_id].service_id == service_id
        }
        db.add(
            PatternService(
                pattern_id=pattern.id,
                service_id=service_id,
                signal_count=count,
                financial_significance=sum(
                    (records_by_id[item].amount for item in ids), Decimal("0")
                ),
                is_primary=service_id == primary_service,
            )
        )


def build_patterns(db: Session, run: AnalysisRun | None = None) -> PatternBuildResponse:
    current_run = run or db.scalar(select(AnalysisRun).order_by(AnalysisRun.id.desc()))
    if current_run is None:
        raise ValueError("Сначала выполните анализ медицинских услуг")
    signals = list(
        db.scalars(
            select(RiskSignal)
            .options(
                selectinload(RiskSignal.organization),
                selectinload(RiskSignal.record).selectinload(MedicalRecord.organization),
                selectinload(RiskSignal.record).selectinload(MedicalRecord.doctor),
                selectinload(RiskSignal.record).selectinload(MedicalRecord.patient),
                selectinload(RiskSignal.record).selectinload(MedicalRecord.service),
                selectinload(RiskSignal.review_priority),
            )
            .order_by(RiskSignal.id)
        ).all()
    )
    records = list(db.scalars(select(MedicalRecord).order_by(MedicalRecord.id)).all())
    records_by_id = {record.id: record for record in records}
    signals_by_id = {signal.id: signal for signal in signals}
    candidates = _candidate_groups(signals)
    contexts = [_context(candidate, signals_by_id, records_by_id) for candidate in candidates]
    amounts = sorted(float(context.financial_significance) for context in contexts)

    db.execute(delete(PatternSignal))
    db.execute(update(RecurringPattern).values(is_active=False))
    db.flush()
    type_counts: Counter[str] = Counter()
    recurring_count = 0
    for candidate, context in zip(candidates, contexts, strict=True):
        fingerprint = pattern_fingerprint(
            candidate.pattern_type, candidate.key_parts, candidate.sequence_signature
        )
        pattern = db.scalar(
            select(RecurringPattern).where(RecurringPattern.fingerprint == fingerprint)
        )
        recurrence_runs = 1
        if pattern is not None:
            recurrence_runs = pattern.recurrence_runs + (
                pattern.last_analysis_run_id != current_run.id
            )
            recurring_count += 1
            db.execute(
                delete(PatternOrganization).where(PatternOrganization.pattern_id == pattern.id)
            )
            db.execute(delete(PatternDoctor).where(PatternDoctor.pattern_id == pattern.id))
            db.execute(delete(PatternPatient).where(PatternPatient.pattern_id == pattern.id))
            db.execute(delete(PatternService).where(PatternService.pattern_id == pattern.id))
            db.execute(delete(PatternFactor).where(PatternFactor.pattern_id == pattern.id))
        else:
            pattern = RecurringPattern(
                fingerprint=fingerprint,
                name="",
                pattern_type=candidate.pattern_type,
                description="",
                first_seen=current_run.period_start,
                last_seen=current_run.period_end,
                period_count=0,
                signal_count=0,
                organization_count=0,
                doctor_count=0,
                patient_count=0,
                service_count=0,
                financial_significance=Decimal("0"),
                average_risk=0,
                average_priority=0,
                stability_score=0,
                stability_level="Низкая",
                importance_score=0,
                importance_level=RiskLevel.LOW,
                first_analysis_run_id=current_run.id,
                last_analysis_run_id=current_run.id,
                recurrence_runs=1,
                is_active=True,
            )
            db.add(pattern)
            db.flush()
        percentile = 100 * (
            sum(amount <= float(context.financial_significance) for amount in amounts)
            / max(1, len(amounts))
        )
        stability, stability_factors = calculate_stability(
            len(context.periods),
            len(context.signals),
            _participant_stability(context),
            _sequence_similarity(candidate, context),
            percentile,
            recurrence_runs,
        )
        average_risk = sum(signal.score for signal in context.signals) / len(context.signals)
        priorities = [
            signal.review_priority.score for signal in context.signals if signal.review_priority
        ]
        average_priority = sum(priorities) / len(priorities) if priorities else average_risk
        importance, importance_factors = calculate_importance(
            average_risk,
            average_priority,
            percentile,
            len(context.patient_ids),
            len(context.periods),
            len(context.organization_ids),
            stability,
        )
        name, description = _name_and_description(context, candidate.pattern_type)
        dates = [signal.record.service_date for signal in context.signals]
        pattern.name = name
        pattern.pattern_type = candidate.pattern_type
        pattern.description = description
        pattern.first_seen = min(dates)
        pattern.last_seen = max(dates)
        pattern.period_count = len(context.periods)
        pattern.signal_count = len(context.signals)
        pattern.organization_count = len(context.organization_ids)
        pattern.doctor_count = len(context.doctor_ids)
        pattern.patient_count = len(context.patient_ids)
        pattern.service_count = len(context.service_ids)
        pattern.financial_significance = context.financial_significance
        pattern.average_risk = round(average_risk, 2)
        pattern.average_priority = round(average_priority, 2)
        pattern.stability_score = stability
        pattern.stability_level = stability_level(stability)
        pattern.importance_score = importance
        pattern.importance_level = priority_level_for_score(importance)
        pattern.last_analysis_run_id = current_run.id
        pattern.recurrence_runs = recurrence_runs
        pattern.is_active = True
        pattern.updated_at = utc_now()
        restore_pattern_status(db, pattern)
        db.flush()
        for signal in context.signals:
            db.add(
                PatternSignal(
                    pattern_id=pattern.id,
                    signal_id=signal.id,
                    analysis_run_id=current_run.id,
                    strength=round(_sequence_similarity(candidate, context) / 100, 4),
                    relationship_explanation=(
                        "Сигнал соответствует критериям модели "
                        f"«{PATTERN_TYPES[candidate.pattern_type]}»."
                    ),
                )
            )
        _add_participants(db, pattern, context, records_by_id)
        for factor in [*stability_factors, *importance_factors]:
            db.add(PatternFactor(pattern_id=pattern.id, **factor))
        db.execute(
            delete(PatternSnapshot).where(
                PatternSnapshot.pattern_id == pattern.id,
                PatternSnapshot.analysis_run_id == current_run.id,
            )
        )
        db.add(
            PatternSnapshot(
                pattern_id=pattern.id,
                analysis_run_id=current_run.id,
                signal_count=pattern.signal_count,
                financial_significance=pattern.financial_significance,
                stability_score=pattern.stability_score,
                importance_score=pattern.importance_score,
                organization_count=pattern.organization_count,
                patient_count=pattern.patient_count,
                first_seen=pattern.first_seen,
                last_seen=pattern.last_seen,
            )
        )
        db.execute(
            delete(PatternFingerprintHistory).where(
                PatternFingerprintHistory.entity_fingerprint == pattern.fingerprint,
                PatternFingerprintHistory.analysis_run_id == current_run.id,
            )
        )
        db.add(
            PatternFingerprintHistory(
                entity_fingerprint=pattern.fingerprint,
                analysis_run_id=current_run.id,
                current_pattern_id=pattern.id,
                pattern_type=pattern.pattern_type,
                stability_score=pattern.stability_score,
                importance_score=pattern.importance_score,
                financial_significance=pattern.financial_significance,
                signal_count=pattern.signal_count,
                participant_signature={
                    "organizations": list(context.organization_ids),
                    "doctors": list(context.doctor_ids),
                    "patients": list(context.patient_ids),
                    "services": list(context.service_ids),
                },
                status_at_run=pattern.review_status.value,
                appeared_at=utc_now(),
            )
        )
        type_counts[candidate.pattern_type] += 1
    db.flush()
    if run is None:
        db.commit()
    return PatternBuildResponse(
        analysis_run_id=current_run.id,
        patterns_built=len(candidates),
        recurring_patterns=recurring_count,
        pattern_types=dict(type_counts),
    )


def _main_organization(db: Session, pattern_id: int) -> str | None:
    return db.scalar(
        select(MedicalOrganization.name)
        .join(PatternOrganization, PatternOrganization.organization_id == MedicalOrganization.id)
        .where(PatternOrganization.pattern_id == pattern_id)
        .order_by(PatternOrganization.is_primary.desc(), PatternOrganization.signal_count.desc())
    )


def _main_organizations(db: Session, pattern_ids: list[int]) -> dict[int, str]:
    if not pattern_ids:
        return {}
    rows = db.execute(
        select(PatternOrganization.pattern_id, MedicalOrganization.name)
        .join(MedicalOrganization, MedicalOrganization.id == PatternOrganization.organization_id)
        .where(PatternOrganization.pattern_id.in_(pattern_ids))
        .order_by(
            PatternOrganization.pattern_id,
            PatternOrganization.is_primary.desc(),
            PatternOrganization.signal_count.desc(),
        )
    ).all()
    result: dict[int, str] = {}
    for pattern_id, name in rows:
        result.setdefault(pattern_id, name)
    return result


def _list_item_with_organization(
    pattern: RecurringPattern, main_organization: str | None
) -> PatternListItem:
    return PatternListItem(
        id=pattern.id,
        fingerprint=pattern.fingerprint,
        name=pattern.name,
        pattern_type=pattern.pattern_type,
        pattern_type_label=PATTERN_TYPES.get(pattern.pattern_type, pattern.pattern_type),
        description=pattern.description,
        first_seen=pattern.first_seen,
        last_seen=pattern.last_seen,
        period_count=pattern.period_count,
        signal_count=pattern.signal_count,
        organization_count=pattern.organization_count,
        doctor_count=pattern.doctor_count,
        patient_count=pattern.patient_count,
        service_count=pattern.service_count,
        financial_significance=pattern.financial_significance,
        average_risk=pattern.average_risk,
        average_priority=pattern.average_priority,
        stability_score=pattern.stability_score,
        stability_level=pattern.stability_level,
        importance_score=pattern.importance_score,
        importance_level=pattern.importance_level,
        review_status=pattern.review_status,
        formed_at=pattern.formed_at,
        main_organization=main_organization,
        primary_reason=pattern.description,
    )


def _list_item(db: Session, pattern: RecurringPattern) -> PatternListItem:
    return _list_item_with_organization(pattern, _main_organization(db, pattern.id))


def list_patterns(
    db: Session,
    page: int,
    page_size: int,
    pattern_type: str | None,
    organization_id: int | None,
    stability: str | None,
    importance: str | None,
    status: str | None,
    financial_min: Decimal | None,
    financial_max: Decimal | None,
    period: str | None,
    sort: str,
) -> PaginatedPatterns:
    query = select(RecurringPattern).where(RecurringPattern.is_active.is_(True))
    count_query = select(func.count(func.distinct(RecurringPattern.id))).where(
        RecurringPattern.is_active.is_(True)
    )
    filters = []
    if pattern_type:
        technical = next(
            (key for key, label in PATTERN_TYPES.items() if label == pattern_type), pattern_type
        )
        filters.append(RecurringPattern.pattern_type == technical)
    if stability:
        filters.append(RecurringPattern.stability_level == stability)
    if importance:
        filters.append(RecurringPattern.importance_level == importance)
    if status:
        filters.append(RecurringPattern.review_status == status)
    if financial_min is not None:
        filters.append(RecurringPattern.financial_significance >= financial_min)
    if financial_max is not None:
        filters.append(RecurringPattern.financial_significance <= financial_max)
    if period:
        year, month = (int(item) for item in period.split("-", maxsplit=1))
        period_start = date(year, month, 1)
        period_end = date(year + (month == 12), 1 if month == 12 else month + 1, 1)
        filters.extend(
            [RecurringPattern.first_seen < period_end, RecurringPattern.last_seen >= period_start]
        )
    if organization_id:
        query = query.join(PatternOrganization).where(
            PatternOrganization.organization_id == organization_id
        )
        count_query = count_query.join(PatternOrganization).where(
            PatternOrganization.organization_id == organization_id
        )
    query = query.where(*filters)
    count_query = count_query.where(*filters)
    if sort == "stability":
        query = query.order_by(RecurringPattern.stability_score.desc())
    elif sort == "financial":
        query = query.order_by(RecurringPattern.financial_significance.desc())
    elif sort == "signals":
        query = query.order_by(RecurringPattern.signal_count.desc())
    elif sort == "last_seen":
        query = query.order_by(RecurringPattern.last_seen.desc())
    else:
        query = query.order_by(RecurringPattern.importance_score.desc())
    patterns = list(
        db.scalars(
            query.order_by(RecurringPattern.id).offset((page - 1) * page_size).limit(page_size)
        ).all()
    )
    main_organizations = _main_organizations(db, [pattern.id for pattern in patterns])
    organization_rows = db.execute(
        select(MedicalOrganization.id, MedicalOrganization.name, func.count(PatternOrganization.id))
        .join(PatternOrganization, PatternOrganization.organization_id == MedicalOrganization.id)
        .join(RecurringPattern, RecurringPattern.id == PatternOrganization.pattern_id)
        .where(RecurringPattern.is_active.is_(True))
        .group_by(MedicalOrganization.id, MedicalOrganization.name)
        .order_by(MedicalOrganization.name)
    ).all()
    return PaginatedPatterns(
        items=[
            _list_item_with_organization(pattern, main_organizations.get(pattern.id))
            for pattern in patterns
        ],
        total=db.scalar(count_query) or 0,
        page=page,
        page_size=page_size,
        pattern_types=list(PATTERN_TYPES.values()),
        organizations=[
            PatternParticipant(id=item_id, label=name, signal_count=count)
            for item_id, name, count in organization_rows
        ],
    )


def _participants(db: Session, pattern_id: int, kind: str) -> list[PatternParticipant]:
    if kind == "organization":
        organization_rows = db.execute(
            select(PatternOrganization, MedicalOrganization)
            .join(
                MedicalOrganization, MedicalOrganization.id == PatternOrganization.organization_id
            )
            .where(PatternOrganization.pattern_id == pattern_id)
            .order_by(
                PatternOrganization.is_primary.desc(), PatternOrganization.signal_count.desc()
            )
        ).all()
        return [
            PatternParticipant(
                id=link.organization_id,
                label=item.name,
                signal_count=link.signal_count,
                financial_significance=link.financial_significance,
                is_primary=link.is_primary,
            )
            for link, item in organization_rows
        ]
    if kind == "doctor":
        doctor_rows = db.execute(
            select(PatternDoctor, Doctor)
            .join(Doctor, Doctor.id == PatternDoctor.doctor_id)
            .where(PatternDoctor.pattern_id == pattern_id)
            .order_by(PatternDoctor.signal_count.desc())
        ).all()
        return [
            PatternParticipant(
                id=link.doctor_id,
                label=item.anonymous_code,
                signal_count=link.signal_count,
                share=link.share,
                is_primary=link.is_primary,
            )
            for link, item in doctor_rows
        ]
    if kind == "patient":
        patient_rows = db.execute(
            select(PatternPatient, Patient)
            .join(Patient, Patient.id == PatternPatient.patient_id)
            .where(PatternPatient.pattern_id == pattern_id)
            .order_by(PatternPatient.signal_count.desc())
        ).all()
        return [
            PatternParticipant(
                id=link.patient_id,
                label=item.anonymous_code,
                signal_count=link.signal_count,
                share=link.share,
            )
            for link, item in patient_rows
        ]
    service_rows = db.execute(
        select(PatternService, MedicalService)
        .join(MedicalService, MedicalService.id == PatternService.service_id)
        .where(PatternService.pattern_id == pattern_id)
        .order_by(PatternService.is_primary.desc(), PatternService.signal_count.desc())
    ).all()
    return [
        PatternParticipant(
            id=link.service_id,
            label=item.name,
            signal_count=link.signal_count,
            financial_significance=link.financial_significance,
            is_primary=link.is_primary,
        )
        for link, item in service_rows
    ]


def get_pattern(db: Session, pattern_id: int) -> PatternDetail | None:
    pattern = db.get(RecurringPattern, pattern_id)
    if pattern is None:
        return None
    doctors = _participants(db, pattern_id, "doctor")
    services = _participants(db, pattern_id, "service")
    dominant_doctor_share = doctors[0].share if doctors else 0
    signal_text = _ru_count(
        pattern.signal_count, "связанный сигнал", "связанных сигнала", "связанных сигналов"
    )
    explanation = (
        f"Периодов наблюдения: {pattern.period_count}. Сформировано "
        f"{signal_text}. "
        f"{round((dominant_doctor_share or 0) * 100)}% сигналов связаны с ведущим "
        "врачом модели. Финансовая значимость составляет "
        f"{pattern.financial_significance:,.0f} тенге."
    ).replace(",", " ")
    factors = list(
        db.scalars(
            select(PatternFactor)
            .where(PatternFactor.pattern_id == pattern_id)
            .order_by(PatternFactor.factor_group, PatternFactor.contribution.desc())
        ).all()
    )
    reviews = decision_history(db, DecisionEntityType.PATTERN, pattern.fingerprint).events
    return PatternDetail(
        **_list_item(db, pattern).model_dump(),
        recurrence_runs=pattern.recurrence_runs,
        explanation=explanation,
        disclaimer=PATTERN_DISCLAIMER,
        limitations=[
            "Анализ основан на доступных обезличенных данных.",
            "Система не располагает полной клинической историей пациента.",
            "Сходство услуг и временных интервалов может иметь медицинское или "
            "организационное объяснение.",
            "Итоговое решение принимает уполномоченный специалист.",
        ],
        factors=[PatternFactorItem.model_validate(item) for item in factors],
        organizations=_participants(db, pattern_id, "organization"),
        doctors=doctors,
        patients=_participants(db, pattern_id, "patient"),
        services=services,
        reviews=[
            PatternReviewItem(
                id=item.id,
                status=PatternReviewStatus(item.decision_status),
                comment=item.comment,
                reviewer_name=item.reviewer_display_name,
                created_at=item.created_at,
            )
            for item in reversed(reviews)
        ],
    )


def get_pattern_signals(db: Session, pattern_id: int) -> list[SignalListItem]:
    signals = list(
        db.scalars(
            select(RiskSignal)
            .join(PatternSignal, PatternSignal.signal_id == RiskSignal.id)
            .outerjoin(ReviewPriority)
            .where(PatternSignal.pattern_id == pattern_id)
            .options(
                selectinload(RiskSignal.organization),
                selectinload(RiskSignal.record).selectinload(MedicalRecord.patient),
                selectinload(RiskSignal.record).selectinload(MedicalRecord.service),
                selectinload(RiskSignal.review_priority),
            )
            .order_by(ReviewPriority.score.desc())
        ).all()
    )
    return [to_list_item(signal, include_priority_details=False) for signal in signals]


def get_pattern_timeline(db: Session, pattern_id: int) -> list[PatternTimelinePoint]:
    signals = list(
        db.scalars(
            select(RiskSignal)
            .join(PatternSignal, PatternSignal.signal_id == RiskSignal.id)
            .where(PatternSignal.pattern_id == pattern_id)
            .options(selectinload(RiskSignal.record), selectinload(RiskSignal.review_priority))
        ).all()
    )
    records = {record.id: record for record in db.scalars(select(MedicalRecord)).all()}
    period_signals: dict[str, set[int]] = defaultdict(set)
    period_records: dict[str, set[int]] = defaultdict(set)
    for signal in signals:
        period = signal.record.service_date.strftime("%Y-%m")
        period_signals[period].add(signal.id)
        ids = (
            signal.review_priority.linked_record_ids
            if signal.review_priority
            else [signal.medical_record_id]
        )
        period_records[period].update(
            record_id
            for record_id in ids
            if record_id in records and records[record_id].service_date.strftime("%Y-%m") == period
        )
    return [
        PatternTimelinePoint(
            period=period,
            signal_count=len(period_signals[period]),
            financial_significance=sum(
                (records[item].amount for item in period_records[period]), Decimal("0")
            ),
        )
        for period in sorted(period_signals)
    ]


def get_pattern_graph(db: Session, pattern_id: int, limit: int = 60) -> PatternGraph | None:
    detail = get_pattern(db, pattern_id)
    if detail is None:
        return None
    signals = get_pattern_signals(db, pattern_id)
    all_nodes: list[PatternGraphNode] = [
        PatternGraphNode(
            id=f"pattern-{pattern_id}",
            node_type="pattern",
            label=detail.name,
            subtitle=f"Важность {detail.importance_score} из 100",
            size=34,
            signal_count=detail.signal_count,
            financial_significance=detail.financial_significance,
            href=f"/patterns/{pattern_id}",
            is_primary=True,
        )
    ]
    for item in detail.organizations:
        all_nodes.append(
            PatternGraphNode(
                id=f"organization-{item.id}",
                node_type="organization",
                label=item.label,
                subtitle=_ru_count(item.signal_count, "сигнал", "сигнала", "сигналов"),
                size=min(30, 16 + item.signal_count / 3),
                signal_count=item.signal_count,
                financial_significance=item.financial_significance or Decimal("0"),
                href=f"/organizations/{item.id}",
                is_primary=item.is_primary,
            )
        )
    for item in detail.doctors:
        all_nodes.append(
            PatternGraphNode(
                id=f"doctor-{item.id}",
                node_type="doctor",
                label=item.label,
                subtitle=_ru_count(item.signal_count, "сигнал", "сигнала", "сигналов"),
                size=min(26, 14 + item.signal_count / 4),
                signal_count=item.signal_count,
                financial_significance=Decimal("0"),
                is_primary=item.is_primary,
            )
        )
    for item in detail.services:
        all_nodes.append(
            PatternGraphNode(
                id=f"service-{item.id}",
                node_type="service",
                label=item.label,
                subtitle=_ru_count(item.signal_count, "сигнал", "сигнала", "сигналов"),
                size=min(28, 15 + item.signal_count / 4),
                signal_count=item.signal_count,
                financial_significance=item.financial_significance or Decimal("0"),
                is_primary=item.is_primary,
            )
        )
    for item in detail.patients:
        all_nodes.append(
            PatternGraphNode(
                id=f"patient-{item.id}",
                node_type="patient",
                label=item.label,
                subtitle=_ru_count(item.signal_count, "сигнал", "сигнала", "сигналов"),
                size=min(22, 12 + item.signal_count / 3),
                signal_count=item.signal_count,
                financial_significance=Decimal("0"),
            )
        )
    for list_signal in signals:
        all_nodes.append(
            PatternGraphNode(
                id=f"signal-{list_signal.id}",
                node_type="signal",
                label=f"Сигнал № {list_signal.id}",
                subtitle=list_signal.service_name,
                size=min(24, 12 + list_signal.score / 15),
                signal_count=1,
                financial_significance=(list_signal.financial_significance or list_signal.amount),
                href=f"/signals/{list_signal.id}",
            )
        )
    priority = {
        "pattern": 0,
        "organization": 1,
        "service": 2,
        "doctor": 3,
        "signal": 4,
        "patient": 5,
    }
    visible = sorted(
        all_nodes,
        key=lambda item: (
            priority[item.node_type],
            not item.is_primary,
            -item.signal_count,
            item.id,
        ),
    )[:limit]
    visible_ids = {item.id for item in visible}
    edges: list[PatternGraphEdge] = []
    signal_details = list(
        db.scalars(
            select(RiskSignal)
            .join(PatternSignal, PatternSignal.signal_id == RiskSignal.id)
            .where(PatternSignal.pattern_id == pattern_id)
            .options(selectinload(RiskSignal.record))
        ).all()
    )
    for signal_row in signal_details:
        signal_node = f"signal-{signal_row.id}"
        if signal_node not in visible_ids:
            continue
        relations = [
            (f"pattern-{pattern_id}", signal_node, "модель включает сигнал"),
            (
                signal_node,
                f"organization-{signal_row.organization_id}",
                "сигнал относится к организации",
            ),
            (
                signal_node,
                f"doctor-{signal_row.record.doctor_id}",
                "сигнал связан с врачом",
            ),
            (
                signal_node,
                f"patient-{signal_row.record.patient_id}",
                "сигнал связан с пациентом",
            ),
            (
                signal_node,
                f"service-{signal_row.record.service_id}",
                "сигнал относится к услуге",
            ),
            (
                f"doctor-{signal_row.record.doctor_id}",
                f"service-{signal_row.record.service_id}",
                "врач оказывает услугу",
            ),
            (
                f"patient-{signal_row.record.patient_id}",
                f"service-{signal_row.record.service_id}",
                "пациент получил услугу",
            ),
        ]
        for source, target, relationship in relations:
            if source in visible_ids and target in visible_ids:
                edge_id = f"{source}:{target}:{relationship}"
                if not any(edge.id == edge_id for edge in edges):
                    edges.append(
                        PatternGraphEdge(
                            id=edge_id,
                            source=source,
                            target=target,
                            relationship=relationship,
                            weight=1.0,
                        )
                    )
    return PatternGraph(
        pattern_id=pattern_id,
        nodes=visible,
        edges=edges,
        hidden_nodes=max(0, len(all_nodes) - len(visible)),
        legend={
            "pattern": "Повторяющаяся модель",
            "organization": "Медицинская организация",
            "doctor": "Врач",
            "patient": "Обезличенный пациент",
            "service": "Медицинская услуга",
            "signal": "Сигнал риска",
        },
    )


def review_pattern(
    db: Session, pattern_id: int, payload: PatternReviewCreate
) -> PatternDetail | None:
    pattern = db.get(RecurringPattern, pattern_id)
    if pattern is None:
        return None
    default_reasons = {
        "Значимость подтверждена": "данные подтверждают отклонение",
        "Отмечено как несущественное": "допустимое организационное отклонение",
        "Направлено на углублённую проверку": "требуется проверка связанных сигналов",
        "Требуются дополнительные сведения": "требуется запрос документов",
        "Оценка завершена": "данные подтверждают отклонение",
        "Не оценено": "требуется клиническая экспертиза",
    }
    reason_code = (
        default_reasons[payload.status.value]
        if payload.reason_code == "иная причина" and not payload.comment.strip()
        else payload.reason_code
    )
    event_payload = legacy_pattern_payload(
        payload.status, payload.comment, payload.reviewer_name, reason_code
    ).model_copy(
        update={
            "reviewer_id": payload.reviewer_id,
            "supersedes_event_id": payload.supersedes_event_id,
            "feedback": payload.feedback,
        }
    )
    if payload.supersedes_event_id is not None:
        event_payload = event_payload.model_copy(update={"action_type": "Решение уточнено"})
    add_pattern_event(db, pattern, event_payload)
    db.commit()
    return get_pattern(db, pattern_id)


def pattern_summary(db: Session) -> PatternSummary:
    latest_run_id = db.scalar(select(AnalysisRun.id).order_by(AnalysisRun.id.desc()))
    patterns = list(
        db.scalars(
            select(RecurringPattern)
            .where(RecurringPattern.is_active.is_(True))
            .order_by(RecurringPattern.importance_score.desc(), RecurringPattern.id)
        ).all()
    )
    pattern_ids = [pattern.id for pattern in patterns]
    signal_ids = set(
        db.scalars(
            select(PatternSignal.signal_id).where(PatternSignal.pattern_id.in_(pattern_ids))
        ).all()
    )
    priorities = (
        db.scalars(select(ReviewPriority).where(ReviewPriority.signal_id.in_(signal_ids))).all()
        if signal_ids
        else []
    )
    unique_record_ids = {
        record_id for priority in priorities for record_id in priority.linked_record_ids
    }
    records_by_id = (
        {
            record.id: record
            for record in db.scalars(
                select(MedicalRecord).where(MedicalRecord.id.in_(unique_record_ids))
            ).all()
        }
        if unique_record_ids
        else {}
    )
    financial = sum((records_by_id[item].amount for item in unique_record_ids), Decimal("0"))
    high = [
        pattern for pattern in patterns if pattern.stability_level in {"Высокая", "Очень высокая"}
    ]
    high_pattern_ids = [pattern.id for pattern in high]
    stable_organization_count = (
        len(
            set(
                db.scalars(
                    select(PatternOrganization.organization_id).where(
                        PatternOrganization.pattern_id.in_(high_pattern_ids)
                    )
                ).all()
            )
        )
        if high_pattern_ids
        else 0
    )
    selected_patterns = list(patterns[:5])
    if patterns:
        selected_patterns.append(max(patterns, key=lambda item: item.financial_significance))
    main_organizations = _main_organizations(
        db, list({pattern.id for pattern in selected_patterns})
    )

    def summary_item(pattern: RecurringPattern) -> PatternListItem:
        return _list_item_with_organization(pattern, main_organizations.get(pattern.id))

    return PatternSummary(
        analysis_run_id=latest_run_id,
        total_patterns=len(patterns),
        high_stability_patterns=len(high),
        financial_significance=financial,
        affected_organizations=len(
            {
                link.organization_id
                for link in db.scalars(
                    select(PatternOrganization)
                    .join(RecurringPattern)
                    .where(RecurringPattern.is_active.is_(True))
                ).all()
            }
        ),
        stable_pattern_organizations=stable_organization_count,
        affected_patients=len(
            {
                link.patient_id
                for link in db.scalars(
                    select(PatternPatient)
                    .join(RecurringPattern)
                    .where(RecurringPattern.is_active.is_(True))
                ).all()
            }
        ),
        new_patterns=sum(pattern.first_analysis_run_id == latest_run_id for pattern in patterns),
        top_importance_pattern=summary_item(patterns[0]) if patterns else None,
        top_financial_pattern=summary_item(
            max(patterns, key=lambda item: item.financial_significance)
        )
        if patterns
        else None,
        attention_patterns=[summary_item(pattern) for pattern in patterns[:5]],
        disclaimer=PATTERN_DISCLAIMER,
    )


def pattern_changes(db: Session) -> PatternChanges:
    run_ids = list(
        db.scalars(select(AnalysisRun.id).order_by(AnalysisRun.id.desc()).limit(2)).all()
    )
    if not run_ids:
        return PatternChanges(
            comparison_available=False,
            current_run_id=None,
            previous_run_id=None,
            new_patterns=0,
            recurring_patterns=0,
            disappeared_patterns=0,
            importance_increased=0,
            importance_decreased=0,
        )
    current_id = run_ids[0]
    if len(run_ids) < 2:
        return PatternChanges(
            comparison_available=False,
            current_run_id=current_id,
            previous_run_id=None,
            new_patterns=0,
            recurring_patterns=0,
            disappeared_patterns=0,
            importance_increased=0,
            importance_decreased=0,
        )
    previous_id = run_ids[1]
    current_rows = {
        row.pattern_id: row
        for row in db.scalars(
            select(PatternSnapshot).where(PatternSnapshot.analysis_run_id == current_id)
        ).all()
    }
    previous_rows = {
        row.pattern_id: row
        for row in db.scalars(
            select(PatternSnapshot).where(PatternSnapshot.analysis_run_id == previous_id)
        ).all()
    }
    shared = current_rows.keys() & previous_rows.keys()
    return PatternChanges(
        comparison_available=True,
        current_run_id=current_id,
        previous_run_id=previous_id,
        new_patterns=len(current_rows.keys() - previous_rows.keys()),
        recurring_patterns=len(shared),
        disappeared_patterns=len(previous_rows.keys() - current_rows.keys()),
        importance_increased=sum(
            current_rows[item].importance_score > previous_rows[item].importance_score
            for item in shared
        ),
        importance_decreased=sum(
            current_rows[item].importance_score < previous_rows[item].importance_score
            for item in shared
        ),
    )


def organization_patterns(db: Session, organization_id: int) -> list[PatternListItem]:
    patterns = list(
        db.scalars(
            select(RecurringPattern)
            .join(PatternOrganization)
            .where(
                PatternOrganization.organization_id == organization_id,
                RecurringPattern.is_active.is_(True),
            )
            .order_by(RecurringPattern.importance_score.desc())
        ).all()
    )
    main_organizations = _main_organizations(db, [pattern.id for pattern in patterns])
    return [
        _list_item_with_organization(pattern, main_organizations.get(pattern.id))
        for pattern in patterns
    ]


def signal_patterns(db: Session, signal_id: int) -> list[PatternListItem]:
    patterns = list(
        db.scalars(
            select(RecurringPattern)
            .join(PatternSignal)
            .where(PatternSignal.signal_id == signal_id, RecurringPattern.is_active.is_(True))
            .order_by(RecurringPattern.importance_score.desc())
        ).all()
    )
    main_organizations = _main_organizations(db, [pattern.id for pattern in patterns])
    return [
        _list_item_with_organization(pattern, main_organizations.get(pattern.id))
        for pattern in patterns
    ]
