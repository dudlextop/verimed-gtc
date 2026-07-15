export type RiskLevel = "Низкий" | "Средний" | "Высокий" | "Критический";
export type ReviewStatus = "Не проверено" | "На рассмотрении" | "Подтверждён сигнал" | "Сигнал не подтверждён" | "Требуются дополнительные сведения" | "Направлено на углублённую проверку" | "Проверка завершена";
export type PatternReviewStatus = "Не оценено" | "Значимость подтверждена" | "Отмечено как несущественное" | "Требуются дополнительные сведения" | "Направлено на углублённую проверку" | "Оценка завершена";
export interface Metric { label: string; value: number | string; change_percent: number; explanation: string; trend: string }
export interface AnalyticsSummary { analysis: { period: string; organizations_count: number; records_count: number; last_analysis_at: string; processing_status: string }; priority: { high_risk_signals: number; review_amount: string; top_organization_id: number; top_organization: string }; metrics: Metric[] }
export interface PriorityFactor { name: string; weight: number; normalized_value: number; contribution: number; actual_value: string; typical_value: string; explanation: string }
export interface PriorityHistoryPoint { analysis_run_id: number; period: string; value: number; level: RiskLevel; financial_significance: string }
export interface PriorityOrganization { id: number; name: string; high_risk_signals: number; review_amount: string; risk_score: number; priority_score: number; priority_level: RiskLevel; main_reason: string; summary: string }
export interface PrioritySignalSummary { id: number; organization_name: string; service_name: string; priority_score: number; priority_level: RiskLevel; financial_significance: string }
export interface CommandCenter { new_high_critical_signals: number; high_risk_organizations: number; review_amount: string; signals_without_decision: number; last_analysis_at: string | null; comparison_available: boolean; priority_organization: PriorityOrganization | null; high_critical_amount: string; potential_review_amount: string; priority_patients: number; top_financial_signal: PrioritySignalSummary | null }
export interface AnalyticsChanges { comparison_available: boolean; current_run_id: number | null; previous_run_id: number | null; new_signals: number; resolved_signals: number; organizations_risk_increased: number; organizations_risk_decreased: number; review_amount_change: string; completed_reviews: number; selected_for_review_rate_change: number }
export interface DistributionPoint { name: string; value: number; amount: string }
export interface TimelinePoint { period: string; services: number; amount: string; signals: number }
export interface Finding { title: string; description: string; severity: string }
export interface Organization { id: number; name: string; region: string; organization_type: string; services_count: number; total_amount: string; signals_count: number; risk_score: number; risk_level: RiskLevel; primary_reason: string; review_status: ReviewStatus; priority_score: number | null; priority_level: RiskLevel | null; financial_significance: string | null; affected_patients: number | null; unreviewed_share: number | null; priority_factors: PriorityFactor[]; priority_history: PriorityHistoryPoint[] }
export interface OrganizationsResponse { items: Organization[]; total: number; page: number; page_size: number; regions: string[]; organization_types: string[] }
export interface Signal { id: number; date: string; organization_id: number; organization_name: string; patient_code: string; service_name: string; amount: string; score: number; level: RiskLevel; primary_reason: string; anomaly_type: string; status: ReviewStatus; region: string; priority_score: number | null; priority_level: RiskLevel | null; financial_significance: string | null; priority_factors: PriorityFactor[]; priority_explanation: string | null; fingerprint?: string | null }
export interface SignalsResponse { items: Signal[]; total: number; page: number; page_size: number; anomaly_types: string[] }
export interface Review { id: number; status: ReviewStatus; comment: string; reviewer_name: string; created_at: string }
export interface OrganizationDetail extends Organization { comparison: string; timeline: TimelinePoint[]; service_structure: DistributionPoint[]; risk_distribution: DistributionPoint[]; deviations: Finding[]; recent_signals: Signal[]; review_history: Review[]; high_critical_amount: string | null; confirmed_amount: string | null; rejected_amount: string | null; unreviewed_amount: string | null; signal_amount_share: number | null; priority_change: number | null; financial_change: string | null }
export interface SignalDetail extends Signal { organization_type: string; rule_score: number; organization_score: number; financial_score: number; factors: { name: string; contribution: number; actual_value: string; typical_value: string; explanation: string }[]; related_services: { record_id: number; date: string; time: string; name: string; amount: string; organization_name: string; related_signal_id: number | null; relationship_explanation: string }[]; reviews: Review[]; limitations: string[]; recommendation: string; repetition_count: number | null; affected_patients: number | null; duration_days: number | null }
export type SignalPreview = SignalDetail;
export interface Methodology { title: string; introduction: string; sections: { title: string; description: string; items: string[] }[]; disclaimer: string }
export interface AnalysisMetric { precision: number; recall: number; f1: number; false_positive_rate: number; true_positive_count: number; false_positive_count: number; false_negative_count: number; selected_for_review_rate: number; manual_review_reduction: number }
export interface AnalysisMetricByType extends AnalysisMetric { anomaly_type: string; anomaly_label: string }
export interface FinancialImpact { scope_type: string; scope_key: string; total_services_amount: string; signal_services_amount: string; high_critical_amount: string; confirmed_amount: string; rejected_amount: string; unreviewed_amount: string; affected_records: number; affected_patients: number; signal_amount_share: number; disclaimer: string }
export interface FinancialImpactSummary { analysis_run_id: number | null; period: FinancialImpact | null; by_region: FinancialImpact[]; by_anomaly_type: FinancialImpact[] }
export interface PrioritySummary { analysis_run_id: number | null; top_organization: PriorityOrganization | null; top_signal: PrioritySignalSummary | null; critical_priority_signals: number; high_priority_signals: number }
export interface OrganizationComparisonItem { metric_key: string; metric_label: string; value: number; peer_median: number; typical_low: number; typical_high: number; deviation_percent: number; position: number; peer_group_size: number; reliability: string; limitation: string; explanation: string }
export interface OrganizationComparison { organization_id: number; analysis_run_id: number | null; items: OrganizationComparisonItem[]; peer_group_size: number; reliability: string; limitation: string }
export interface PatternFactor { factor_group: "Устойчивость" | "Важность" | string; name: string; weight: number; normalized_value: number; contribution: number; actual_value: string; typical_value: string; explanation: string }
export interface PatternParticipant { id: number; label: string; signal_count: number; financial_significance: string | null; share: number | null; is_primary: boolean }
export interface RecurringPattern { id: number; fingerprint: string; name: string; pattern_type: string; pattern_type_label: string; description: string; first_seen: string; last_seen: string; period_count: number; signal_count: number; organization_count: number; doctor_count: number; patient_count: number; service_count: number; financial_significance: string; average_risk: number; average_priority: number; stability_score: number; stability_level: "Низкая" | "Средняя" | "Высокая" | "Очень высокая"; importance_score: number; importance_level: RiskLevel; review_status: PatternReviewStatus; formed_at: string; main_organization: string | null; primary_reason: string }
export interface PatternsResponse { items: RecurringPattern[]; total: number; page: number; page_size: number; pattern_types: string[]; organizations: PatternParticipant[] }
export interface PatternReview { id: number; status: PatternReviewStatus; comment: string; reviewer_name: string; created_at: string }
export interface PatternDetail extends RecurringPattern { recurrence_runs: number; explanation: string; disclaimer: string; limitations: string[]; factors: PatternFactor[]; organizations: PatternParticipant[]; doctors: PatternParticipant[]; patients: PatternParticipant[]; services: PatternParticipant[]; reviews: PatternReview[] }
export interface PatternTimelinePoint { period: string; signal_count: number; financial_significance: string }
export interface PatternGraphNode { id: string; node_type: "pattern" | "organization" | "doctor" | "patient" | "service" | "signal"; label: string; subtitle: string; size: number; signal_count: number; financial_significance: string; href: string | null; is_primary: boolean }
export interface PatternGraphEdge { id: string; source: string; target: string; relationship: string; weight: number }
export interface PatternGraph { pattern_id: number; nodes: PatternGraphNode[]; edges: PatternGraphEdge[]; hidden_nodes: number; legend: Record<string, string> }
export interface PatternSummary { analysis_run_id: number | null; total_patterns: number; high_stability_patterns: number; financial_significance: string; affected_organizations: number; stable_pattern_organizations: number; affected_patients: number; new_patterns: number; top_importance_pattern: RecurringPattern | null; top_financial_pattern: RecurringPattern | null; attention_patterns: RecurringPattern[]; disclaimer: string }
export interface PatternChanges { comparison_available: boolean; current_run_id: number | null; previous_run_id: number | null; new_patterns: number; recurring_patterns: number; disappeared_patterns: number; importance_increased: number; importance_decreased: number }
export type DecisionEntityType = "signal" | "pattern";
export interface ExpertFeedback { id?: number; usefulness: string | null; explanation_quality: string | null; data_sufficiency: string | null; priority_correctness: string | null; grouping_correctness: string | null; graph_usefulness: string | null; comment: string; created_at?: string }
export interface DecisionEvent { id: number; entity_type: DecisionEntityType; entity_fingerprint: string; current_entity_id: number | null; object_present: boolean; analysis_run_id: number | null; medical_organization_id: number | null; action_type: string; decision_status: string; reason_code: string; comment: string; reviewer_display_name: string; created_at: string; supersedes_event_id: number | null; metadata: Record<string, string | number | boolean | null>; feedback: ExpertFeedback | null }
export interface DecisionHistory { entity_type: DecisionEntityType; entity_fingerprint: string; current_status: string | null; history_found: boolean; events: DecisionEvent[] }
export interface DecisionJournalResponse { items: DecisionEvent[]; total: number; page: number; page_size: number; reviewers: string[]; actions: string[]; decision_statuses: string[]; organizations: { id: number; label: string }[]; object_types: { value: string; label: string }[]; analysis_runs: number[] }
export interface RecurrencePoint { analysis_run_id: number; appeared_at: string; risk_score: number | null; priority_score: number | null; stability_score: number | null; importance_score: number | null; financial_significance: string | null; signal_count: number | null; status: string; participant_signature: Record<string, number[] | string | number> | null }
export interface RecurrenceHistory { entity_fingerprint: string; first_detected_at: string | null; last_detected_at: string | null; appeared_runs: number; absent_runs: number; last_expert_status: string | null; points: RecurrencePoint[] }
export interface IntegrityCheck { is_valid: boolean; checked_events: number; mismatch_count: number; details: string[]; checked_at: string; message: string }
export interface ExpertReviewSummary { reviewed_signals: number; reviewed_patterns: number; confirmed_share: number | null; rejected_share: number | null; escalated_share: number | null; average_first_decision_hours: number | null; average_completion_hours: number | null; signals_without_decision: number; patterns_without_decision: number; in_progress: number; completed_current_period: number; sample_sufficient: boolean; sample_message: string | null; usefulness_distribution: Record<string, number>; explanation_quality_distribution: Record<string, number>; priority_correctness_distribution: Record<string, number> }
export interface ExpertReviewBreakdown { category: string; total: number; confirmed: number; rejected: number; escalated: number }
export interface PatternTypeDistribution { label: string; value: number; percent: number }
export interface RegionalLeadingOrganization { id: number; name: string; priority_score: number }
export interface RegionalMonitoringItem { region_name: string; region_code: string; signal_count: number; unique_record_count: number; financial_significance: string; organization_count: number; maximum_priority: number; leading_organization: RegionalLeadingOrganization | null }
export interface HomeAnalytics {
  schema_version: number;
  summary: AnalyticsSummary;
  command_center: CommandCenter;
  changes: AnalyticsChanges;
  risk_distribution: DistributionPoint[];
  timeline: TimelinePoint[];
  findings: Finding[];
  quality: AnalysisMetric;
  pattern_summary: PatternSummary;
  expert_review: ExpertReviewSummary;
  priority_organizations: OrganizationsResponse;
}
export interface OverviewAnalytics {
  schema_version: number;
  summary: AnalyticsSummary;
  command_center: CommandCenter;
  changes: AnalyticsChanges;
  priority_summary: PrioritySummary;
  pattern_summary: PatternSummary;
  pattern_changes: PatternChanges;
  pattern_distribution: PatternTypeDistribution[];
  quality: AnalysisMetric;
  expert_review: ExpertReviewSummary;
  timeline?: TimelinePoint[];
  regional_monitoring?: RegionalMonitoringItem[];
}
