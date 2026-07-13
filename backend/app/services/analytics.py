from collections import Counter
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    AnalysisRun,
    FinancialImpactSnapshot,
    MedicalOrganization,
    MedicalRecord,
    ReviewStatus,
    RiskLevel,
    RiskSignal,
    utc_now,
)
from app.schemas import (
    AnalysisInfo,
    AnalyticsChanges,
    AnalyticsSummary,
    CommandCenter,
    DistributionPoint,
    Finding,
    Metric,
    PriorityInfo,
    TimelinePoint,
)
from app.services.financial_priority import (
    get_financial_impact_summary,
    get_priority_summary,
)
from app.synthetic.catalog import ANOMALY_LABELS


def _change(
    current: int | float | Decimal, previous: int | float | Decimal | None
) -> tuple[float, str]:
    if previous is None:
        return 0.0, "unavailable"
    current_value = float(current)
    previous_value = float(previous)
    if current_value == previous_value:
        return 0.0, "neutral"
    if previous_value == 0:
        return 100.0, "up" if current_value > 0 else "down"
    value = round((current_value - previous_value) / abs(previous_value) * 100, 1)
    return value, "up" if value > 0 else "down"


def _period_financial_snapshot(db: Session, run_id: int | None) -> FinancialImpactSnapshot | None:
    if run_id is None:
        return None
    return db.scalar(
        select(FinancialImpactSnapshot).where(
            FinancialImpactSnapshot.analysis_run_id == run_id,
            FinancialImpactSnapshot.scope_type == "period",
            FinancialImpactSnapshot.scope_key == "all",
        )
    )


def get_summary(db: Session) -> AnalyticsSummary:
    runs = list(
        db.scalars(select(AnalysisRun).order_by(AnalysisRun.completed_at.desc()).limit(2)).all()
    )
    run = runs[0] if runs else None
    previous = runs[1] if len(runs) > 1 else None
    organizations = db.scalar(select(func.count(MedicalOrganization.id))) or 0
    records = db.scalar(select(func.count(MedicalRecord.id))) or 0
    total_amount = db.scalar(select(func.sum(MedicalRecord.amount))) or Decimal("0")
    high_filter = RiskSignal.level.in_([RiskLevel.HIGH, RiskLevel.CRITICAL])
    high_count = db.scalar(select(func.count(RiskSignal.id)).where(high_filter)) or 0
    fallback_review_amount = db.scalar(
        select(func.sum(MedicalRecord.amount)).join(RiskSignal).where(high_filter)
    ) or Decimal("0")
    current_financial = _period_financial_snapshot(db, run.id if run else None)
    previous_financial = _period_financial_snapshot(db, previous.id if previous else None)
    review_amount = (
        current_financial.signal_services_amount if current_financial else fallback_review_amount
    )
    high_critical_amount = (
        current_financial.high_critical_amount if current_financial else fallback_review_amount
    )
    risky_orgs = (
        db.scalar(
            select(func.count(MedicalOrganization.id)).where(MedicalOrganization.risk_score >= 60)
        )
        or 0
    )
    top = db.scalar(select(MedicalOrganization).order_by(MedicalOrganization.risk_score.desc()))
    now = utc_now()
    analysis = AnalysisInfo(
        period=f"{run.period_start:%d.%m.%Y} — {run.period_end:%d.%m.%Y}" if run else "—",
        organizations_count=organizations,
        records_count=records,
        last_analysis_at=run.completed_at if run else now,
        processing_status=run.status if run else "Ожидает загрузки данных",
    )
    priority = PriorityInfo(
        high_risk_signals=high_count,
        review_amount=high_critical_amount,
        top_organization_id=top.id if top else 0,
        top_organization=top.name if top else "Нет данных",
    )
    records_change = _change(records, previous.records_processed if previous else None)
    total_amount_change = _change(
        total_amount,
        previous_financial.total_services_amount if previous_financial else None,
    )
    high_count_change = _change(
        high_count,
        len(previous.high_risk_record_ids) if previous else None,
    )
    risky_orgs_change = _change(
        risky_orgs,
        (
            sum(score >= 60 for score in previous.organization_risk_scores.values())
            if previous
            else None
        ),
    )
    review_amount_change = _change(
        review_amount,
        previous_financial.signal_services_amount if previous_financial else None,
    )
    metrics = [
        Metric(
            label="Всего медицинских услуг",
            value=records,
            change_percent=records_change[0],
            explanation="Обработано за текущий период",
            trend=records_change[1],
        ),
        Metric(
            label="Общая сумма предъявленных услуг",
            value=float(total_amount),
            change_percent=total_amount_change[0],
            explanation="Сумма по всем организациям",
            trend=total_amount_change[1],
        ),
        Metric(
            label="Сигналы высокого риска",
            value=high_count,
            change_percent=high_count_change[0],
            explanation="Высокий и критический уровни",
            trend=high_count_change[1],
        ),
        Metric(
            label="Организации с повышенным риском",
            value=risky_orgs,
            change_percent=risky_orgs_change[0],
            explanation="Оценка риска от 60 баллов",
            trend=risky_orgs_change[1],
        ),
        Metric(
            label="Сумма услуг, рекомендованных к проверке",
            value=float(review_amount),
            change_percent=review_amount_change[0],
            explanation="По приоритетным сигналам",
            trend=review_amount_change[1],
        ),
    ]
    return AnalyticsSummary(analysis=analysis, priority=priority, metrics=metrics)


def get_command_center(db: Session) -> CommandCenter:
    runs = list(
        db.scalars(select(AnalysisRun).order_by(AnalysisRun.completed_at.desc()).limit(2)).all()
    )
    current = runs[0] if runs else None
    previous = runs[1] if len(runs) > 1 else None
    comparison_available = previous is not None and bool(previous.signal_record_ids)
    current_high_ids = set(current.high_risk_record_ids if current else [])
    previous_high_ids = set(previous.high_risk_record_ids if previous else [])
    new_high = (
        len(current_high_ids - previous_high_ids) if comparison_available else len(current_high_ids)
    )
    unreviewed = (
        db.scalar(
            select(func.count(RiskSignal.id)).where(RiskSignal.status == ReviewStatus.UNREVIEWED)
        )
        or 0
    )
    risky_orgs = (
        db.scalar(
            select(func.count(MedicalOrganization.id)).where(MedicalOrganization.risk_score >= 60)
        )
        or 0
    )
    priority_summary = get_priority_summary(db)
    financial_summary = get_financial_impact_summary(db)
    period_financial = financial_summary.period
    review_amount = period_financial.high_critical_amount if period_financial else Decimal("0")
    return CommandCenter(
        new_high_critical_signals=new_high,
        high_risk_organizations=risky_orgs,
        review_amount=review_amount,
        signals_without_decision=unreviewed,
        last_analysis_at=current.completed_at if current else None,
        comparison_available=comparison_available,
        priority_organization=priority_summary.top_organization,
        high_critical_amount=(
            period_financial.high_critical_amount if period_financial else Decimal("0")
        ),
        potential_review_amount=(
            period_financial.signal_services_amount if period_financial else Decimal("0")
        ),
        priority_patients=period_financial.affected_patients if period_financial else 0,
        top_financial_signal=priority_summary.top_signal,
    )


def get_changes(db: Session) -> AnalyticsChanges:
    runs = list(db.scalars(select(AnalysisRun).order_by(AnalysisRun.id.desc()).limit(2)).all())
    current = runs[0] if runs else None
    previous = runs[1] if len(runs) > 1 else None
    if current is None or previous is None or not previous.signal_record_ids:
        return AnalyticsChanges(
            comparison_available=False,
            current_run_id=current.id if current else None,
            previous_run_id=None,
            new_signals=0,
            resolved_signals=0,
            organizations_risk_increased=0,
            organizations_risk_decreased=0,
            review_amount_change=Decimal("0"),
            completed_reviews=0,
            selected_for_review_rate_change=0.0,
        )
    current_signals = set(current.signal_record_ids)
    previous_signals = set(previous.signal_record_ids)
    current_scores = current.organization_risk_scores
    previous_scores = previous.organization_risk_scores
    shared_orgs = current_scores.keys() & previous_scores.keys()
    current_financial = _period_financial_snapshot(db, current.id)
    previous_financial = _period_financial_snapshot(db, previous.id)
    review_amount_change = (
        current_financial.signal_services_amount - previous_financial.signal_services_amount
        if current_financial is not None and previous_financial is not None
        else current.review_amount - previous.review_amount
    )
    return AnalyticsChanges(
        comparison_available=True,
        current_run_id=current.id,
        previous_run_id=previous.id,
        new_signals=len(current_signals - previous_signals),
        resolved_signals=len(previous_signals - current_signals),
        organizations_risk_increased=sum(
            current_scores[key] - previous_scores[key] > 10 for key in shared_orgs
        ),
        organizations_risk_decreased=sum(
            previous_scores[key] - current_scores[key] > 10 for key in shared_orgs
        ),
        review_amount_change=review_amount_change,
        completed_reviews=current.completed_reviews_count,
        selected_for_review_rate_change=round(
            current.selected_for_review_rate - previous.selected_for_review_rate, 4
        ),
    )


def get_risk_distribution(db: Session) -> list[DistributionPoint]:
    rows = db.execute(
        select(RiskSignal.level, func.count(RiskSignal.id), func.sum(MedicalRecord.amount))
        .join(MedicalRecord, MedicalRecord.id == RiskSignal.medical_record_id)
        .group_by(RiskSignal.level)
    ).all()
    values = {level.value: (count, amount) for level, count, amount in rows}
    return [
        DistributionPoint(
            name=level.value,
            value=values.get(level.value, (0, 0))[0],
            amount=values.get(level.value, (0, 0))[1] or 0,
        )
        for level in RiskLevel
    ]


def get_timeline(db: Session) -> list[TimelinePoint]:
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
        .group_by(month)
        .order_by(month)
    ).all()
    return [
        TimelinePoint(period=value, services=count, amount=amount or 0, signals=signals)
        for value, count, amount, signals in rows
    ]


def get_key_findings(db: Session) -> list[Finding]:
    reasons = Counter(db.scalars(select(RiskSignal.anomaly_type)).all())
    top_orgs = db.scalars(
        select(MedicalOrganization).order_by(MedicalOrganization.risk_score.desc()).limit(3)
    ).all()
    end_period = (
        db.scalar(
            select(func.count(RiskSignal.id)).where(
                RiskSignal.anomaly_type == "Всплеск в конце периода"
            )
        )
        or 0
    )
    total = db.scalar(select(func.count(RiskSignal.id))) or 1
    top_reason = reasons.most_common(1)[0] if reasons else ("Нет данных", 0)
    return [
        Finding(
            title="Нетипичная частота услуг",
            description=(
                "В трёх организациях с наибольшей оценкой риска "
                f"({', '.join(org.name for org in top_orgs)}) частота отдельных услуг "
                "превышает сопоставимый диапазон."
            ),
            severity="Высокая",
        ),
        Finding(
            title="Концентрация в конце месяца",
            description=(
                "На последние пять дней месяца приходится "
                f"{end_period / total:.0%} сформированных сигналов. Рекомендуется "
                "проверить причины сезонной концентрации."
            ),
            severity="Средняя",
        ),
        Finding(
            title="Основной тип отклонения",
            description=(
                f"Чаще всего встречается «{ANOMALY_LABELS.get(top_reason[0], top_reason[0])}» — "
                f"{top_reason[1]} сигналов за период."
            ),
            severity="Информация",
        ),
        Finding(
            title="Фокус экспертной проверки",
            description=(
                "Наибольшая сумма приоритетных услуг сосредоточена в амбулаторном "
                "и диагностическом секторах."
            ),
            severity="Высокая",
        ),
    ]
