from dataclasses import asdict
from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db, showcase_snapshot_path, storage_mode
from app.models import DecisionEntityType, ExpertDecisionEvent, RecurringPattern, RiskSignal
from app.schemas import (
    AnalysisExecutionResponse,
    AnalysisMetricByType,
    AnalysisMetricItem,
    AnalysisRunRequest,
    AnalyticsChanges,
    AnalyticsSummary,
    CommandCenter,
    DecisionEventCreate,
    DecisionEventItem,
    DecisionHistory,
    DecisionJournalPage,
    DistributionPoint,
    ExpertReviewBreakdownItem,
    ExpertReviewSummary,
    FinancialImpactItem,
    FinancialImpactSummary,
    Finding,
    HealthStatus,
    IntegrityCheckResult,
    Methodology,
    MethodologySection,
    OrganizationComparison,
    OrganizationDetail,
    PaginatedOrganizations,
    PaginatedPatterns,
    PaginatedSignals,
    PatternBuildResponse,
    PatternChanges,
    PatternDetail,
    PatternGraph,
    PatternListItem,
    PatternReviewCreate,
    PatternSummary,
    PatternTimelinePoint,
    PriorityHistoryPoint,
    PrioritySummary,
    RecurrenceHistory,
    ReviewCreate,
    SignalDetail,
    SignalListItem,
    SignalPreview,
    TimelinePoint,
)
from app.seed import regenerate_and_run
from app.services.analysis_pipeline import latest_metrics, latest_metrics_by_type, run_analysis
from app.services.analytics import (
    get_changes,
    get_command_center,
    get_key_findings,
    get_risk_distribution,
    get_summary,
    get_timeline,
)
from app.services.expert_decisions import (
    add_pattern_event,
    add_signal_event,
    decision_history,
    expert_review_breakdown,
    expert_review_summary,
    list_journal,
    pattern_recurrence,
    signal_recurrence,
    verify_integrity,
)
from app.services.financial_priority import (
    get_financial_impact_summary,
    get_organization_comparison,
    get_organization_financial_impact,
    get_organization_priority_history,
    get_priority_summary,
    refresh_signal_priority,
)
from app.services.organizations import get_organization, list_organizations
from app.services.recurring_patterns import (
    build_patterns,
    get_pattern,
    get_pattern_graph,
    get_pattern_signals,
    get_pattern_timeline,
    list_patterns,
    organization_patterns,
    pattern_changes,
    pattern_summary,
    review_pattern,
    signal_patterns,
)
from app.services.signals import get_signal, list_signals, review_signal
from app.services.storage_health import get_storage_health
from app.synthetic.catalog import ANOMALY_LABELS

router = APIRouter(prefix="/api")
Db = Annotated[Session, Depends(get_db)]


@router.get("/health", response_model=HealthStatus)
def health(db: Db) -> HealthStatus:
    return get_storage_health(
        db,
        storage_mode=storage_mode,
        snapshot_ready=showcase_snapshot_path.is_file(),
    )


@router.get("/analytics/summary", response_model=AnalyticsSummary)
def analytics_summary(db: Db) -> AnalyticsSummary:
    return get_summary(db)


@router.get("/analytics/risk-distribution", response_model=list[DistributionPoint])
def analytics_risk_distribution(db: Db) -> list[DistributionPoint]:
    return get_risk_distribution(db)


@router.get("/analytics/timeline", response_model=list[TimelinePoint])
def analytics_timeline(db: Db) -> list[TimelinePoint]:
    return get_timeline(db)


@router.get("/analytics/key-findings", response_model=list[Finding])
def analytics_key_findings(db: Db) -> list[Finding]:
    return get_key_findings(db)


@router.get("/analytics/command-center", response_model=CommandCenter)
def analytics_command_center(db: Db) -> CommandCenter:
    return get_command_center(db)


@router.get("/analytics/changes", response_model=AnalyticsChanges)
def analytics_changes(db: Db) -> AnalyticsChanges:
    return get_changes(db)


@router.get("/analytics/financial-impact", response_model=FinancialImpactSummary)
def analytics_financial_impact(db: Db) -> FinancialImpactSummary:
    return get_financial_impact_summary(db)


@router.get("/analytics/priority-summary", response_model=PrioritySummary)
def analytics_priority_summary(db: Db) -> PrioritySummary:
    return get_priority_summary(db)


@router.get("/analytics/pattern-summary", response_model=PatternSummary)
def analytics_pattern_summary(db: Db) -> PatternSummary:
    return pattern_summary(db)


@router.get("/analytics/pattern-changes", response_model=PatternChanges)
def analytics_pattern_changes(db: Db) -> PatternChanges:
    return pattern_changes(db)


@router.get("/analytics/expert-review-summary", response_model=ExpertReviewSummary)
def analytics_expert_review_summary(db: Db) -> ExpertReviewSummary:
    return expert_review_summary(db)


@router.get(
    "/analytics/expert-review-by-signal-type",
    response_model=list[ExpertReviewBreakdownItem],
)
def analytics_expert_review_by_signal_type(db: Db) -> list[ExpertReviewBreakdownItem]:
    return expert_review_breakdown(db, DecisionEntityType.SIGNAL, "signal_type")


@router.get(
    "/analytics/expert-review-by-pattern-type",
    response_model=list[ExpertReviewBreakdownItem],
)
def analytics_expert_review_by_pattern_type(db: Db) -> list[ExpertReviewBreakdownItem]:
    return expert_review_breakdown(db, DecisionEntityType.PATTERN, "pattern_type")


@router.get("/decision-journal", response_model=DecisionJournalPage)
def decision_journal(
    db: Db,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
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
    return list_journal(
        db,
        page,
        page_size,
        search,
        entity_type,
        action_type,
        decision_status,
        reviewer,
        organization_id,
        analysis_run_id,
        date_from,
        date_to,
        object_type,
    )


@router.get("/decision-journal/integrity", response_model=IntegrityCheckResult)
def decision_journal_integrity(db: Db) -> IntegrityCheckResult:
    return verify_integrity(db)


@router.get("/decision-journal/{event_id}", response_model=DecisionEventItem)
def decision_journal_event(event_id: int, db: Db) -> DecisionEventItem:
    event = db.get(ExpertDecisionEvent, event_id)
    if event is None:
        raise HTTPException(404, "Событие экспертного решения не найдено")
    history = decision_history(db, event.entity_type, event.entity_fingerprint)
    result = next((item for item in history.events if item.id == event_id), None)
    if result is None:
        raise HTTPException(404, "Событие экспертного решения не найдено")
    return result


@router.get("/organizations", response_model=PaginatedOrganizations)
def organizations(
    db: Db,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    region: str | None = None,
    organization_type: str | None = None,
    risk_level: str | None = None,
    status: str | None = None,
    sort: str = "risk",
) -> PaginatedOrganizations:
    return list_organizations(
        db, page, page_size, search, region, organization_type, risk_level, status, sort
    )


@router.get("/organizations/{organization_id}", response_model=OrganizationDetail)
def organization_detail(organization_id: int, db: Db) -> OrganizationDetail:
    result = get_organization(db, organization_id)
    if not result:
        raise HTTPException(404, "Медицинская организация не найдена")
    return result


@router.get("/organizations/{organization_id}/signals", response_model=PaginatedSignals)
def organization_signals(
    organization_id: int, db: Db, page: int = 1, page_size: int = 20
) -> PaginatedSignals:
    return list_signals(db, page, page_size, None, organization_id, None, None, None, "score")


@router.get("/organizations/{organization_id}/comparison", response_model=OrganizationComparison)
def organization_comparison(organization_id: int, db: Db) -> OrganizationComparison:
    return get_organization_comparison(db, organization_id)


@router.get("/organizations/{organization_id}/financial-impact", response_model=FinancialImpactItem)
def organization_financial_impact(organization_id: int, db: Db) -> FinancialImpactItem:
    result = get_organization_financial_impact(db, organization_id)
    if result is None:
        raise HTTPException(404, "Финансовая значимость организации ещё не рассчитана")
    return result


@router.get(
    "/organizations/{organization_id}/priority-history",
    response_model=list[PriorityHistoryPoint],
)
def organization_priority_history(organization_id: int, db: Db) -> list[PriorityHistoryPoint]:
    return get_organization_priority_history(db, organization_id)


@router.get("/organizations/{organization_id}/patterns", response_model=list[PatternListItem])
def organization_recurring_patterns(organization_id: int, db: Db) -> list[PatternListItem]:
    return organization_patterns(db, organization_id)


@router.get("/signals", response_model=PaginatedSignals)
def signals(
    db: Db,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    level: str | None = None,
    levels: Annotated[list[str] | None, Query()] = None,
    organization_id: int | None = None,
    region: str | None = None,
    anomaly_type: str | None = None,
    status: str | None = None,
    priority_level: str | None = None,
    financial_min: Annotated[Decimal | None, Query(ge=0)] = None,
    financial_max: Annotated[Decimal | None, Query(ge=0)] = None,
    has_decision: bool | None = None,
    period_months: int | None = Query(None, ge=1, le=6),
    sort: str = "priority",
) -> PaginatedSignals:
    return list_signals(
        db,
        page,
        page_size,
        level,
        organization_id,
        region,
        anomaly_type,
        status,
        sort,
        levels,
        priority_level,
        financial_min,
        financial_max,
        has_decision,
        period_months,
    )


@router.get(
    "/signals/by-fingerprint/{fingerprint}/decision-history",
    response_model=DecisionHistory,
)
def signal_history_by_fingerprint(fingerprint: str, db: Db) -> DecisionHistory:
    return decision_history(db, DecisionEntityType.SIGNAL, fingerprint)


@router.get("/signals/{signal_id}", response_model=SignalDetail)
def signal_detail(signal_id: int, db: Db) -> SignalDetail:
    result = get_signal(db, signal_id)
    if not result:
        raise HTTPException(404, "Сигнал риска не найден")
    return result


@router.get("/signals/{signal_id}/preview", response_model=SignalPreview)
def signal_preview(signal_id: int, db: Db) -> SignalPreview:
    result = get_signal(db, signal_id)
    if not result:
        raise HTTPException(404, "Сигнал риска не найден")
    return SignalPreview.model_validate(result)


@router.get("/signals/{signal_id}/decision-history", response_model=DecisionHistory)
def signal_decision_history(signal_id: int, db: Db) -> DecisionHistory:
    signal = db.get(RiskSignal, signal_id)
    if signal is None or signal.fingerprint is None:
        raise HTTPException(404, "История сигнала не найдена")
    return decision_history(db, DecisionEntityType.SIGNAL, signal.fingerprint)


@router.get("/signals/{signal_id}/recurrence-history", response_model=RecurrenceHistory)
def signal_recurrence_history(signal_id: int, db: Db) -> RecurrenceHistory:
    signal = db.get(RiskSignal, signal_id)
    if signal is None or signal.fingerprint is None:
        raise HTTPException(404, "История повторного появления сигнала не найдена")
    return signal_recurrence(db, signal.fingerprint)


@router.post("/signals/{signal_id}/decision-events", response_model=DecisionEventItem)
def create_signal_decision_event(
    signal_id: int, payload: DecisionEventCreate, db: Db
) -> DecisionEventItem:
    signal = db.get(RiskSignal, signal_id)
    if signal is None:
        raise HTTPException(404, "Сигнал риска не найден")
    try:
        event = add_signal_event(db, signal, payload)
        refresh_signal_priority(db, signal)
        db.commit()
    except ValueError as error:
        db.rollback()
        raise HTTPException(422, str(error)) from error
    return next(
        item
        for item in decision_history(db, DecisionEntityType.SIGNAL, signal.fingerprint or "").events
        if item.id == event.id
    )


@router.post("/signals/{signal_id}/review", response_model=SignalDetail)
def create_review(signal_id: int, payload: ReviewCreate, db: Db) -> SignalDetail:
    result = review_signal(db, signal_id, payload)
    if not result:
        raise HTTPException(404, "Сигнал риска не найден")
    return result


@router.get("/signals/{signal_id}/patterns", response_model=list[PatternListItem])
def signal_recurring_patterns(signal_id: int, db: Db) -> list[PatternListItem]:
    return signal_patterns(db, signal_id)


@router.get("/patterns", response_model=PaginatedPatterns)
def patterns(
    db: Db,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    pattern_type: str | None = None,
    organization_id: int | None = None,
    stability: str | None = None,
    importance: str | None = None,
    status: str | None = None,
    financial_min: Annotated[Decimal | None, Query(ge=0)] = None,
    financial_max: Annotated[Decimal | None, Query(ge=0)] = None,
    period: str | None = Query(None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    sort: str = "importance",
) -> PaginatedPatterns:
    return list_patterns(
        db,
        page,
        page_size,
        pattern_type,
        organization_id,
        stability,
        importance,
        status,
        financial_min,
        financial_max,
        period,
        sort,
    )


@router.get(
    "/patterns/by-fingerprint/{fingerprint}/decision-history",
    response_model=DecisionHistory,
)
def pattern_history_by_fingerprint(fingerprint: str, db: Db) -> DecisionHistory:
    return decision_history(db, DecisionEntityType.PATTERN, fingerprint)


@router.get("/patterns/{pattern_id}", response_model=PatternDetail)
def pattern_detail(pattern_id: int, db: Db) -> PatternDetail:
    result = get_pattern(db, pattern_id)
    if result is None:
        raise HTTPException(404, "Повторяющаяся модель не найдена")
    return result


@router.get("/patterns/{pattern_id}/signals", response_model=list[SignalListItem])
def pattern_signals(pattern_id: int, db: Db) -> list[SignalListItem]:
    if db.get(RecurringPattern, pattern_id) is None:
        raise HTTPException(404, "Повторяющаяся модель не найдена")
    return get_pattern_signals(db, pattern_id)


@router.get("/patterns/{pattern_id}/graph", response_model=PatternGraph)
def pattern_graph(pattern_id: int, db: Db, limit: int = Query(60, ge=10, le=150)) -> PatternGraph:
    result = get_pattern_graph(db, pattern_id, limit)
    if result is None:
        raise HTTPException(404, "Повторяющаяся модель не найдена")
    return result


@router.get("/patterns/{pattern_id}/timeline", response_model=list[PatternTimelinePoint])
def pattern_timeline(pattern_id: int, db: Db) -> list[PatternTimelinePoint]:
    if db.get(RecurringPattern, pattern_id) is None:
        raise HTTPException(404, "Повторяющаяся модель не найдена")
    return get_pattern_timeline(db, pattern_id)


@router.get("/patterns/{pattern_id}/decision-history", response_model=DecisionHistory)
def pattern_decision_history(pattern_id: int, db: Db) -> DecisionHistory:
    pattern = db.get(RecurringPattern, pattern_id)
    if pattern is None:
        raise HTTPException(404, "История повторяющейся модели не найдена")
    return decision_history(db, DecisionEntityType.PATTERN, pattern.fingerprint)


@router.get("/patterns/{pattern_id}/recurrence-history", response_model=RecurrenceHistory)
def pattern_recurrence_history(pattern_id: int, db: Db) -> RecurrenceHistory:
    pattern = db.get(RecurringPattern, pattern_id)
    if pattern is None:
        raise HTTPException(404, "История повторного появления модели не найдена")
    return pattern_recurrence(db, pattern.fingerprint)


@router.post("/patterns/{pattern_id}/decision-events", response_model=DecisionEventItem)
def create_pattern_decision_event(
    pattern_id: int, payload: DecisionEventCreate, db: Db
) -> DecisionEventItem:
    pattern = db.get(RecurringPattern, pattern_id)
    if pattern is None:
        raise HTTPException(404, "Повторяющаяся модель не найдена")
    try:
        event = add_pattern_event(db, pattern, payload)
        db.commit()
    except ValueError as error:
        db.rollback()
        raise HTTPException(422, str(error)) from error
    return next(
        item
        for item in decision_history(db, DecisionEntityType.PATTERN, pattern.fingerprint).events
        if item.id == event.id
    )


@router.post("/patterns/{pattern_id}/review", response_model=PatternDetail)
def create_pattern_review(pattern_id: int, payload: PatternReviewCreate, db: Db) -> PatternDetail:
    result = review_pattern(db, pattern_id, payload)
    if result is None:
        raise HTTPException(404, "Повторяющаяся модель не найдена")
    return result


@router.post("/analysis/build-patterns", response_model=PatternBuildResponse)
def execute_pattern_build(db: Db) -> PatternBuildResponse:
    try:
        return build_patterns(db)
    except ValueError as error:
        raise HTTPException(409, str(error)) from error


@router.get("/methodology", response_model=Methodology)
def methodology(db: Db) -> Methodology:
    metrics = latest_metrics(db)

    def percent(value: float) -> str:
        return f"{value:.1%}".replace(".", ",")

    metric_items = (
        [
            f"Точность выявления (Precision): {percent(metrics.precision)}",
            f"Полнота выявления (Recall): {percent(metrics.recall)}",
            f"F1-мера: {percent(metrics.f1)}",
            f"Доля услуг, направленных на проверку: {percent(metrics.selected_for_review_rate)}",
        ]
        if metrics
        else ["Метрики будут доступны после завершения анализа"]
    )
    return Methodology(
        title="Методика анализа",
        introduction=(
            "Verimed сопоставляет обезличенные сведения об услугах с типичными значениями "
            "и формирует объяснимую оценку риска от 0 до 100."
        ),
        sections=[
            MethodologySection(
                title="Проверяемые отклонения",
                description=(
                    "Набор правил подготовлен для последующего расширения статистическими моделями."
                ),
                items=[
                    "Повторное оказание одной услуги в короткий период",
                    "Временные пересечения и аномальная частота",
                    "Отклонение стоимости от сопоставимого диапазона",
                    "Несоответствие профилю организации",
                    "Всплески регистрации в конце отчётного периода",
                ],
            ),
            MethodologySection(
                title="Сопоставимые группы",
                description=(
                    "Организации сравниваются по региону, типу, специализации, объёму, "
                    "числу врачей и мощности."
                ),
                items=[
                    "При малой группе критерии расширяются поэтапно",
                    "Расширение группы фиксируется как ограничение",
                    "Модель Isolation Forest обучается воспроизводимо внутри группы",
                ],
            ),
            MethodologySection(
                title="Формирование оценки",
                description="Оценка рассчитывается по прозрачной взвешенной формуле.",
                items=[
                    "55% — сигналы детерминированных проверок",
                    "30% — аномальность поведения организации",
                    "15% — финансовая значимость",
                    "0–29 — низкий; 30–59 — средний; 60–79 — высокий; 80–100 — критический",
                ],
            ),
            MethodologySection(
                title="Качество текущего анализа",
                description=(
                    "Метрики рассчитаны по скрытой эталонной разметке синтетических данных."
                ),
                items=metric_items,
            ),
            MethodologySection(
                title="Роль специалиста",
                description="Система ранжирует записи и объясняет причины сигнала.",
                items=[
                    "Клинический контекст оценивает специалист",
                    "Решение фиксируется с комментарием",
                    "Результаты проверок могут улучшать будущую модель",
                ],
            ),
        ],
        disclaimer=(
            "Сигнал не является доказательством несоответствия. Финальный вывод "
            "всегда делает уполномоченный специалист."
        ),
    )


@router.get("/analysis/metrics", response_model=AnalysisMetricItem)
def analysis_metrics(db: Db) -> AnalysisMetricItem:
    result = latest_metrics(db)
    if result is None:
        raise HTTPException(404, "Метрики анализа ещё не рассчитаны")
    return AnalysisMetricItem.model_validate(result)


@router.get("/analysis/metrics/by-anomaly-type", response_model=list[AnalysisMetricByType])
def analysis_metrics_by_type(db: Db) -> list[AnalysisMetricByType]:
    return [
        AnalysisMetricByType(
            **AnalysisMetricItem.model_validate(item).model_dump(),
            anomaly_type=item.anomaly_type or "",
            anomaly_label=ANOMALY_LABELS.get(item.anomaly_type or "", item.anomaly_type or ""),
        )
        for item in latest_metrics_by_type(db)
    ]


@router.post("/analysis/run", response_model=AnalysisExecutionResponse)
def execute_analysis(payload: AnalysisRunRequest, db: Db) -> AnalysisExecutionResponse:
    return AnalysisExecutionResponse.model_validate(asdict(run_analysis(db, payload.seed)))


@router.post("/analysis/regenerate-and-run", response_model=AnalysisExecutionResponse)
def execute_regeneration(payload: AnalysisRunRequest, db: Db) -> AnalysisExecutionResponse:
    return AnalysisExecutionResponse.model_validate(asdict(regenerate_and_run(db, payload.seed)))
