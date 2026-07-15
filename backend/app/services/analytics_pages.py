from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import RecurringPattern
from app.schemas import (
    AnalysisMetricItem,
    HomeAnalytics,
    OverviewAnalytics,
    PatternTypeDistribution,
)
from app.services.analysis_metrics import latest_metrics
from app.services.analytics import (
    get_changes,
    get_command_center,
    get_key_findings,
    get_risk_distribution,
    get_summary,
    get_timeline,
)
from app.services.expert_decisions import expert_review_summary
from app.services.financial_priority import get_priority_summary
from app.services.organizations import list_organizations
from app.services.recurring_patterns import PATTERN_TYPES, pattern_changes, pattern_summary
from app.services.regional_monitoring import get_regional_monitoring
from app.services.runtime_cache import cached_result


def _cache_key(db: Session, page: str) -> str:
    bind = db.get_bind()
    return f"{page}:{bind.engine.url.render_as_string(hide_password=True)}"


def _quality(db: Session) -> AnalysisMetricItem:
    metric = latest_metrics(db)
    if metric is None:
        raise ValueError("Метрики анализа ещё не рассчитаны")
    return AnalysisMetricItem.model_validate(metric)


def _pattern_distribution(db: Session) -> list[PatternTypeDistribution]:
    rows = db.execute(
        select(RecurringPattern.pattern_type, func.count(RecurringPattern.id))
        .where(RecurringPattern.is_active.is_(True))
        .group_by(RecurringPattern.pattern_type)
        .order_by(func.count(RecurringPattern.id).desc(), RecurringPattern.pattern_type)
    ).all()
    maximum = max((count for _, count in rows), default=1)
    return [
        PatternTypeDistribution(
            label=PATTERN_TYPES.get(pattern_type, pattern_type),
            value=count,
            percent=round(count / maximum * 100, 2),
        )
        for pattern_type, count in rows
    ]


def get_home_analytics(db: Session) -> HomeAnalytics:
    def build() -> HomeAnalytics:
        return HomeAnalytics(
            schema_version=1,
            summary=get_summary(db),
            command_center=get_command_center(db),
            changes=get_changes(db),
            risk_distribution=get_risk_distribution(db),
            timeline=get_timeline(db),
            findings=get_key_findings(db),
            quality=_quality(db),
            pattern_summary=pattern_summary(db),
            expert_review=expert_review_summary(db),
            priority_organizations=list_organizations(
                db, 1, 3, None, None, None, None, None, "priority"
            ),
        )

    return cached_result(_cache_key(db, "home"), build)


def get_overview_analytics(db: Session) -> OverviewAnalytics:
    def build() -> OverviewAnalytics:
        return OverviewAnalytics(
            schema_version=2,
            summary=get_summary(db),
            command_center=get_command_center(db),
            changes=get_changes(db),
            priority_summary=get_priority_summary(db),
            pattern_summary=pattern_summary(db),
            pattern_changes=pattern_changes(db),
            pattern_distribution=_pattern_distribution(db),
            quality=_quality(db),
            expert_review=expert_review_summary(db),
            timeline=get_timeline(db),
            regional_monitoring=get_regional_monitoring(db),
        )

    return cached_result(_cache_key(db, "overview"), build)
