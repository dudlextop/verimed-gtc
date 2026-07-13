"""Read-only access to metrics stored by the analysis pipeline.

This module deliberately has no dependency on the analysis runtime or scikit-learn so
serving prepared results does not load the ML stack during a serverless cold start.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AnalysisMetric, AnalysisRun


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
