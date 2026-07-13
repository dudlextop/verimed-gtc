import type { AnalysisMetric, AnalysisMetricByType, AnalyticsChanges, AnalyticsSummary, CommandCenter, DecisionEvent, DecisionHistory, DecisionJournalResponse, DistributionPoint, ExpertFeedback, ExpertReviewBreakdown, ExpertReviewSummary, FinancialImpact, FinancialImpactSummary, Finding, IntegrityCheck, Methodology, OrganizationComparison, OrganizationDetail, OrganizationsResponse, PatternChanges, PatternDetail, PatternGraph, PatternsResponse, PatternReviewStatus, PatternSummary, PatternTimelinePoint, PriorityHistoryPoint, PrioritySummary, RecurrenceHistory, RecurringPattern, Signal, SignalDetail, SignalPreview, SignalsResponse, TimelinePoint, ReviewStatus } from "./types";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "/api").replace(/\/$/, "");
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", ...init?.headers }, cache: "no-store" });
  if (!response.ok) { const payload = await response.json().catch(() => ({})) as { detail?: string }; throw new Error(payload.detail ?? "Не удалось загрузить данные"); }
  return response.json() as Promise<T>;
}
export const api = {
  summary: () => request<AnalyticsSummary>("/analytics/summary"),
  commandCenter: () => request<CommandCenter>("/analytics/command-center"),
  changes: () => request<AnalyticsChanges>("/analytics/changes"),
  financialImpact: () => request<FinancialImpactSummary>("/analytics/financial-impact"),
  prioritySummary: () => request<PrioritySummary>("/analytics/priority-summary"),
  riskDistribution: () => request<DistributionPoint[]>("/analytics/risk-distribution"),
  timeline: () => request<TimelinePoint[]>("/analytics/timeline"),
  findings: () => request<Finding[]>("/analytics/key-findings"),
  analysisMetrics: () => request<AnalysisMetric>("/analysis/metrics"),
  analysisMetricsByType: () => request<AnalysisMetricByType[]>("/analysis/metrics/by-anomaly-type"),
  organizations: (params = "") => request<OrganizationsResponse>(`/organizations${params ? `?${params}` : ""}`),
  organization: (id: string) => request<OrganizationDetail>(`/organizations/${id}`),
  organizationComparison: (id: string) => request<OrganizationComparison>(`/organizations/${id}/comparison`),
  organizationFinancialImpact: (id: string) => request<FinancialImpact>(`/organizations/${id}/financial-impact`),
  organizationPriorityHistory: (id: string) => request<PriorityHistoryPoint[]>(`/organizations/${id}/priority-history`),
  organizationPatterns: (id: string) => request<RecurringPattern[]>(`/organizations/${id}/patterns`),
  signals: (params = "") => request<SignalsResponse>(`/signals${params ? `?${params}` : ""}`),
  signal: (id: string) => request<SignalDetail>(`/signals/${id}`),
  signalPreview: (id: number) => request<SignalPreview>(`/signals/${id}/preview`),
  signalPatterns: (id: string | number) => request<RecurringPattern[]>(`/signals/${id}/patterns`),
  review: (id: number, status: ReviewStatus, comment: string, reasonCode?: string) => request<SignalDetail>(`/signals/${id}/review`, { method: "POST", body: JSON.stringify({ status, comment, reason_code: reasonCode, reviewer_name: "Айдана Сарсенова" }) }),
  signalDecisionHistory: (id: string | number) => request<DecisionHistory>(`/signals/${id}/decision-history`),
  signalRecurrenceHistory: (id: string | number) => request<RecurrenceHistory>(`/signals/${id}/recurrence-history`),
  signalDecisionEvent: (id: string | number, payload: { action_type: string; decision_status: string; reason_code: string; comment: string; supersedes_event_id?: number; feedback?: Partial<ExpertFeedback> }) => request<DecisionEvent>(`/signals/${id}/decision-events`, { method: "POST", body: JSON.stringify({ ...payload, reviewer_id: "expert-001", reviewer_display_name: "Айдана Сарсенова" }) }),
  methodology: () => request<Methodology>("/methodology"),
  patterns: (params = "") => request<PatternsResponse>(`/patterns${params ? `?${params}` : ""}`),
  pattern: (id: string) => request<PatternDetail>(`/patterns/${id}`),
  patternSignals: (id: string) => request<Signal[]>(`/patterns/${id}/signals`),
  patternGraph: (id: string, limit = 60) => request<PatternGraph>(`/patterns/${id}/graph?limit=${limit}`),
  patternTimeline: (id: string) => request<PatternTimelinePoint[]>(`/patterns/${id}/timeline`),
  patternSummary: () => request<PatternSummary>("/analytics/pattern-summary"),
  patternChanges: () => request<PatternChanges>("/analytics/pattern-changes"),
  reviewPattern: (id: number, status: PatternReviewStatus, comment: string, reasonCode?: string) => request<PatternDetail>(`/patterns/${id}/review`, { method: "POST", body: JSON.stringify({ status, comment, reason_code: reasonCode, reviewer_name: "Айдана Сарсенова" }) }),
  patternDecisionHistory: (id: string | number) => request<DecisionHistory>(`/patterns/${id}/decision-history`),
  patternRecurrenceHistory: (id: string | number) => request<RecurrenceHistory>(`/patterns/${id}/recurrence-history`),
  patternDecisionEvent: (id: string | number, payload: { action_type: string; decision_status: string; reason_code: string; comment: string; supersedes_event_id?: number; feedback?: Partial<ExpertFeedback> }) => request<DecisionEvent>(`/patterns/${id}/decision-events`, { method: "POST", body: JSON.stringify({ ...payload, reviewer_id: "expert-001", reviewer_display_name: "Айдана Сарсенова" }) }),
  decisionJournal: (params = "") => request<DecisionJournalResponse>(`/decision-journal${params ? `?${params}` : ""}`),
  journalIntegrity: () => request<IntegrityCheck>("/decision-journal/integrity"),
  expertReviewSummary: () => request<ExpertReviewSummary>("/analytics/expert-review-summary"),
  expertReviewBySignalType: () => request<ExpertReviewBreakdown[]>("/analytics/expert-review-by-signal-type"),
  expertReviewByPatternType: () => request<ExpertReviewBreakdown[]>("/analytics/expert-review-by-pattern-type")
};
