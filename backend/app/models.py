from __future__ import annotations

from datetime import UTC, date, datetime, time
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class RiskLevel(StrEnum):
    LOW = "Низкий"
    MEDIUM = "Средний"
    HIGH = "Высокий"
    CRITICAL = "Критический"


class ReviewStatus(StrEnum):
    UNREVIEWED = "Не проверено"
    IN_PROGRESS = "На рассмотрении"
    CONFIRMED = "Подтверждён сигнал"
    REJECTED = "Сигнал не подтверждён"
    ESCALATED = "Направлено на углублённую проверку"
    COMPLETED = "Проверка завершена"
    NEEDS_INFO = "Требуются дополнительные сведения"


class PatternReviewStatus(StrEnum):
    UNREVIEWED = "Не оценено"
    CONFIRMED = "Значимость подтверждена"
    INSIGNIFICANT = "Отмечено как несущественное"
    ESCALATED = "Направлено на углублённую проверку"
    NEEDS_INFO = "Требуются дополнительные сведения"
    COMPLETED = "Оценка завершена"


class DecisionEntityType(StrEnum):
    SIGNAL = "signal"
    PATTERN = "pattern"


class FeedbackUsefulness(StrEnum):
    USEFUL = "Полезный"
    PARTLY_USEFUL = "Частично полезный"
    USELESS = "Бесполезный"


class ExplanationQuality(StrEnum):
    CLEAR = "Понятное"
    NEEDS_CLARIFICATION = "Требует уточнения"
    UNCLEAR = "Непонятное"


class DataSufficiency(StrEnum):
    SUFFICIENT = "Достаточно"
    PARTLY_SUFFICIENT = "Частично достаточно"
    INSUFFICIENT = "Недостаточно"


class PriorityCorrectness(StrEnum):
    UNDERESTIMATED = "Занижен"
    CORRECT = "Корректен"
    OVERESTIMATED = "Завышен"


class GroupingCorrectness(StrEnum):
    CORRECT = "Корректная"
    PARTLY_CORRECT = "Частично корректная"
    INCORRECT = "Некорректная"


class MedicalOrganization(Base):
    __tablename__ = "medical_organizations"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    region: Mapped[str] = mapped_column(String(100), index=True)
    organization_type: Mapped[str] = mapped_column(String(120), index=True)
    specialization: Mapped[str] = mapped_column(String(100), default="Общий профиль")
    capacity: Mapped[int] = mapped_column(Integer, default=500)
    risk_score: Mapped[int] = mapped_column(Integer, default=0, index=True)
    review_status: Mapped[ReviewStatus] = mapped_column(
        Enum(ReviewStatus, values_callable=lambda items: [item.value for item in items]),
        default=ReviewStatus.UNREVIEWED,
    )
    records: Mapped[list[MedicalRecord]] = relationship(back_populates="organization")
    doctors: Mapped[list[Doctor]] = relationship(back_populates="organization")
    signals: Mapped[list[RiskSignal]] = relationship(back_populates="organization")


class Patient(Base):
    __tablename__ = "patients"
    id: Mapped[int] = mapped_column(primary_key=True)
    anonymous_code: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    age_group: Mapped[str] = mapped_column(String(20))
    sex: Mapped[str] = mapped_column(String(12))
    records: Mapped[list[MedicalRecord]] = relationship(back_populates="patient")


class Doctor(Base):
    __tablename__ = "doctors"
    id: Mapped[int] = mapped_column(primary_key=True)
    anonymous_code: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    specialty: Mapped[str] = mapped_column(String(80))
    organization_id: Mapped[int] = mapped_column(ForeignKey("medical_organizations.id"), index=True)
    organization: Mapped[MedicalOrganization] = relationship(back_populates="doctors")
    records: Mapped[list[MedicalRecord]] = relationship(back_populates="doctor")


class MedicalService(Base):
    __tablename__ = "medical_services"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    category: Mapped[str] = mapped_column(String(80))
    typical_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    minimum_interval_days: Mapped[int] = mapped_column(Integer, default=0)
    expected_duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    maximum_frequency_30d: Mapped[int] = mapped_column(Integer, default=4)
    allowed_organization_types: Mapped[list[str]] = mapped_column(JSON, default=list)
    records: Mapped[list[MedicalRecord]] = relationship(back_populates="service")


class MedicalRecord(Base):
    __tablename__ = "medical_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("medical_organizations.id"), index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctors.id"), index=True)
    service_id: Mapped[int] = mapped_column(ForeignKey("medical_services.id"), index=True)
    service_date: Mapped[date] = mapped_column(Date, index=True)
    service_time: Mapped[time] = mapped_column(Time, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    is_ground_truth_anomaly: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    ground_truth_anomaly_type: Mapped[str | None] = mapped_column(
        String(80), nullable=True, index=True
    )
    anomaly_injection_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    organization: Mapped[MedicalOrganization] = relationship(back_populates="records")
    patient: Mapped[Patient] = relationship(back_populates="records")
    doctor: Mapped[Doctor] = relationship(back_populates="records")
    service: Mapped[MedicalService] = relationship(back_populates="records")
    signal: Mapped[RiskSignal | None] = relationship(back_populates="record", uselist=False)


class RiskSignal(Base):
    __tablename__ = "risk_signals"
    __table_args__ = (
        Index("ix_risk_signals_status_level_created", "status", "level", "created_at"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    medical_record_id: Mapped[int] = mapped_column(
        ForeignKey("medical_records.id"), unique=True, index=True
    )
    organization_id: Mapped[int] = mapped_column(ForeignKey("medical_organizations.id"), index=True)
    analysis_run_id: Mapped[int | None] = mapped_column(
        ForeignKey("analysis_runs.id"), nullable=True, index=True
    )
    fingerprint: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    score: Mapped[int] = mapped_column(Integer, index=True)
    level: Mapped[RiskLevel] = mapped_column(
        Enum(RiskLevel, values_callable=lambda items: [item.value for item in items]), index=True
    )
    primary_reason: Mapped[str] = mapped_column(String(180))
    anomaly_type: Mapped[str] = mapped_column(String(80), index=True)
    related_record_ids: Mapped[list[int]] = mapped_column(JSON, default=list)
    severity: Mapped[float] = mapped_column(Float, default=0.0)
    rule_score: Mapped[float] = mapped_column(Float, default=0.0)
    organization_score: Mapped[float] = mapped_column(Float, default=0.0)
    financial_score: Mapped[float] = mapped_column(Float, default=0.0)
    limitations: Mapped[list[str]] = mapped_column(JSON, default=list)
    recommendation: Mapped[str] = mapped_column(Text, default="Рекомендуется экспертная проверка.")
    status: Mapped[ReviewStatus] = mapped_column(
        Enum(ReviewStatus, values_callable=lambda items: [item.value for item in items]),
        default=ReviewStatus.UNREVIEWED,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, index=True)
    record: Mapped[MedicalRecord] = relationship(back_populates="signal")
    organization: Mapped[MedicalOrganization] = relationship(back_populates="signals")
    factors: Mapped[list[RiskFactor]] = relationship(
        back_populates="signal", cascade="all, delete-orphan"
    )
    reviews: Mapped[list[ExpertReview]] = relationship(
        back_populates="signal", cascade="all, delete-orphan"
    )
    review_priority: Mapped[ReviewPriority | None] = relationship(
        back_populates="signal", cascade="all, delete-orphan", uselist=False
    )


class RiskFactor(Base):
    __tablename__ = "risk_factors"
    id: Mapped[int] = mapped_column(primary_key=True)
    signal_id: Mapped[int] = mapped_column(ForeignKey("risk_signals.id"), index=True)
    name: Mapped[str] = mapped_column(String(140))
    contribution: Mapped[int] = mapped_column(Integer)
    actual_value: Mapped[str] = mapped_column(String(120))
    typical_value: Mapped[str] = mapped_column(String(120))
    explanation: Mapped[str] = mapped_column(Text)
    signal: Mapped[RiskSignal] = relationship(back_populates="factors")


class ExpertReview(Base):
    __tablename__ = "expert_reviews"
    id: Mapped[int] = mapped_column(primary_key=True)
    signal_id: Mapped[int] = mapped_column(ForeignKey("risk_signals.id"), index=True)
    status: Mapped[ReviewStatus] = mapped_column(
        Enum(ReviewStatus, values_callable=lambda items: [item.value for item in items])
    )
    comment: Mapped[str] = mapped_column(Text, default="")
    reviewer_name: Mapped[str] = mapped_column(String(100), default="Эксперт Verimed")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    signal: Mapped[RiskSignal] = relationship(back_populates="reviews")


class AnalysisRun(Base):
    __tablename__ = "analysis_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    started_at: Mapped[datetime] = mapped_column(DateTime)
    completed_at: Mapped[datetime] = mapped_column(DateTime)
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    records_processed: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(60))
    model_version: Mapped[str] = mapped_column(String(40), default="rules-v1")
    random_seed: Mapped[int] = mapped_column(Integer, default=20260712)
    anomalies_injected: Mapped[int] = mapped_column(Integer, default=0)
    signals_created: Mapped[int] = mapped_column(Integer, default=0)
    signal_record_ids: Mapped[list[int]] = mapped_column(JSON, default=list)
    high_risk_record_ids: Mapped[list[int]] = mapped_column(JSON, default=list)
    organization_risk_scores: Mapped[dict[str, int]] = mapped_column(JSON, default=dict)
    review_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    selected_for_review_rate: Mapped[float] = mapped_column(Float, default=0.0)
    completed_reviews_count: Mapped[int] = mapped_column(Integer, default=0)


class GroundTruthAnomaly(Base):
    __tablename__ = "ground_truth_anomalies"
    id: Mapped[int] = mapped_column(primary_key=True)
    injection_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    anomaly_type: Mapped[str] = mapped_column(String(80), index=True)
    primary_record_id: Mapped[int] = mapped_column(ForeignKey("medical_records.id"), index=True)
    related_record_ids: Mapped[list[int]] = mapped_column(JSON, default=list)
    parameters: Mapped[dict[str, str | int | float]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)


class OrganizationFeature(Base):
    __tablename__ = "organization_features"
    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_run_id: Mapped[int] = mapped_column(ForeignKey("analysis_runs.id"), index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("medical_organizations.id"), index=True)
    feature_name: Mapped[str] = mapped_column(String(100), index=True)
    value: Mapped[float] = mapped_column(Float)
    peer_median: Mapped[float] = mapped_column(Float)
    deviation: Mapped[float] = mapped_column(Float)


class OrganizationAnomalyScore(Base):
    __tablename__ = "organization_anomaly_scores"
    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_run_id: Mapped[int] = mapped_column(ForeignKey("analysis_runs.id"), index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("medical_organizations.id"), index=True)
    score: Mapped[float] = mapped_column(Float)
    peer_group_key: Mapped[str] = mapped_column(String(180))
    peer_group_size: Mapped[int] = mapped_column(Integer)
    limitation: Mapped[str] = mapped_column(Text, default="")
    explanation: Mapped[str] = mapped_column(Text)


class AnalysisMetric(Base):
    __tablename__ = "analysis_metrics"
    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_run_id: Mapped[int] = mapped_column(ForeignKey("analysis_runs.id"), index=True)
    anomaly_type: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    precision: Mapped[float] = mapped_column(Float)
    recall: Mapped[float] = mapped_column(Float)
    f1: Mapped[float] = mapped_column(Float)
    false_positive_rate: Mapped[float] = mapped_column(Float)
    true_positive_count: Mapped[int] = mapped_column(Integer)
    false_positive_count: Mapped[int] = mapped_column(Integer)
    false_negative_count: Mapped[int] = mapped_column(Integer)
    selected_for_review_rate: Mapped[float] = mapped_column(Float)
    manual_review_reduction: Mapped[float] = mapped_column(Float)


class ReviewPriority(Base):
    __tablename__ = "review_priorities"
    __table_args__ = (
        Index("ix_review_priorities_analysis_score", "analysis_run_id", "score"),
        Index("ix_review_priorities_level_score", "level", "score"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_run_id: Mapped[int] = mapped_column(ForeignKey("analysis_runs.id"), index=True)
    signal_id: Mapped[int] = mapped_column(ForeignKey("risk_signals.id"), unique=True, index=True)
    score: Mapped[int] = mapped_column(Integer, index=True)
    level: Mapped[RiskLevel] = mapped_column(
        Enum(RiskLevel, values_callable=lambda items: [item.value for item in items]), index=True
    )
    financial_significance: Mapped[Decimal] = mapped_column(Numeric(14, 2), index=True)
    linked_record_ids: Mapped[list[int]] = mapped_column(JSON, default=list)
    repetition_count: Mapped[int] = mapped_column(Integer)
    affected_patients: Mapped[int] = mapped_column(Integer)
    duration_days: Mapped[int] = mapped_column(Integer)
    factors: Mapped[list[dict[str, str | int | float]]] = mapped_column(JSON, default=list)
    explanation: Mapped[str] = mapped_column(Text)
    signal: Mapped[RiskSignal] = relationship(back_populates="review_priority")


class FinancialImpactSnapshot(Base):
    __tablename__ = "financial_impact_snapshots"
    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_run_id: Mapped[int] = mapped_column(ForeignKey("analysis_runs.id"), index=True)
    scope_type: Mapped[str] = mapped_column(String(40), index=True)
    scope_key: Mapped[str] = mapped_column(String(180), index=True)
    total_services_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    signal_services_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    high_critical_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    confirmed_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    rejected_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    unreviewed_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    affected_records: Mapped[int] = mapped_column(Integer)
    affected_patients: Mapped[int] = mapped_column(Integer)
    unique_record_ids: Mapped[list[int]] = mapped_column(JSON, default=list)


class OrganizationPrioritySnapshot(Base):
    __tablename__ = "organization_priority_snapshots"
    __table_args__ = (
        Index(
            "ix_organization_priority_snapshots_run_score",
            "analysis_run_id",
            "score",
            "organization_id",
        ),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_run_id: Mapped[int] = mapped_column(ForeignKey("analysis_runs.id"), index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("medical_organizations.id"), index=True)
    score: Mapped[int] = mapped_column(Integer, index=True)
    level: Mapped[RiskLevel] = mapped_column(
        Enum(RiskLevel, values_callable=lambda items: [item.value for item in items]), index=True
    )
    financial_significance: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    high_critical_signals: Mapped[int] = mapped_column(Integer)
    affected_patients: Mapped[int] = mapped_column(Integer)
    duration_days: Mapped[int] = mapped_column(Integer)
    unreviewed_share: Mapped[float] = mapped_column(Float)
    factors: Mapped[list[dict[str, str | int | float]]] = mapped_column(JSON, default=list)
    explanation: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)


class OrganizationComparisonSnapshot(Base):
    __tablename__ = "organization_comparison_snapshots"
    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_run_id: Mapped[int] = mapped_column(ForeignKey("analysis_runs.id"), index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("medical_organizations.id"), index=True)
    metric_key: Mapped[str] = mapped_column(String(100), index=True)
    metric_label: Mapped[str] = mapped_column(String(180))
    value: Mapped[float] = mapped_column(Float)
    peer_median: Mapped[float] = mapped_column(Float)
    typical_low: Mapped[float] = mapped_column(Float)
    typical_high: Mapped[float] = mapped_column(Float)
    deviation_percent: Mapped[float] = mapped_column(Float)
    position: Mapped[int] = mapped_column(Integer)
    peer_group_size: Mapped[int] = mapped_column(Integer)
    reliability: Mapped[str] = mapped_column(String(40))
    limitation: Mapped[str] = mapped_column(Text, default="")
    explanation: Mapped[str] = mapped_column(Text)


class RecurringPattern(Base):
    __tablename__ = "recurring_patterns"
    __table_args__ = (
        Index(
            "ix_recurring_patterns_active_importance",
            "is_active",
            "importance_score",
            "id",
        ),
        Index(
            "ix_recurring_patterns_active_stability",
            "is_active",
            "stability_score",
            "id",
        ),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    fingerprint: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(220), index=True)
    pattern_type: Mapped[str] = mapped_column(String(80), index=True)
    description: Mapped[str] = mapped_column(Text)
    first_seen: Mapped[date] = mapped_column(Date, index=True)
    last_seen: Mapped[date] = mapped_column(Date, index=True)
    period_count: Mapped[int] = mapped_column(Integer)
    signal_count: Mapped[int] = mapped_column(Integer)
    organization_count: Mapped[int] = mapped_column(Integer)
    doctor_count: Mapped[int] = mapped_column(Integer)
    patient_count: Mapped[int] = mapped_column(Integer)
    service_count: Mapped[int] = mapped_column(Integer)
    financial_significance: Mapped[Decimal] = mapped_column(Numeric(16, 2), index=True)
    average_risk: Mapped[float] = mapped_column(Float)
    average_priority: Mapped[float] = mapped_column(Float)
    stability_score: Mapped[int] = mapped_column(Integer, index=True)
    stability_level: Mapped[str] = mapped_column(String(40), index=True)
    importance_score: Mapped[int] = mapped_column(Integer, index=True)
    importance_level: Mapped[RiskLevel] = mapped_column(
        Enum(RiskLevel, values_callable=lambda items: [item.value for item in items]), index=True
    )
    review_status: Mapped[PatternReviewStatus] = mapped_column(
        Enum(
            PatternReviewStatus,
            values_callable=lambda items: [item.value for item in items],
        ),
        default=PatternReviewStatus.UNREVIEWED,
        index=True,
    )
    first_analysis_run_id: Mapped[int] = mapped_column(ForeignKey("analysis_runs.id"), index=True)
    last_analysis_run_id: Mapped[int] = mapped_column(ForeignKey("analysis_runs.id"), index=True)
    recurrence_runs: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    formed_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    signals: Mapped[list[PatternSignal]] = relationship(
        back_populates="pattern", cascade="all, delete-orphan"
    )
    organizations: Mapped[list[PatternOrganization]] = relationship(
        back_populates="pattern", cascade="all, delete-orphan"
    )
    doctors: Mapped[list[PatternDoctor]] = relationship(
        back_populates="pattern", cascade="all, delete-orphan"
    )
    patients: Mapped[list[PatternPatient]] = relationship(
        back_populates="pattern", cascade="all, delete-orphan"
    )
    services: Mapped[list[PatternService]] = relationship(
        back_populates="pattern", cascade="all, delete-orphan"
    )
    factors: Mapped[list[PatternFactor]] = relationship(
        back_populates="pattern", cascade="all, delete-orphan"
    )
    reviews: Mapped[list[PatternReview]] = relationship(
        back_populates="pattern", cascade="all, delete-orphan"
    )
    snapshots: Mapped[list[PatternSnapshot]] = relationship(
        back_populates="pattern", cascade="all, delete-orphan"
    )


class PatternSignal(Base):
    __tablename__ = "pattern_signals"
    __table_args__ = (UniqueConstraint("pattern_id", "signal_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    pattern_id: Mapped[int] = mapped_column(ForeignKey("recurring_patterns.id"), index=True)
    signal_id: Mapped[int] = mapped_column(ForeignKey("risk_signals.id"), index=True)
    analysis_run_id: Mapped[int] = mapped_column(ForeignKey("analysis_runs.id"), index=True)
    strength: Mapped[float] = mapped_column(Float, default=1.0)
    relationship_explanation: Mapped[str] = mapped_column(Text)
    pattern: Mapped[RecurringPattern] = relationship(back_populates="signals")


class PatternOrganization(Base):
    __tablename__ = "pattern_organizations"
    __table_args__ = (UniqueConstraint("pattern_id", "organization_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    pattern_id: Mapped[int] = mapped_column(ForeignKey("recurring_patterns.id"), index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("medical_organizations.id"), index=True)
    signal_count: Mapped[int] = mapped_column(Integer)
    financial_significance: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    pattern: Mapped[RecurringPattern] = relationship(back_populates="organizations")


class PatternDoctor(Base):
    __tablename__ = "pattern_doctors"
    __table_args__ = (UniqueConstraint("pattern_id", "doctor_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    pattern_id: Mapped[int] = mapped_column(ForeignKey("recurring_patterns.id"), index=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctors.id"), index=True)
    signal_count: Mapped[int] = mapped_column(Integer)
    share: Mapped[float] = mapped_column(Float)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    pattern: Mapped[RecurringPattern] = relationship(back_populates="doctors")


class PatternPatient(Base):
    __tablename__ = "pattern_patients"
    __table_args__ = (UniqueConstraint("pattern_id", "patient_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    pattern_id: Mapped[int] = mapped_column(ForeignKey("recurring_patterns.id"), index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    signal_count: Mapped[int] = mapped_column(Integer)
    share: Mapped[float] = mapped_column(Float)
    pattern: Mapped[RecurringPattern] = relationship(back_populates="patients")


class PatternService(Base):
    __tablename__ = "pattern_services"
    __table_args__ = (UniqueConstraint("pattern_id", "service_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    pattern_id: Mapped[int] = mapped_column(ForeignKey("recurring_patterns.id"), index=True)
    service_id: Mapped[int] = mapped_column(ForeignKey("medical_services.id"), index=True)
    signal_count: Mapped[int] = mapped_column(Integer)
    financial_significance: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    pattern: Mapped[RecurringPattern] = relationship(back_populates="services")


class PatternFactor(Base):
    __tablename__ = "pattern_factors"
    id: Mapped[int] = mapped_column(primary_key=True)
    pattern_id: Mapped[int] = mapped_column(ForeignKey("recurring_patterns.id"), index=True)
    factor_group: Mapped[str] = mapped_column(String(40), index=True)
    name: Mapped[str] = mapped_column(String(160))
    weight: Mapped[int] = mapped_column(Integer)
    normalized_value: Mapped[float] = mapped_column(Float)
    contribution: Mapped[int] = mapped_column(Integer)
    actual_value: Mapped[str] = mapped_column(String(180))
    typical_value: Mapped[str] = mapped_column(String(180))
    explanation: Mapped[str] = mapped_column(Text)
    pattern: Mapped[RecurringPattern] = relationship(back_populates="factors")


class PatternSnapshot(Base):
    __tablename__ = "pattern_snapshots"
    __table_args__ = (UniqueConstraint("pattern_id", "analysis_run_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    pattern_id: Mapped[int] = mapped_column(ForeignKey("recurring_patterns.id"), index=True)
    analysis_run_id: Mapped[int] = mapped_column(ForeignKey("analysis_runs.id"), index=True)
    signal_count: Mapped[int] = mapped_column(Integer)
    financial_significance: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    stability_score: Mapped[int] = mapped_column(Integer)
    importance_score: Mapped[int] = mapped_column(Integer)
    organization_count: Mapped[int] = mapped_column(Integer)
    patient_count: Mapped[int] = mapped_column(Integer)
    first_seen: Mapped[date] = mapped_column(Date)
    last_seen: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    pattern: Mapped[RecurringPattern] = relationship(back_populates="snapshots")


class PatternReview(Base):
    __tablename__ = "pattern_reviews"
    id: Mapped[int] = mapped_column(primary_key=True)
    pattern_id: Mapped[int] = mapped_column(ForeignKey("recurring_patterns.id"), index=True)
    status: Mapped[PatternReviewStatus] = mapped_column(
        Enum(
            PatternReviewStatus,
            values_callable=lambda items: [item.value for item in items],
        )
    )
    comment: Mapped[str] = mapped_column(Text, default="")
    reviewer_name: Mapped[str] = mapped_column(String(100), default="Эксперт Verimed")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    pattern: Mapped[RecurringPattern] = relationship(back_populates="reviews")


class ExpertDecisionEvent(Base):
    __tablename__ = "expert_decision_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    entity_type: Mapped[DecisionEntityType] = mapped_column(
        Enum(
            DecisionEntityType,
            values_callable=lambda items: [item.value for item in items],
        ),
        index=True,
    )
    entity_fingerprint: Mapped[str] = mapped_column(String(64), index=True)
    current_entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    analysis_run_id: Mapped[int | None] = mapped_column(
        ForeignKey("analysis_runs.id"), nullable=True, index=True
    )
    medical_organization_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    action_type: Mapped[str] = mapped_column(String(100), index=True)
    decision_status: Mapped[str] = mapped_column(String(100), index=True)
    reason_code: Mapped[str] = mapped_column(String(120), index=True)
    comment: Mapped[str] = mapped_column(Text, default="")
    reviewer_id: Mapped[str] = mapped_column(String(64), index=True)
    reviewer_display_name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, index=True)
    supersedes_event_id: Mapped[int | None] = mapped_column(
        ForeignKey("expert_decision_events.id"), nullable=True, index=True
    )
    metadata_json: Mapped[dict[str, str | int | float | bool | None]] = mapped_column(
        JSON, default=dict
    )
    event_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    previous_event_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    feedback: Mapped[ExpertFeedback | None] = relationship(
        back_populates="event", cascade="all, delete-orphan", uselist=False
    )


class ExpertFeedback(Base):
    __tablename__ = "expert_feedback"
    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(
        ForeignKey("expert_decision_events.id"), unique=True, index=True
    )
    usefulness: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    explanation_quality: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    data_sufficiency: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    priority_correctness: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    grouping_correctness: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    graph_usefulness: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    comment: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    event: Mapped[ExpertDecisionEvent] = relationship(back_populates="feedback")


class SignalFingerprintHistory(Base):
    __tablename__ = "signal_fingerprint_history"
    __table_args__ = (UniqueConstraint("entity_fingerprint", "analysis_run_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    entity_fingerprint: Mapped[str] = mapped_column(String(64), index=True)
    analysis_run_id: Mapped[int] = mapped_column(ForeignKey("analysis_runs.id"), index=True)
    current_signal_id: Mapped[int] = mapped_column(Integer, index=True)
    medical_record_id: Mapped[int] = mapped_column(Integer, index=True)
    medical_organization_id: Mapped[int] = mapped_column(Integer, index=True)
    anomaly_type: Mapped[str] = mapped_column(String(80), index=True)
    risk_score: Mapped[int] = mapped_column(Integer)
    priority_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    financial_significance: Mapped[Decimal | None] = mapped_column(Numeric(16, 2), nullable=True)
    status_at_run: Mapped[str] = mapped_column(String(100))
    context_signature: Mapped[dict[str, str | int | float | bool | None]] = mapped_column(JSON)
    appeared_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)


class PatternFingerprintHistory(Base):
    __tablename__ = "pattern_fingerprint_history"
    __table_args__ = (UniqueConstraint("entity_fingerprint", "analysis_run_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    entity_fingerprint: Mapped[str] = mapped_column(String(64), index=True)
    analysis_run_id: Mapped[int] = mapped_column(ForeignKey("analysis_runs.id"), index=True)
    current_pattern_id: Mapped[int] = mapped_column(Integer, index=True)
    pattern_type: Mapped[str] = mapped_column(String(80), index=True)
    stability_score: Mapped[int] = mapped_column(Integer)
    importance_score: Mapped[int] = mapped_column(Integer)
    financial_significance: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    signal_count: Mapped[int] = mapped_column(Integer)
    participant_signature: Mapped[dict[str, list[int] | str | int]] = mapped_column(JSON)
    status_at_run: Mapped[str] = mapped_column(String(100))
    appeared_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)


class DecisionJournalIntegrityCheck(Base):
    __tablename__ = "decision_journal_integrity_checks"
    id: Mapped[int] = mapped_column(primary_key=True)
    is_valid: Mapped[bool] = mapped_column(Boolean, index=True)
    checked_events: Mapped[int] = mapped_column(Integer)
    mismatch_count: Mapped[int] = mapped_column(Integer)
    details: Mapped[list[str]] = mapped_column(JSON, default=list)
    checked_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, index=True)
