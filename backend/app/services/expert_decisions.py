from __future__ import annotations

import hashlib
import json
from collections import Counter, defaultdict
from datetime import UTC, date, datetime, time
from typing import Any

from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    AnalysisRun,
    DecisionEntityType,
    DecisionJournalIntegrityCheck,
    ExpertDecisionEvent,
    ExpertFeedback,
    MedicalOrganization,
    PatternFingerprintHistory,
    PatternOrganization,
    PatternReviewStatus,
    RecurringPattern,
    ReviewStatus,
    RiskSignal,
    SignalFingerprintHistory,
    utc_now,
)
from app.schemas import (
    DecisionEventCreate,
    DecisionEventItem,
    DecisionHistory,
    DecisionJournalPage,
    ExpertReviewBreakdownItem,
    ExpertReviewSummary,
    IntegrityCheckResult,
    JournalFilterOption,
    JournalStringFilterOption,
    RecurrenceHistory,
    RecurrencePoint,
)
from app.synthetic.catalog import ANOMALY_LABELS

PATTERN_TYPE_LABELS = {
    "repeated_service": "Повторяющаяся услуга",
    "service_sequence": "Повторяющаяся последовательность услуг",
    "doctor_concentration": "Концентрация на враче",
    "service_concentration": "Концентрация на услуге",
    "recurring_spike": "Повторяющийся всплеск",
    "recurring_price_deviation": "Повторяющееся ценовое отклонение",
    "linked_patient_group": "Связанная группа пациентов",
    "cross_organization": "Межорганизационная модель",
}

SIGNAL_ACTIONS = {
    ReviewStatus.UNREVIEWED: "Добавлен комментарий",
    ReviewStatus.IN_PROGRESS: "Проверка начата",
    ReviewStatus.CONFIRMED: "Сигнал подтверждён",
    ReviewStatus.REJECTED: "Сигнал не подтверждён",
    ReviewStatus.NEEDS_INFO: "Требуются дополнительные сведения",
    ReviewStatus.ESCALATED: "Направлено на углублённую проверку",
    ReviewStatus.COMPLETED: "Проверка завершена",
}
PATTERN_ACTIONS = {
    PatternReviewStatus.UNREVIEWED: "Оценка модели начата",
    PatternReviewStatus.CONFIRMED: "Значимость модели подтверждена",
    PatternReviewStatus.INSIGNIFICANT: "Модель признана несущественной",
    PatternReviewStatus.NEEDS_INFO: "Требуются дополнительные сведения",
    PatternReviewStatus.ESCALATED: "Направлено на углублённую проверку",
    PatternReviewStatus.COMPLETED: "Оценка завершена",
}


def _canonical_hash_payload(event: ExpertDecisionEvent) -> dict[str, Any]:
    return {
        "entity_fingerprint": event.entity_fingerprint,
        "entity_type": event.entity_type.value,
        "action_type": event.action_type,
        "decision_status": event.decision_status,
        "reason_code": event.reason_code,
        "comment": event.comment,
        "reviewer_id": event.reviewer_id,
        "reviewer_display_name": event.reviewer_display_name,
        "created_at": event.created_at.isoformat(timespec="microseconds"),
        "previous_event_hash": event.previous_event_hash,
    }


def calculate_event_hash(event: ExpertDecisionEvent) -> str:
    canonical = json.dumps(
        _canonical_hash_payload(event), ensure_ascii=False, sort_keys=True, separators=(",", ":")
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def latest_event(
    db: Session, entity_type: DecisionEntityType, fingerprint: str
) -> ExpertDecisionEvent | None:
    return db.scalar(
        select(ExpertDecisionEvent)
        .where(
            ExpertDecisionEvent.entity_type == entity_type,
            ExpertDecisionEvent.entity_fingerprint == fingerprint,
        )
        .order_by(ExpertDecisionEvent.created_at.desc(), ExpertDecisionEvent.id.desc())
    )


def _signal_metadata(signal: RiskSignal) -> dict[str, str | int | float | bool | None]:
    priority = signal.review_priority
    return {
        "object_name": f"Сигнал по услуге «{signal.record.service.name}»",
        "organization_name": signal.organization.name,
        "organization_id": signal.organization_id,
        "signal_type": signal.anomaly_type,
        "service_name": signal.record.service.name,
        "risk_score": signal.score,
        "priority_score": priority.score if priority else None,
        "financial_significance": float(priority.financial_significance) if priority else None,
    }


def _pattern_metadata(
    db: Session, pattern: RecurringPattern
) -> dict[str, str | int | float | bool | None]:
    primary = db.execute(
        select(MedicalOrganization.id, MedicalOrganization.name)
        .join(PatternOrganization, PatternOrganization.organization_id == MedicalOrganization.id)
        .where(PatternOrganization.pattern_id == pattern.id)
        .order_by(PatternOrganization.is_primary.desc(), PatternOrganization.signal_count.desc())
        .limit(1)
    ).first()
    return {
        "object_name": pattern.name,
        "organization_name": primary[1] if primary else None,
        "organization_id": primary[0] if primary else None,
        "pattern_type": pattern.pattern_type,
        "stability_score": pattern.stability_score,
        "importance_score": pattern.importance_score,
        "financial_significance": float(pattern.financial_significance),
        "signal_count": pattern.signal_count,
    }


def _add_feedback(event: ExpertDecisionEvent, payload: DecisionEventCreate) -> None:
    if payload.feedback is None:
        return
    event.feedback = ExpertFeedback(**payload.feedback.model_dump())


def _create_event(
    db: Session,
    entity_type: DecisionEntityType,
    fingerprint: str,
    current_entity_id: int,
    analysis_run_id: int | None,
    organization_id: int | None,
    payload: DecisionEventCreate,
    metadata: dict[str, str | int | float | bool | None],
) -> ExpertDecisionEvent:
    previous = latest_event(db, entity_type, fingerprint)
    if payload.supersedes_event_id is not None:
        superseded = db.get(ExpertDecisionEvent, payload.supersedes_event_id)
        if (
            superseded is None
            or superseded.entity_type != entity_type
            or superseded.entity_fingerprint != fingerprint
        ):
            raise ValueError("Уточняемое решение не относится к выбранному объекту")
    created_at = datetime.now(UTC).replace(tzinfo=None)
    event = ExpertDecisionEvent(
        entity_type=entity_type,
        entity_fingerprint=fingerprint,
        current_entity_id=current_entity_id,
        analysis_run_id=analysis_run_id,
        medical_organization_id=organization_id,
        action_type=payload.action_type,
        decision_status=payload.decision_status,
        reason_code=payload.reason_code,
        comment=payload.comment.strip(),
        reviewer_id=payload.reviewer_id,
        reviewer_display_name=payload.reviewer_display_name,
        created_at=created_at,
        supersedes_event_id=payload.supersedes_event_id,
        metadata_json=metadata,
        previous_event_hash=previous.event_hash if previous else None,
        event_hash="",
    )
    event.event_hash = calculate_event_hash(event)
    _add_feedback(event, payload)
    db.add(event)
    db.flush()
    return event


def add_signal_event(
    db: Session, signal: RiskSignal, payload: DecisionEventCreate
) -> ExpertDecisionEvent:
    if not signal.fingerprint:
        raise ValueError("Для сигнала ещё не рассчитан устойчивый идентификатор")
    event = _create_event(
        db,
        DecisionEntityType.SIGNAL,
        signal.fingerprint,
        signal.id,
        signal.analysis_run_id,
        signal.organization_id,
        payload,
        _signal_metadata(signal),
    )
    signal.status = ReviewStatus(payload.decision_status)
    return event


def add_pattern_event(
    db: Session, pattern: RecurringPattern, payload: DecisionEventCreate
) -> ExpertDecisionEvent:
    metadata = _pattern_metadata(db, pattern)
    event = _create_event(
        db,
        DecisionEntityType.PATTERN,
        pattern.fingerprint,
        pattern.id,
        pattern.last_analysis_run_id,
        int(metadata["organization_id"]) if metadata["organization_id"] else None,
        payload,
        metadata,
    )
    pattern.review_status = PatternReviewStatus(payload.decision_status)
    return event


def legacy_signal_payload(
    status: ReviewStatus, comment: str, reviewer_name: str, reason_code: str
) -> DecisionEventCreate:
    return DecisionEventCreate(
        action_type=SIGNAL_ACTIONS[status],
        decision_status=status.value,
        reason_code=reason_code,
        comment=comment,
        reviewer_display_name=reviewer_name,
    )


def legacy_pattern_payload(
    status: PatternReviewStatus, comment: str, reviewer_name: str, reason_code: str
) -> DecisionEventCreate:
    return DecisionEventCreate(
        action_type=PATTERN_ACTIONS[status],
        decision_status=status.value,
        reason_code=reason_code,
        comment=comment,
        reviewer_display_name=reviewer_name,
    )


def restore_signal_status(db: Session, signal: RiskSignal) -> None:
    if signal.fingerprint:
        event = latest_event(db, DecisionEntityType.SIGNAL, signal.fingerprint)
        if event is not None:
            signal.status = ReviewStatus(event.decision_status)


def restore_pattern_status(db: Session, pattern: RecurringPattern) -> None:
    event = latest_event(db, DecisionEntityType.PATTERN, pattern.fingerprint)
    if event is not None:
        pattern.review_status = PatternReviewStatus(event.decision_status)


def _event_item(db: Session, event: ExpertDecisionEvent) -> DecisionEventItem:
    current_id: int | None = None
    if event.entity_type == DecisionEntityType.SIGNAL:
        current_id = db.scalar(
            select(RiskSignal.id)
            .where(RiskSignal.fingerprint == event.entity_fingerprint)
            .order_by(RiskSignal.analysis_run_id.desc(), RiskSignal.id.desc())
        )
    else:
        current_id = db.scalar(
            select(RecurringPattern.id)
            .where(
                RecurringPattern.fingerprint == event.entity_fingerprint,
                RecurringPattern.is_active.is_(True),
            )
            .order_by(RecurringPattern.last_analysis_run_id.desc())
        )
    return DecisionEventItem(
        id=event.id,
        entity_type=event.entity_type,
        entity_fingerprint=event.entity_fingerprint,
        current_entity_id=current_id,
        object_present=current_id is not None,
        analysis_run_id=event.analysis_run_id,
        medical_organization_id=event.medical_organization_id,
        action_type=event.action_type,
        decision_status=event.decision_status,
        reason_code=event.reason_code,
        comment=event.comment,
        reviewer_display_name=event.reviewer_display_name,
        created_at=event.created_at,
        supersedes_event_id=event.supersedes_event_id,
        metadata=event.metadata_json,
        feedback=event.feedback,
    )


def decision_history(
    db: Session, entity_type: DecisionEntityType, fingerprint: str
) -> DecisionHistory:
    events = list(
        db.scalars(
            select(ExpertDecisionEvent)
            .where(
                ExpertDecisionEvent.entity_type == entity_type,
                ExpertDecisionEvent.entity_fingerprint == fingerprint,
            )
            .options(selectinload(ExpertDecisionEvent.feedback))
            .order_by(ExpertDecisionEvent.created_at, ExpertDecisionEvent.id)
        ).all()
    )
    return DecisionHistory(
        entity_type=entity_type,
        entity_fingerprint=fingerprint,
        current_status=events[-1].decision_status if events else None,
        history_found=bool(events),
        events=[_event_item(db, event) for event in events],
    )


def list_journal(
    db: Session,
    page: int,
    page_size: int,
    search: str | None = None,
    entity_type: str | None = None,
    action_type: str | None = None,
    decision_status: str | None = None,
    reviewer: str | None = None,
    organization_id: int | None = None,
    analysis_run_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    object_type: str | None = None,
) -> DecisionJournalPage:
    query = select(ExpertDecisionEvent).options(selectinload(ExpertDecisionEvent.feedback))
    filters: list[ColumnElement[bool]] = []
    if search:
        filters.append(ExpertDecisionEvent.comment.ilike(f"%{search}%"))
    if entity_type:
        filters.append(ExpertDecisionEvent.entity_type == entity_type)
    if action_type:
        filters.append(ExpertDecisionEvent.action_type == action_type)
    if decision_status:
        filters.append(ExpertDecisionEvent.decision_status == decision_status)
    if reviewer:
        filters.append(ExpertDecisionEvent.reviewer_display_name == reviewer)
    if organization_id:
        filters.append(ExpertDecisionEvent.medical_organization_id == organization_id)
    if analysis_run_id:
        filters.append(ExpertDecisionEvent.analysis_run_id == analysis_run_id)
    if date_from:
        filters.append(ExpertDecisionEvent.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        filters.append(ExpertDecisionEvent.created_at <= datetime.combine(date_to, time.max))
    if object_type:
        filters.append(
            or_(
                ExpertDecisionEvent.metadata_json["signal_type"].as_string() == object_type,
                ExpertDecisionEvent.metadata_json["pattern_type"].as_string() == object_type,
            )
        )
    query = query.where(*filters)
    total = db.scalar(select(func.count(ExpertDecisionEvent.id)).where(*filters)) or 0
    events = list(
        db.scalars(
            query.order_by(ExpertDecisionEvent.created_at.desc(), ExpertDecisionEvent.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    return DecisionJournalPage(
        items=[_event_item(db, event) for event in events],
        total=total,
        page=page,
        page_size=page_size,
        reviewers=list(
            db.scalars(
                select(ExpertDecisionEvent.reviewer_display_name)
                .distinct()
                .order_by(ExpertDecisionEvent.reviewer_display_name)
            ).all()
        ),
        actions=list(
            db.scalars(
                select(ExpertDecisionEvent.action_type)
                .distinct()
                .order_by(ExpertDecisionEvent.action_type)
            ).all()
        ),
        decision_statuses=list(
            db.scalars(
                select(ExpertDecisionEvent.decision_status).distinct().order_by(
                    ExpertDecisionEvent.decision_status
                )
            ).all()
        ),
        organizations=[
            JournalFilterOption(id=item_id, label=label)
            for item_id, label in db.execute(
                select(MedicalOrganization.id, MedicalOrganization.name)
                .join(
                    ExpertDecisionEvent,
                    ExpertDecisionEvent.medical_organization_id == MedicalOrganization.id,
                )
                .distinct()
                .order_by(MedicalOrganization.name)
            ).all()
        ],
        object_types=[
            JournalStringFilterOption(
                value=value,
                label=ANOMALY_LABELS.get(value, PATTERN_TYPE_LABELS.get(value, value)),
            )
            for value in sorted(
                {
                    str(value)
                    for event in db.scalars(select(ExpertDecisionEvent)).all()
                    for value in [
                        event.metadata_json.get("signal_type"),
                        event.metadata_json.get("pattern_type"),
                    ]
                    if value
                }
            )
        ],
        analysis_runs=[
            item
            for item in db.scalars(
                select(ExpertDecisionEvent.analysis_run_id)
                .where(ExpertDecisionEvent.analysis_run_id.is_not(None))
                .distinct()
                .order_by(ExpertDecisionEvent.analysis_run_id.desc())
            ).all()
            if item is not None
        ],
    )


def verify_integrity(db: Session, persist: bool = True) -> IntegrityCheckResult:
    events = list(db.scalars(select(ExpertDecisionEvent).order_by(ExpertDecisionEvent.id)).all())
    previous_by_chain: dict[tuple[str, str], str | None] = {}
    mismatches: list[str] = []
    for event in events:
        key = (event.entity_type.value, event.entity_fingerprint)
        expected_previous = previous_by_chain.get(key)
        if event.previous_event_hash != expected_previous:
            mismatches.append(f"Событие {event.id}: нарушена связь с предыдущим событием")
        if event.event_hash != calculate_event_hash(event):
            mismatches.append(f"Событие {event.id}: содержимое не соответствует контрольной сумме")
        previous_by_chain[key] = event.event_hash
    checked_at = utc_now()
    result = IntegrityCheckResult(
        is_valid=not mismatches,
        checked_events=len(events),
        mismatch_count=len(mismatches),
        details=mismatches,
        checked_at=checked_at,
        message=(
            "Целостность истории проверена"
            if not mismatches
            else "Обнаружено несоответствие в истории решений"
        ),
    )
    if persist:
        db.add(
            DecisionJournalIntegrityCheck(
                is_valid=result.is_valid,
                checked_events=result.checked_events,
                mismatch_count=result.mismatch_count,
                details=result.details,
                checked_at=result.checked_at,
            )
        )
        db.commit()
    return result


def signal_recurrence(db: Session, fingerprint: str) -> RecurrenceHistory:
    points = list(
        db.scalars(
            select(SignalFingerprintHistory)
            .where(SignalFingerprintHistory.entity_fingerprint == fingerprint)
            .order_by(SignalFingerprintHistory.analysis_run_id)
        ).all()
    )
    runs = list(db.scalars(select(AnalysisRun).order_by(AnalysisRun.id)).all())
    appeared = {point.analysis_run_id for point in points}
    last = latest_event(db, DecisionEntityType.SIGNAL, fingerprint)
    return RecurrenceHistory(
        entity_fingerprint=fingerprint,
        first_detected_at=points[0].appeared_at if points else None,
        last_detected_at=points[-1].appeared_at if points else None,
        appeared_runs=len(points),
        absent_runs=sum(1 for run in runs if run.id not in appeared),
        last_expert_status=last.decision_status if last else None,
        points=[
            RecurrencePoint(
                analysis_run_id=item.analysis_run_id,
                appeared_at=item.appeared_at,
                risk_score=item.risk_score,
                priority_score=item.priority_score,
                financial_significance=item.financial_significance,
                status=item.status_at_run,
            )
            for item in points
        ],
    )


def pattern_recurrence(db: Session, fingerprint: str) -> RecurrenceHistory:
    points = list(
        db.scalars(
            select(PatternFingerprintHistory)
            .where(PatternFingerprintHistory.entity_fingerprint == fingerprint)
            .order_by(PatternFingerprintHistory.analysis_run_id)
        ).all()
    )
    runs = list(db.scalars(select(AnalysisRun).order_by(AnalysisRun.id)).all())
    appeared = {point.analysis_run_id for point in points}
    last = latest_event(db, DecisionEntityType.PATTERN, fingerprint)
    return RecurrenceHistory(
        entity_fingerprint=fingerprint,
        first_detected_at=points[0].appeared_at if points else None,
        last_detected_at=points[-1].appeared_at if points else None,
        appeared_runs=len(points),
        absent_runs=sum(1 for run in runs if run.id not in appeared),
        last_expert_status=last.decision_status if last else None,
        points=[
            RecurrencePoint(
                analysis_run_id=item.analysis_run_id,
                appeared_at=item.appeared_at,
                stability_score=item.stability_score,
                importance_score=item.importance_score,
                financial_significance=item.financial_significance,
                signal_count=item.signal_count,
                status=item.status_at_run,
                participant_signature=item.participant_signature,
            )
            for item in points
        ],
    )


def _terminal_events(db: Session, entity_type: DecisionEntityType) -> list[ExpertDecisionEvent]:
    events = list(
        db.scalars(
            select(ExpertDecisionEvent)
            .where(ExpertDecisionEvent.entity_type == entity_type)
            .options(selectinload(ExpertDecisionEvent.feedback))
            .order_by(ExpertDecisionEvent.entity_fingerprint, ExpertDecisionEvent.id)
        ).all()
    )
    latest: dict[str, ExpertDecisionEvent] = {}
    for event in events:
        latest[event.entity_fingerprint] = event
    return list(latest.values())


def expert_review_summary(db: Session) -> ExpertReviewSummary:
    signals = _terminal_events(db, DecisionEntityType.SIGNAL)
    patterns = _terminal_events(db, DecisionEntityType.PATTERN)
    signal_statuses = Counter(item.decision_status for item in signals)
    feedback = [item.feedback for item in [*signals, *patterns] if item.feedback]
    reviewed_signals = len(signals)
    reviewed_patterns = len(patterns)
    enough = reviewed_signals >= 5
    confirmed = signal_statuses[ReviewStatus.CONFIRMED.value]
    rejected = signal_statuses[ReviewStatus.REJECTED.value]
    escalated = signal_statuses[ReviewStatus.ESCALATED.value]
    first_decisions: dict[str, ExpertDecisionEvent] = {}
    completed: dict[str, ExpertDecisionEvent] = {}
    all_events = list(db.scalars(select(ExpertDecisionEvent)).all())
    for event in sorted(all_events, key=lambda item: (item.created_at, item.id)):
        first_decisions.setdefault(event.entity_fingerprint, event)
        if event.decision_status in {
            ReviewStatus.COMPLETED.value,
            PatternReviewStatus.COMPLETED.value,
        }:
            completed[event.entity_fingerprint] = event
    formation = {
        item.entity_fingerprint: item.appeared_at
        for item in db.scalars(select(SignalFingerprintHistory)).all()
    }
    first_hours = [
        max(0.0, (event.created_at - formation[fp]).total_seconds() / 3600)
        for fp, event in first_decisions.items()
        if fp in formation
    ]
    completion_hours = [
        max(0.0, (event.created_at - first_decisions[fp].created_at).total_seconds() / 3600)
        for fp, event in completed.items()
        if fp in first_decisions
    ]
    usefulness = Counter(item.usefulness for item in feedback if item and item.usefulness)
    explanation = Counter(
        item.explanation_quality for item in feedback if item and item.explanation_quality
    )
    priority = Counter(
        item.priority_correctness for item in feedback if item and item.priority_correctness
    )
    return ExpertReviewSummary(
        reviewed_signals=reviewed_signals,
        reviewed_patterns=reviewed_patterns,
        confirmed_share=confirmed / reviewed_signals if enough else None,
        rejected_share=rejected / reviewed_signals if enough else None,
        escalated_share=escalated / reviewed_signals if enough else None,
        average_first_decision_hours=(sum(first_hours) / len(first_hours) if first_hours else None),
        average_completion_hours=(
            sum(completion_hours) / len(completion_hours) if completion_hours else None
        ),
        signals_without_decision=(
            db.scalar(
                select(func.count(RiskSignal.id)).where(
                    RiskSignal.status == ReviewStatus.UNREVIEWED
                )
            )
            or 0
        ),
        patterns_without_decision=(
            db.scalar(
                select(func.count(RecurringPattern.id)).where(
                    RecurringPattern.is_active.is_(True),
                    RecurringPattern.review_status == PatternReviewStatus.UNREVIEWED,
                )
            )
            or 0
        ),
        in_progress=signal_statuses[ReviewStatus.IN_PROGRESS.value],
        completed_current_period=sum(
            1 for item in signals if item.decision_status == ReviewStatus.COMPLETED.value
        ),
        sample_sufficient=enough,
        sample_message=(
            None
            if enough
            else "Недостаточно завершённых проверок для расчёта устойчивой доли подтверждения."
        ),
        usefulness_distribution=dict(usefulness),
        explanation_quality_distribution=dict(explanation),
        priority_correctness_distribution=dict(priority),
    )


def expert_review_breakdown(
    db: Session, entity_type: DecisionEntityType, metadata_key: str
) -> list[ExpertReviewBreakdownItem]:
    events = _terminal_events(db, entity_type)
    groups: dict[str, list[ExpertDecisionEvent]] = defaultdict(list)
    for event in events:
        key = str(event.metadata_json.get(metadata_key) or "Не указан")
        groups[key].append(event)
    return [
        ExpertReviewBreakdownItem(
            category=category,
            total=len(items),
            confirmed=sum(
                item.decision_status
                in {ReviewStatus.CONFIRMED.value, PatternReviewStatus.CONFIRMED.value}
                for item in items
            ),
            rejected=sum(
                item.decision_status
                in {ReviewStatus.REJECTED.value, PatternReviewStatus.INSIGNIFICANT.value}
                for item in items
            ),
            escalated=sum(item.decision_status == ReviewStatus.ESCALATED.value for item in items),
        )
        for category, items in sorted(groups.items())
    ]
