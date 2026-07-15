from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models import DecisionEntityType, PatternReviewStatus, ReviewStatus, RiskLevel

DECISION_REASON_CODES = {
    "данные подтверждают отклонение",
    "повторяемость требует дополнительного внимания",
    "существенная финансовая значимость",
    "подтверждено сопоставлением с документами",
    "подтверждено медицинским экспертом",
    "медицински обоснованная услуга",
    "неполные исходные данные",
    "ошибка исходных данных",
    "допустимое организационное отклонение",
    "недостаточная сопоставимая группа",
    "сигнал сформирован ошибочно",
    "требуется запрос документов",
    "требуется клиническая экспертиза",
    "требуется проверка организации",
    "требуется проверка связанных сигналов",
    "требуется дополнительная выборка данных",
    "иная причина",
}


class ApiModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class HealthStatus(ApiModel):
    status: Literal["ok", "error"]
    storage_mode: Literal["showcase_sqlite", "postgres", "local_sqlite"]
    database_ready: bool
    snapshot_ready: bool
    data_version: str | None


class Metric(ApiModel):
    label: str
    value: int | float | str
    change_percent: float
    explanation: str
    trend: str


class AnalysisInfo(ApiModel):
    period: str
    organizations_count: int
    records_count: int
    last_analysis_at: datetime
    processing_status: str


class PriorityInfo(ApiModel):
    high_risk_signals: int
    review_amount: Decimal
    top_organization_id: int
    top_organization: str


class AnalyticsSummary(ApiModel):
    analysis: AnalysisInfo
    priority: PriorityInfo
    metrics: list[Metric]


class PriorityOrganization(ApiModel):
    id: int
    name: str
    high_risk_signals: int
    review_amount: Decimal
    risk_score: int
    priority_score: int
    priority_level: RiskLevel
    main_reason: str
    summary: str


class PrioritySignalSummary(ApiModel):
    id: int
    organization_name: str
    service_name: str
    priority_score: int
    priority_level: RiskLevel
    financial_significance: Decimal


class CommandCenter(ApiModel):
    new_high_critical_signals: int
    high_risk_organizations: int
    review_amount: Decimal
    signals_without_decision: int
    last_analysis_at: datetime | None
    comparison_available: bool
    priority_organization: PriorityOrganization | None
    high_critical_amount: Decimal
    potential_review_amount: Decimal
    priority_patients: int
    top_financial_signal: PrioritySignalSummary | None


class AnalyticsChanges(ApiModel):
    comparison_available: bool
    current_run_id: int | None
    previous_run_id: int | None
    new_signals: int
    resolved_signals: int
    organizations_risk_increased: int
    organizations_risk_decreased: int
    review_amount_change: Decimal
    completed_reviews: int
    selected_for_review_rate_change: float


class DistributionPoint(ApiModel):
    name: str
    value: int | float
    amount: Decimal = Decimal("0")


class TimelinePoint(ApiModel):
    period: str
    services: int
    amount: Decimal
    signals: int


class Finding(ApiModel):
    title: str
    description: str
    severity: str


class OrganizationListItem(ApiModel):
    id: int
    name: str
    region: str
    organization_type: str
    services_count: int
    total_amount: Decimal
    signals_count: int
    risk_score: int
    risk_level: RiskLevel
    primary_reason: str
    review_status: ReviewStatus
    priority_score: int | None
    priority_level: RiskLevel | None
    financial_significance: Decimal | None
    affected_patients: int | None
    unreviewed_share: float | None
    priority_factors: list["PriorityFactorItem"]
    priority_history: list["PriorityHistoryPoint"]


class PaginatedOrganizations(ApiModel):
    items: list[OrganizationListItem]
    total: int
    page: int
    page_size: int
    regions: list[str]
    organization_types: list[str]


class OrganizationDetail(OrganizationListItem):
    comparison: str
    timeline: list[TimelinePoint]
    service_structure: list[DistributionPoint]
    risk_distribution: list[DistributionPoint]
    deviations: list[Finding]
    recent_signals: list["SignalListItem"]
    review_history: list["ReviewItem"]
    high_critical_amount: Decimal | None
    confirmed_amount: Decimal | None
    rejected_amount: Decimal | None
    unreviewed_amount: Decimal | None
    signal_amount_share: float | None
    priority_change: int | None
    financial_change: Decimal | None


class RiskFactorItem(ApiModel):
    name: str
    contribution: int
    actual_value: str
    typical_value: str
    explanation: str


class PriorityFactorItem(ApiModel):
    name: str
    weight: int
    normalized_value: float
    contribution: int
    actual_value: str
    typical_value: str
    explanation: str


class PriorityHistoryPoint(ApiModel):
    analysis_run_id: int
    period: str
    value: int
    level: RiskLevel
    financial_significance: Decimal


class ReviewItem(ApiModel):
    id: int
    status: ReviewStatus
    comment: str
    reviewer_name: str
    created_at: datetime


class SignalListItem(ApiModel):
    id: int
    date: date
    organization_id: int
    organization_name: str
    patient_code: str
    service_name: str
    amount: Decimal
    score: int
    level: RiskLevel
    primary_reason: str
    anomaly_type: str
    status: ReviewStatus
    region: str
    priority_score: int | None
    priority_level: RiskLevel | None
    financial_significance: Decimal | None
    priority_factors: list[PriorityFactorItem]
    priority_explanation: str | None
    fingerprint: str | None = None


class PaginatedSignals(ApiModel):
    items: list[SignalListItem]
    total: int
    page: int
    page_size: int
    anomaly_types: list[str]


class RelatedService(ApiModel):
    record_id: int
    date: date
    time: str
    name: str
    amount: Decimal
    organization_name: str
    related_signal_id: int | None = None
    relationship_explanation: str


class SignalDetail(SignalListItem):
    organization_type: str
    rule_score: float
    organization_score: float
    financial_score: float
    factors: list[RiskFactorItem]
    related_services: list[RelatedService]
    reviews: list[ReviewItem]
    limitations: list[str]
    recommendation: str
    repetition_count: int | None
    affected_patients: int | None
    duration_days: int | None


class SignalPreview(SignalDetail):
    pass


class ReviewCreate(ApiModel):
    status: ReviewStatus
    comment: str = Field(default="", max_length=2000)
    reviewer_name: str = Field(default="Эксперт Verimed", min_length=2, max_length=100)
    reason_code: str = Field(default="иная причина", min_length=2, max_length=120)
    reviewer_id: str = Field(default="expert-001", min_length=2, max_length=64)
    supersedes_event_id: int | None = None
    feedback: "ExpertFeedbackCreate | None" = None

    @model_validator(mode="after")
    def require_rejection_comment(self) -> "ReviewCreate":
        if self.status == ReviewStatus.REJECTED and not self.comment.strip():
            raise ValueError("Для отклонения сигнала добавьте комментарий")
        return self


class MethodologySection(ApiModel):
    title: str
    description: str
    items: list[str]


class Methodology(ApiModel):
    title: str
    introduction: str
    sections: list[MethodologySection]
    disclaimer: str


class AnalysisMetricItem(ApiModel):
    precision: float
    recall: float
    f1: float
    false_positive_rate: float
    true_positive_count: int
    false_positive_count: int
    false_negative_count: int
    selected_for_review_rate: float
    manual_review_reduction: float


class AnalysisMetricByType(AnalysisMetricItem):
    anomaly_type: str
    anomaly_label: str


class AnalysisRunRequest(ApiModel):
    seed: int = Field(default=20260712, ge=1, le=2_147_483_647)


class AnalysisExecutionResponse(ApiModel):
    analysis_run_id: int
    status: str
    random_seed: int
    records_processed: int
    anomalies_injected: int
    signals_created: int
    metrics: AnalysisMetricItem


class FinancialImpactItem(ApiModel):
    scope_type: str
    scope_key: str
    total_services_amount: Decimal
    signal_services_amount: Decimal
    high_critical_amount: Decimal
    confirmed_amount: Decimal
    rejected_amount: Decimal
    unreviewed_amount: Decimal
    affected_records: int
    affected_patients: int
    signal_amount_share: float
    disclaimer: str


class FinancialImpactSummary(ApiModel):
    analysis_run_id: int | None
    period: FinancialImpactItem | None
    by_region: list[FinancialImpactItem]
    by_anomaly_type: list[FinancialImpactItem]


class PrioritySummary(ApiModel):
    analysis_run_id: int | None
    top_organization: PriorityOrganization | None
    top_signal: PrioritySignalSummary | None
    critical_priority_signals: int
    high_priority_signals: int


class OrganizationComparisonItem(ApiModel):
    metric_key: str
    metric_label: str
    value: float
    peer_median: float
    typical_low: float
    typical_high: float
    deviation_percent: float
    position: int
    peer_group_size: int
    reliability: str
    limitation: str
    explanation: str


class OrganizationComparison(ApiModel):
    organization_id: int
    analysis_run_id: int | None
    items: list[OrganizationComparisonItem]
    peer_group_size: int
    reliability: str
    limitation: str


class PatternFactorItem(ApiModel):
    factor_group: str
    name: str
    weight: int
    normalized_value: float
    contribution: int
    actual_value: str
    typical_value: str
    explanation: str


class PatternParticipant(ApiModel):
    id: int
    label: str
    signal_count: int
    financial_significance: Decimal | None = None
    share: float | None = None
    is_primary: bool = False


class PatternReviewItem(ApiModel):
    id: int
    status: PatternReviewStatus
    comment: str
    reviewer_name: str
    created_at: datetime


class PatternListItem(ApiModel):
    id: int
    fingerprint: str
    name: str
    pattern_type: str
    pattern_type_label: str
    description: str
    first_seen: date
    last_seen: date
    period_count: int
    signal_count: int
    organization_count: int
    doctor_count: int
    patient_count: int
    service_count: int
    financial_significance: Decimal
    average_risk: float
    average_priority: float
    stability_score: int
    stability_level: str
    importance_score: int
    importance_level: RiskLevel
    review_status: PatternReviewStatus
    formed_at: datetime
    main_organization: str | None
    primary_reason: str


class PaginatedPatterns(ApiModel):
    items: list[PatternListItem]
    total: int
    page: int
    page_size: int
    pattern_types: list[str]
    organizations: list[PatternParticipant]


class PatternDetail(PatternListItem):
    recurrence_runs: int
    explanation: str
    disclaimer: str
    limitations: list[str]
    factors: list[PatternFactorItem]
    organizations: list[PatternParticipant]
    doctors: list[PatternParticipant]
    patients: list[PatternParticipant]
    services: list[PatternParticipant]
    reviews: list[PatternReviewItem]


class PatternTimelinePoint(ApiModel):
    period: str
    signal_count: int
    financial_significance: Decimal


class PatternGraphNode(ApiModel):
    id: str
    node_type: str
    label: str
    subtitle: str
    size: float
    signal_count: int
    financial_significance: Decimal
    href: str | None = None
    is_primary: bool = False


class PatternGraphEdge(ApiModel):
    id: str
    source: str
    target: str
    relationship: str
    weight: float


class PatternGraph(ApiModel):
    pattern_id: int
    nodes: list[PatternGraphNode]
    edges: list[PatternGraphEdge]
    hidden_nodes: int
    legend: dict[str, str]


class PatternSummary(ApiModel):
    analysis_run_id: int | None
    total_patterns: int
    high_stability_patterns: int
    financial_significance: Decimal
    affected_organizations: int
    stable_pattern_organizations: int
    affected_patients: int
    new_patterns: int
    top_importance_pattern: PatternListItem | None
    top_financial_pattern: PatternListItem | None
    attention_patterns: list[PatternListItem]
    disclaimer: str


class PatternChanges(ApiModel):
    comparison_available: bool
    current_run_id: int | None
    previous_run_id: int | None
    new_patterns: int
    recurring_patterns: int
    disappeared_patterns: int
    importance_increased: int
    importance_decreased: int


class PatternReviewCreate(ApiModel):
    status: PatternReviewStatus
    comment: str = Field(default="", max_length=2000)
    reviewer_name: str = Field(default="Эксперт Verimed", min_length=2, max_length=100)
    reason_code: str = Field(default="иная причина", min_length=2, max_length=120)
    reviewer_id: str = Field(default="expert-001", min_length=2, max_length=64)
    supersedes_event_id: int | None = None
    feedback: "ExpertFeedbackCreate | None" = None

    @model_validator(mode="after")
    def require_insignificant_comment(self) -> "PatternReviewCreate":
        if self.status == PatternReviewStatus.INSIGNIFICANT and not self.comment.strip():
            raise ValueError("Чтобы отметить модель как несущественную, добавьте комментарий")
        return self


class PatternBuildResponse(ApiModel):
    analysis_run_id: int
    patterns_built: int
    recurring_patterns: int
    pattern_types: dict[str, int]


class ExpertFeedbackCreate(ApiModel):
    usefulness: str | None = None
    explanation_quality: str | None = None
    data_sufficiency: str | None = None
    priority_correctness: str | None = None
    grouping_correctness: str | None = None
    graph_usefulness: str | None = None
    comment: str = Field(default="", max_length=2000)


class ExpertFeedbackItem(ExpertFeedbackCreate):
    id: int
    created_at: datetime


class DecisionEventCreate(ApiModel):
    action_type: str = Field(min_length=2, max_length=100)
    decision_status: str = Field(min_length=2, max_length=100)
    reason_code: str = Field(min_length=2, max_length=120)
    comment: str = Field(default="", max_length=2000)
    reviewer_id: str = Field(default="expert-001", min_length=2, max_length=64)
    reviewer_display_name: str = Field(default="Эксперт Verimed", min_length=2, max_length=100)
    supersedes_event_id: int | None = None
    feedback: ExpertFeedbackCreate | None = None

    @model_validator(mode="after")
    def validate_decision(self) -> "DecisionEventCreate":
        if self.reason_code not in DECISION_REASON_CODES:
            raise ValueError("Выберите причину из доступного списка")
        if self.reason_code == "иная причина" and not self.comment.strip():
            raise ValueError("Для иной причины добавьте комментарий")
        if (
            self.decision_status
            in {
                ReviewStatus.REJECTED.value,
                PatternReviewStatus.INSIGNIFICANT.value,
            }
            and not self.comment.strip()
        ):
            raise ValueError("Для выбранного решения добавьте комментарий")
        if self.action_type == "Решение уточнено" and self.supersedes_event_id is None:
            raise ValueError("Укажите решение, которое уточняется")
        return self


class DecisionEventItem(ApiModel):
    id: int
    entity_type: DecisionEntityType
    entity_fingerprint: str
    current_entity_id: int | None
    object_present: bool
    analysis_run_id: int | None
    medical_organization_id: int | None
    action_type: str
    decision_status: str
    reason_code: str
    comment: str
    reviewer_display_name: str
    created_at: datetime
    supersedes_event_id: int | None
    metadata: dict[str, str | int | float | bool | None]
    feedback: ExpertFeedbackItem | None = None


class DecisionHistory(ApiModel):
    entity_type: DecisionEntityType
    entity_fingerprint: str
    current_status: str | None
    history_found: bool
    events: list[DecisionEventItem]


class DecisionJournalPage(ApiModel):
    items: list[DecisionEventItem]
    total: int
    page: int
    page_size: int
    reviewers: list[str]
    actions: list[str]
    decision_statuses: list[str]
    organizations: list["JournalFilterOption"]
    object_types: list["JournalStringFilterOption"]
    analysis_runs: list[int]


class JournalFilterOption(ApiModel):
    id: int
    label: str


class JournalStringFilterOption(ApiModel):
    value: str
    label: str


class RecurrencePoint(ApiModel):
    analysis_run_id: int
    appeared_at: datetime
    risk_score: int | None = None
    priority_score: int | None = None
    stability_score: int | None = None
    importance_score: int | None = None
    financial_significance: Decimal | None = None
    signal_count: int | None = None
    status: str
    participant_signature: dict[str, list[int] | str | int] | None = None


class RecurrenceHistory(ApiModel):
    entity_fingerprint: str
    first_detected_at: datetime | None
    last_detected_at: datetime | None
    appeared_runs: int
    absent_runs: int
    last_expert_status: str | None
    points: list[RecurrencePoint]


class IntegrityCheckResult(ApiModel):
    is_valid: bool
    checked_events: int
    mismatch_count: int
    details: list[str]
    checked_at: datetime
    message: str


class ExpertReviewSummary(ApiModel):
    reviewed_signals: int
    reviewed_patterns: int
    confirmed_share: float | None
    rejected_share: float | None
    escalated_share: float | None
    average_first_decision_hours: float | None
    average_completion_hours: float | None
    signals_without_decision: int
    patterns_without_decision: int
    in_progress: int
    completed_current_period: int
    sample_sufficient: bool
    sample_message: str | None
    usefulness_distribution: dict[str, int]
    explanation_quality_distribution: dict[str, int]
    priority_correctness_distribution: dict[str, int]


class ExpertReviewBreakdownItem(ApiModel):
    category: str
    total: int
    confirmed: int
    rejected: int
    escalated: int


class PatternTypeDistribution(ApiModel):
    label: str
    value: int
    percent: float


class RegionalLeadingOrganization(ApiModel):
    id: int
    name: str
    priority_score: int


class RegionalMonitoringItem(ApiModel):
    region_name: str
    region_code: str
    signal_count: int
    unique_record_count: int
    financial_significance: Decimal
    organization_count: int
    maximum_priority: int
    leading_organization: RegionalLeadingOrganization | None = None


StrictSignalId = Annotated[int, Field(strict=True, gt=0)]


class SignalExportSelection(ApiModel):
    signal_ids: list[StrictSignalId] = Field(max_length=1000)

    @field_validator("signal_ids", mode="before")
    @classmethod
    def require_signal_ids(cls, value: object) -> object:
        if not isinstance(value, list) or not value:
            raise ValueError("Выберите хотя бы один сигнал")
        return value

    @field_validator("signal_ids")
    @classmethod
    def deduplicate_signal_ids(cls, value: list[int]) -> list[int]:
        return list(dict.fromkeys(value))


class HomeAnalytics(ApiModel):
    schema_version: int
    summary: AnalyticsSummary
    command_center: CommandCenter
    changes: AnalyticsChanges
    risk_distribution: list[DistributionPoint]
    timeline: list[TimelinePoint]
    findings: list[Finding]
    quality: AnalysisMetricItem
    pattern_summary: PatternSummary
    expert_review: ExpertReviewSummary
    priority_organizations: PaginatedOrganizations


class OverviewAnalytics(ApiModel):
    schema_version: int
    summary: AnalyticsSummary
    command_center: CommandCenter
    changes: AnalyticsChanges
    priority_summary: PrioritySummary
    pattern_summary: PatternSummary
    pattern_changes: PatternChanges
    pattern_distribution: list[PatternTypeDistribution]
    quality: AnalysisMetricItem
    expert_review: ExpertReviewSummary
    timeline: list[TimelinePoint] = Field(default_factory=list)
    regional_monitoring: list[RegionalMonitoringItem] = Field(default_factory=list)


OrganizationDetail.model_rebuild()
OrganizationListItem.model_rebuild()
ReviewCreate.model_rebuild()
PatternReviewCreate.model_rebuild()
DecisionJournalPage.model_rebuild()
