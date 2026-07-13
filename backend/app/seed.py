from __future__ import annotations

import random

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import (
    AnalysisMetric,
    AnalysisRun,
    DecisionJournalIntegrityCheck,
    Doctor,
    ExpertDecisionEvent,
    ExpertFeedback,
    ExpertReview,
    FinancialImpactSnapshot,
    GroundTruthAnomaly,
    MedicalOrganization,
    MedicalRecord,
    MedicalService,
    OrganizationAnomalyScore,
    OrganizationComparisonSnapshot,
    OrganizationFeature,
    OrganizationPrioritySnapshot,
    Patient,
    PatternDoctor,
    PatternFactor,
    PatternFingerprintHistory,
    PatternOrganization,
    PatternPatient,
    PatternReview,
    PatternService,
    PatternSignal,
    PatternSnapshot,
    RecurringPattern,
    ReviewPriority,
    RiskFactor,
    RiskSignal,
    SignalFingerprintHistory,
)
from app.services.analysis_pipeline import AnalysisExecution, run_analysis
from app.synthetic.generator import create_reference_data, generate_normal_records
from app.synthetic.injectors import InjectionContext, inject_all_anomalies


def _clear_database(db: Session) -> None:
    for model in [
        ExpertFeedback,
        DecisionJournalIntegrityCheck,
        ExpertDecisionEvent,
        PatternFingerprintHistory,
        SignalFingerprintHistory,
        PatternReview,
        PatternSnapshot,
        PatternFactor,
        PatternService,
        PatternPatient,
        PatternDoctor,
        PatternOrganization,
        PatternSignal,
        RecurringPattern,
        OrganizationComparisonSnapshot,
        OrganizationPrioritySnapshot,
        FinancialImpactSnapshot,
        AnalysisMetric,
        OrganizationFeature,
        OrganizationAnomalyScore,
        RiskFactor,
        ReviewPriority,
        ExpertReview,
        RiskSignal,
        GroundTruthAnomaly,
        MedicalRecord,
        Doctor,
        Patient,
        MedicalService,
        MedicalOrganization,
        AnalysisRun,
    ]:
        db.execute(delete(model))
    db.commit()


def generate_dataset(db: Session, random_seed: int, force: bool = True) -> dict[str, int]:
    if force:
        _clear_database(db)
    rng = random.Random(random_seed)
    organizations, patients, doctors, services = create_reference_data(db, rng)
    generate_normal_records(
        db,
        rng,
        organizations,
        patients,
        doctors,
        services,
        count=13_800,
    )
    records = list(
        db.scalars(
            select(MedicalRecord)
            .options(
                selectinload(MedicalRecord.service),
                selectinload(MedicalRecord.organization),
            )
            .order_by(MedicalRecord.id)
        ).all()
    )
    context = InjectionContext(
        db=db,
        rng=rng,
        records=records,
        organizations=organizations,
        patients=patients,
        doctors=doctors,
        services=services,
    )
    counts = inject_all_anomalies(context, per_type=150)
    db.commit()
    total_records = db.scalar(select(func.count(MedicalRecord.id))) or 0
    if total_records != 15_000:
        raise RuntimeError(f"Ожидалось 15 000 записей, создано {total_records}")
    return counts


def seed_database(
    db: Session,
    force: bool = False,
    random_seed: int | None = None,
) -> AnalysisExecution | None:
    seed = random_seed if random_seed is not None else settings.seed
    existing = db.scalar(select(func.count(MedicalRecord.id))) or 0
    if existing and not force:
        has_metrics = db.scalar(select(func.count(AnalysisMetric.id))) or 0
        return run_analysis(db, seed) if not has_metrics else None
    generate_dataset(db, seed, force=True)
    return run_analysis(db, seed)


def regenerate_and_run(db: Session, random_seed: int) -> AnalysisExecution:
    generate_dataset(db, random_seed, force=True)
    return run_analysis(db, random_seed)


def main() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        execution = seed_database(db, force=True)
    if execution:
        print(
            f"Создано {execution.records_processed} записей, "
            f"сформировано {execution.signals_created} сигналов."
        )


if __name__ == "__main__":
    main()
