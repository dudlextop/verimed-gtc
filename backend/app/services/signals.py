from datetime import timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    DecisionEntityType,
    MedicalOrganization,
    MedicalRecord,
    ReviewPriority,
    ReviewStatus,
    RiskSignal,
)
from app.schemas import (
    PaginatedSignals,
    RelatedService,
    ReviewCreate,
    ReviewItem,
    RiskFactorItem,
    SignalDetail,
    SignalListItem,
)
from app.services.expert_decisions import (
    add_signal_event,
    decision_history,
    legacy_signal_payload,
)
from app.services.financial_priority import refresh_signal_priority
from app.synthetic.catalog import ANOMALY_LABELS

SIGNAL_OPTIONS = (
    selectinload(RiskSignal.organization),
    selectinload(RiskSignal.record).selectinload(MedicalRecord.patient),
    selectinload(RiskSignal.record).selectinload(MedicalRecord.service),
    selectinload(RiskSignal.review_priority),
)


def to_list_item(signal: RiskSignal) -> SignalListItem:
    record = signal.record
    priority = signal.review_priority
    return SignalListItem(
        id=signal.id,
        date=record.service_date,
        organization_id=signal.organization_id,
        organization_name=signal.organization.name,
        patient_code=record.patient.anonymous_code,
        service_name=record.service.name,
        amount=record.amount,
        score=signal.score,
        level=signal.level,
        primary_reason=signal.primary_reason,
        anomaly_type=ANOMALY_LABELS.get(signal.anomaly_type, signal.anomaly_type),
        status=signal.status,
        region=signal.organization.region,
        priority_score=priority.score if priority else None,
        priority_level=priority.level if priority else None,
        financial_significance=priority.financial_significance if priority else None,
        priority_factors=priority.factors if priority else [],
        priority_explanation=priority.explanation if priority else None,
        fingerprint=signal.fingerprint,
    )


def list_signals(
    db: Session,
    page: int,
    page_size: int,
    level: str | None,
    organization_id: int | None,
    region: str | None,
    anomaly_type: str | None,
    status: str | None,
    sort: str,
    levels: list[str] | None = None,
    priority_level: str | None = None,
    financial_min: Decimal | None = None,
    financial_max: Decimal | None = None,
    has_decision: bool | None = None,
    period_months: int | None = None,
) -> PaginatedSignals:
    query = select(RiskSignal).outerjoin(ReviewPriority).options(*SIGNAL_OPTIONS)
    count_query = (
        select(func.count(RiskSignal.id)).join(MedicalOrganization).outerjoin(ReviewPriority)
    )
    filters = []
    if level:
        filters.append(RiskSignal.level == level)
    if levels:
        filters.append(RiskSignal.level.in_(levels))
    if organization_id:
        filters.append(RiskSignal.organization_id == organization_id)
    if region:
        filters.append(MedicalOrganization.region == region)
    if anomaly_type:
        technical_type = next(
            (key for key, label in ANOMALY_LABELS.items() if label == anomaly_type), anomaly_type
        )
        filters.append(RiskSignal.anomaly_type == technical_type)
    if status:
        filters.append(RiskSignal.status == status)
    if priority_level:
        filters.append(ReviewPriority.level == priority_level)
    if financial_min is not None:
        filters.append(ReviewPriority.financial_significance >= financial_min)
    if financial_max is not None:
        filters.append(ReviewPriority.financial_significance <= financial_max)
    if has_decision is True:
        filters.append(RiskSignal.status != ReviewStatus.UNREVIEWED)
    elif has_decision is False:
        filters.append(RiskSignal.status == ReviewStatus.UNREVIEWED)
    if period_months is not None:
        latest_record_date = db.scalar(select(func.max(MedicalRecord.service_date)))
        if latest_record_date is not None:
            filters.append(
                MedicalRecord.service_date
                >= latest_record_date - timedelta(days=period_months * 30)
            )
        query = query.join(MedicalRecord, RiskSignal.medical_record_id == MedicalRecord.id)
        count_query = count_query.join(
            MedicalRecord, RiskSignal.medical_record_id == MedicalRecord.id
        )
    if region:
        query = query.join(MedicalOrganization)
    query = query.where(*filters)
    count_query = count_query.where(*filters)
    if sort == "date":
        query = query.order_by(RiskSignal.created_at.desc())
    elif sort in {"risk", "score"}:
        query = query.order_by(RiskSignal.score.desc())
    elif sort == "financial":
        query = query.order_by(ReviewPriority.financial_significance.desc())
    elif sort == "organization":
        query = query.order_by(MedicalOrganization.name.asc())
    else:
        query = query.order_by(ReviewPriority.score.desc())
    if sort == "organization" and not region:
        query = query.join(MedicalOrganization)
    signals = db.scalars(query.offset((page - 1) * page_size).limit(page_size)).all()
    anomaly_types = [
        ANOMALY_LABELS.get(item, item)
        for item in db.scalars(
            select(RiskSignal.anomaly_type).distinct().order_by(RiskSignal.anomaly_type)
        ).all()
    ]
    return PaginatedSignals(
        items=[to_list_item(signal) for signal in signals],
        total=db.scalar(count_query) or 0,
        page=page,
        page_size=page_size,
        anomaly_types=anomaly_types,
    )


def get_signal(db: Session, signal_id: int) -> SignalDetail | None:
    signal = db.scalar(
        select(RiskSignal)
        .where(RiskSignal.id == signal_id)
        .options(
            *SIGNAL_OPTIONS, selectinload(RiskSignal.factors), selectinload(RiskSignal.reviews)
        )
    )
    if not signal:
        return None
    record = signal.record
    related_query = select(MedicalRecord)
    if signal.related_record_ids:
        related_query = related_query.where(MedicalRecord.id.in_(signal.related_record_ids))
    else:
        related_query = related_query.where(
            MedicalRecord.patient_id == record.patient_id,
            MedicalRecord.service_date.between(
                record.service_date - timedelta(days=14), record.service_date + timedelta(days=14)
            ),
        )
    related = db.scalars(
        related_query.options(
            selectinload(MedicalRecord.service), selectinload(MedicalRecord.organization)
        ).order_by(MedicalRecord.service_date, MedicalRecord.service_time)
    ).all()
    related_signal_ids = {
        medical_record_id: signal_id
        for medical_record_id, signal_id in db.execute(
            select(RiskSignal.medical_record_id, RiskSignal.id).where(
                RiskSignal.medical_record_id.in_([item.id for item in related])
            )
        ).all()
    }
    return SignalDetail(
        **to_list_item(signal).model_dump(),
        organization_type=signal.organization.organization_type,
        rule_score=signal.rule_score,
        organization_score=signal.organization_score,
        financial_score=signal.financial_score,
        factors=[RiskFactorItem.model_validate(item) for item in signal.factors],
        related_services=[
            RelatedService(
                record_id=item.id,
                date=item.service_date,
                time=item.service_time.strftime("%H:%M"),
                name=item.service.name,
                amount=item.amount,
                organization_name=item.organization.name,
                related_signal_id=related_signal_ids.get(item.id),
                relationship_explanation=(
                    "Запись связана с фактором, сформировавшим текущий сигнал."
                    if item.id in signal.related_record_ids
                    else "Услуга оказана тому же пациенту в близкий период."
                ),
            )
            for item in related[:8]
        ],
        reviews=[
            ReviewItem(
                id=item.id,
                status=ReviewStatus(item.decision_status),
                comment=item.comment,
                reviewer_name=item.reviewer_display_name,
                created_at=item.created_at,
            )
            for item in reversed(
                decision_history(db, DecisionEntityType.SIGNAL, signal.fingerprint or "").events
            )
        ],
        limitations=signal.limitations,
        recommendation=signal.recommendation,
        repetition_count=(
            signal.review_priority.repetition_count if signal.review_priority else None
        ),
        affected_patients=(
            signal.review_priority.affected_patients if signal.review_priority else None
        ),
        duration_days=(signal.review_priority.duration_days if signal.review_priority else None),
    )


def review_signal(db: Session, signal_id: int, payload: ReviewCreate) -> SignalDetail | None:
    signal = db.get(RiskSignal, signal_id)
    if not signal:
        return None
    default_reasons = {
        ReviewStatus.CONFIRMED: "данные подтверждают отклонение",
        ReviewStatus.REJECTED: "медицински обоснованная услуга",
        ReviewStatus.ESCALATED: "требуется дополнительная выборка данных",
        ReviewStatus.NEEDS_INFO: "требуется запрос документов",
        ReviewStatus.IN_PROGRESS: "требуется клиническая экспертиза",
        ReviewStatus.COMPLETED: "данные подтверждают отклонение",
    }
    reason_code = (
        default_reasons[payload.status]
        if payload.reason_code == "иная причина" and not payload.comment.strip()
        else payload.reason_code
    )
    add_signal_event(
        db,
        signal,
        legacy_signal_payload(
            payload.status, payload.comment, payload.reviewer_name, reason_code
        ).model_copy(
            update={
                "reviewer_id": payload.reviewer_id,
                "supersedes_event_id": payload.supersedes_event_id,
                "feedback": payload.feedback,
                "action_type": (
                    "Решение уточнено"
                    if payload.supersedes_event_id is not None
                    else legacy_signal_payload(
                        payload.status, payload.comment, payload.reviewer_name, reason_code
                    ).action_type
                ),
            }
        ),
    )
    if payload.status == ReviewStatus.IN_PROGRESS:
        signal.organization.review_status = ReviewStatus.IN_PROGRESS
    db.flush()
    db.refresh(signal, attribute_names=["review_priority"])
    refresh_signal_priority(db, signal)
    db.commit()
    return get_signal(db, signal_id)
