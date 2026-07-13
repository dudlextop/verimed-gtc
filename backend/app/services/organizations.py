from collections import Counter
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    AnalysisRun,
    FinancialImpactSnapshot,
    MedicalOrganization,
    MedicalRecord,
    OrganizationComparisonSnapshot,
    OrganizationPrioritySnapshot,
    RiskSignal,
)
from app.schemas import (
    DistributionPoint,
    Finding,
    OrganizationDetail,
    OrganizationListItem,
    PaginatedOrganizations,
    PriorityHistoryPoint,
    ReviewItem,
    SignalListItem,
    TimelinePoint,
)
from app.services.risk import risk_level_for_score


def _priority_history(db: Session, organization_id: int) -> list[PriorityHistoryPoint]:
    rows = db.execute(
        select(OrganizationPrioritySnapshot, AnalysisRun)
        .join(AnalysisRun, AnalysisRun.id == OrganizationPrioritySnapshot.analysis_run_id)
        .where(OrganizationPrioritySnapshot.organization_id == organization_id)
        .order_by(OrganizationPrioritySnapshot.analysis_run_id)
    ).all()
    return [
        PriorityHistoryPoint(
            analysis_run_id=snapshot.analysis_run_id,
            period=run.completed_at.strftime("%d.%m %H:%M"),
            value=snapshot.score,
            level=snapshot.level,
            financial_significance=snapshot.financial_significance,
        )
        for snapshot, run in rows
    ]


def _latest_priority(db: Session, organization_id: int) -> OrganizationPrioritySnapshot | None:
    return db.scalar(
        select(OrganizationPrioritySnapshot)
        .where(OrganizationPrioritySnapshot.organization_id == organization_id)
        .order_by(OrganizationPrioritySnapshot.analysis_run_id.desc())
    )


def _organization_item(db: Session, org: MedicalOrganization) -> OrganizationListItem:
    total = sum((record.amount for record in org.records), Decimal("0"))
    reasons = Counter(signal.primary_reason for signal in org.signals)
    priority = _latest_priority(db, org.id)
    return OrganizationListItem(
        id=org.id,
        name=org.name,
        region=org.region,
        organization_type=org.organization_type,
        services_count=len(org.records),
        total_amount=total,
        signals_count=len(org.signals),
        risk_score=org.risk_score,
        risk_level=risk_level_for_score(org.risk_score),
        primary_reason=reasons.most_common(1)[0][0] if reasons else "Нет значимых отклонений",
        review_status=org.review_status,
        priority_score=priority.score if priority else None,
        priority_level=priority.level if priority else None,
        financial_significance=priority.financial_significance if priority else None,
        affected_patients=priority.affected_patients if priority else None,
        unreviewed_share=priority.unreviewed_share if priority else None,
        priority_factors=priority.factors if priority else [],
        priority_history=_priority_history(db, org.id),
    )


def list_organizations(
    db: Session,
    page: int,
    page_size: int,
    search: str | None,
    region: str | None,
    organization_type: str | None,
    risk_level: str | None,
    status: str | None,
    sort: str,
) -> PaginatedOrganizations:
    query = select(MedicalOrganization).options(
        selectinload(MedicalOrganization.records), selectinload(MedicalOrganization.signals)
    )
    count_query = select(func.count(MedicalOrganization.id))
    filters = []
    if search:
        filters.append(
            or_(
                MedicalOrganization.name.ilike(f"%{search}%"),
                MedicalOrganization.region.ilike(f"%{search}%"),
            )
        )
    if region:
        filters.append(MedicalOrganization.region == region)
    if organization_type:
        filters.append(MedicalOrganization.organization_type == organization_type)
    if status:
        filters.append(MedicalOrganization.review_status == status)
    thresholds = {
        "Низкий": (0, 34),
        "Средний": (35, 64),
        "Высокий": (65, 84),
        "Критический": (85, 100),
    }
    if risk_level in thresholds:
        low, high = thresholds[risk_level]
        filters.append(MedicalOrganization.risk_score.between(low, high))
    query = query.where(*filters)
    count_query = count_query.where(*filters)
    order = (
        MedicalOrganization.name.asc() if sort == "name" else MedicalOrganization.risk_score.desc()
    )
    orgs = db.scalars(query.order_by(order).offset((page - 1) * page_size).limit(page_size)).all()
    regions = list(
        db.scalars(
            select(MedicalOrganization.region).distinct().order_by(MedicalOrganization.region)
        ).all()
    )
    types = list(
        db.scalars(
            select(MedicalOrganization.organization_type)
            .distinct()
            .order_by(MedicalOrganization.organization_type)
        ).all()
    )
    return PaginatedOrganizations(
        items=[_organization_item(db, org) for org in orgs],
        total=db.scalar(count_query) or 0,
        page=page,
        page_size=page_size,
        regions=regions,
        organization_types=types,
    )


def get_organization(db: Session, organization_id: int) -> OrganizationDetail | None:
    org = db.scalar(
        select(MedicalOrganization)
        .where(MedicalOrganization.id == organization_id)
        .options(
            selectinload(MedicalOrganization.records).selectinload(MedicalRecord.service),
            selectinload(MedicalOrganization.signals)
            .selectinload(RiskSignal.record)
            .selectinload(MedicalRecord.patient),
            selectinload(MedicalOrganization.signals).selectinload(RiskSignal.reviews),
            selectinload(MedicalOrganization.signals).selectinload(RiskSignal.review_priority),
        )
    )
    if not org:
        return None
    item = _organization_item(db, org)
    category_counts = Counter(record.service.category for record in org.records)
    risk_counts = Counter(signal.level.value for signal in org.signals)
    signal_items = [
        _signal_item(signal)
        for signal in sorted(org.signals, key=lambda s: s.score, reverse=True)[:5]
    ]
    reviews = [
        ReviewItem.model_validate(review) for signal in org.signals for review in signal.reviews
    ]
    comparison_rows = list(
        db.scalars(
            select(OrganizationComparisonSnapshot)
            .where(OrganizationComparisonSnapshot.organization_id == organization_id)
            .order_by(
                OrganizationComparisonSnapshot.analysis_run_id.desc(),
                func.abs(OrganizationComparisonSnapshot.deviation_percent).desc(),
            )
            .limit(10)
        ).all()
    )
    financial = db.scalar(
        select(FinancialImpactSnapshot)
        .where(
            FinancialImpactSnapshot.scope_type == "organization",
            FinancialImpactSnapshot.scope_key == str(organization_id),
        )
        .order_by(FinancialImpactSnapshot.analysis_run_id.desc())
    )
    priority_rows = list(
        db.scalars(
            select(OrganizationPrioritySnapshot)
            .where(OrganizationPrioritySnapshot.organization_id == organization_id)
            .order_by(OrganizationPrioritySnapshot.analysis_run_id.desc())
            .limit(2)
        ).all()
    )
    financial_rows = list(
        db.scalars(
            select(FinancialImpactSnapshot)
            .where(
                FinancialImpactSnapshot.scope_type == "organization",
                FinancialImpactSnapshot.scope_key == str(organization_id),
            )
            .order_by(FinancialImpactSnapshot.analysis_run_id.desc())
            .limit(2)
        ).all()
    )
    timeline = _organization_timeline(db, organization_id)
    return OrganizationDetail(
        **item.model_dump(),
        comparison=(
            comparison_rows[0].explanation
            if comparison_rows
            else "Сравнение недоступно: недостаточно сопоставимых организаций."
        ),
        timeline=timeline,
        service_structure=[
            DistributionPoint(name=name, value=value)
            for name, value in category_counts.most_common()
        ],
        risk_distribution=[
            DistributionPoint(name=name, value=value) for name, value in risk_counts.items()
        ],
        deviations=[
            Finding(
                title=row.metric_label,
                description=row.explanation,
                severity="Высокая" if abs(row.deviation_percent) >= 50 else "Средняя",
            )
            for row in comparison_rows[:5]
        ],
        recent_signals=signal_items,
        review_history=sorted(reviews, key=lambda r: r.created_at, reverse=True)[:8],
        high_critical_amount=financial.high_critical_amount if financial else None,
        confirmed_amount=financial.confirmed_amount if financial else None,
        rejected_amount=financial.rejected_amount if financial else None,
        unreviewed_amount=financial.unreviewed_amount if financial else None,
        signal_amount_share=(
            round(float(financial.signal_services_amount / financial.total_services_amount), 4)
            if financial and financial.total_services_amount
            else None
        ),
        priority_change=(
            priority_rows[0].score - priority_rows[1].score if len(priority_rows) >= 2 else None
        ),
        financial_change=(
            financial_rows[0].signal_services_amount - financial_rows[1].signal_services_amount
            if len(financial_rows) >= 2
            else None
        ),
    )


def _organization_timeline(db: Session, organization_id: int) -> list[TimelinePoint]:
    dialect = db.bind.dialect.name if db.bind else "sqlite"
    month = (
        func.to_char(MedicalRecord.service_date, "YYYY-MM")
        if dialect == "postgresql"
        else func.strftime("%Y-%m", MedicalRecord.service_date)
    )
    rows = db.execute(
        select(
            month.label("month"),
            func.count(MedicalRecord.id),
            func.sum(MedicalRecord.amount),
            func.count(RiskSignal.id),
        )
        .outerjoin(RiskSignal, RiskSignal.medical_record_id == MedicalRecord.id)
        .where(MedicalRecord.organization_id == organization_id)
        .group_by(month)
        .order_by(month)
    ).all()
    return [
        TimelinePoint(period=value, services=count, amount=amount or 0, signals=signals)
        for value, count, amount, signals in rows
    ]


def _signal_item(signal: RiskSignal) -> SignalListItem:
    record = signal.record
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
        anomaly_type=signal.anomaly_type,
        status=signal.status,
        region=signal.organization.region,
        priority_score=signal.review_priority.score if signal.review_priority else None,
        priority_level=signal.review_priority.level if signal.review_priority else None,
        financial_significance=(
            signal.review_priority.financial_significance if signal.review_priority else None
        ),
        priority_factors=signal.review_priority.factors if signal.review_priority else [],
        priority_explanation=(
            signal.review_priority.explanation if signal.review_priority else None
        ),
    )
