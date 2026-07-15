import type { AnalysisMetric, AnalysisMetricByType, AnalyticsChanges, AnalyticsSummary, CommandCenter, DecisionEvent, DecisionHistory, DecisionJournalResponse, DistributionPoint, ExpertFeedback, ExpertReviewBreakdown, ExpertReviewSummary, FinancialImpact, FinancialImpactSummary, Finding, HomeAnalytics, IntegrityCheck, Methodology, OrganizationComparison, OrganizationDetail, OrganizationsResponse, OverviewAnalytics, PatternChanges, PatternDetail, PatternGraph, PatternsResponse, PatternReviewStatus, PatternSummary, PatternTimelinePoint, PriorityHistoryPoint, PrioritySummary, RecurrenceHistory, RecurringPattern, Signal, SignalDetail, SignalPreview, SignalsResponse, TimelinePoint, ReviewStatus } from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "/api").replace(/\/$/, "");
type RequestOptions = { ttlMs?: number; abortKey?: string };
type CachedResponse = { expiresAt: number; value: unknown };
const responseCache = new Map<string, CachedResponse>();
const pendingRequests = new Map<string, Promise<unknown>>();
const activeControllers = new Map<string, AbortController>();

export function clearApiCache() {
  responseCache.clear();
}

async function request<T>(path: string, init?: RequestInit, options: RequestOptions = {}): Promise<T> {
  const method = init?.method ?? "GET";
  const url = `${API_URL}${path}`;
  const isGet = method === "GET";
  const now = Date.now();
  const cached = isGet ? responseCache.get(url) : undefined;
  if (cached && cached.expiresAt > now) return cached.value as T;
  if (cached) responseCache.delete(url);
  const pending = isGet ? pendingRequests.get(url) : undefined;
  if (pending) return pending as Promise<T>;

  let controller: AbortController | undefined;
  if (options.abortKey && typeof AbortController !== "undefined") {
    activeControllers.get(options.abortKey)?.abort();
    controller = new AbortController();
    activeControllers.set(options.abortKey, controller);
  }

  const promise = (async () => {
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      cache: options.ttlMs ? "default" : "no-store",
      signal: controller?.signal ?? init?.signal,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { detail?: string };
      throw new Error(payload.detail ?? "Не удалось загрузить данные");
    }
    const value = await response.json() as T;
    if (isGet && options.ttlMs) responseCache.set(url, { expiresAt: now + options.ttlMs, value });
    if (!isGet) clearApiCache();
    return value;
  })();
  if (isGet) pendingRequests.set(url, promise);
  try {
    return await promise;
  } finally {
    if (isGet && pendingRequests.get(url) === promise) pendingRequests.delete(url);
    if (options.abortKey && activeControllers.get(options.abortKey) === controller) activeControllers.delete(options.abortKey);
  }
}
export const api = {
  home: () => request<HomeAnalytics>("/analytics/home", undefined, { ttlMs: 30_000 }),
  overview: () => request<OverviewAnalytics>("/analytics/overview", undefined, { ttlMs: 30_000 }),
  summary: () => request<AnalyticsSummary>("/analytics/summary", undefined, { ttlMs: 300_000 }),
  commandCenter: () => request<CommandCenter>("/analytics/command-center"),
  changes: () => request<AnalyticsChanges>("/analytics/changes"),
  financialImpact: () => request<FinancialImpactSummary>("/analytics/financial-impact"),
  prioritySummary: () => request<PrioritySummary>("/analytics/priority-summary"),
  riskDistribution: () => request<DistributionPoint[]>("/analytics/risk-distribution", undefined, { ttlMs: 300_000 }),
  timeline: () => request<TimelinePoint[]>("/analytics/timeline", undefined, { ttlMs: 300_000 }),
  findings: () => request<Finding[]>("/analytics/key-findings", undefined, { ttlMs: 300_000 }),
  analysisMetrics: () => request<AnalysisMetric>("/analysis/metrics", undefined, { ttlMs: 300_000 }),
  analysisMetricsByType: () => request<AnalysisMetricByType[]>("/analysis/metrics/by-anomaly-type", undefined, { ttlMs: 300_000 }),
  organizations: (params = "") => request<OrganizationsResponse>(`/organizations${params ? `?${params}` : ""}`, undefined, { ttlMs: 30_000, abortKey: "organizations-list" }),
  organization: (id: string) => request<OrganizationDetail>(`/organizations/${id}`, undefined, { ttlMs: 30_000 }),
  organizationComparison: (id: string) => request<OrganizationComparison>(`/organizations/${id}/comparison`, undefined, { ttlMs: 300_000 }),
  organizationFinancialImpact: (id: string) => request<FinancialImpact>(`/organizations/${id}/financial-impact`),
  organizationPriorityHistory: (id: string) => request<PriorityHistoryPoint[]>(`/organizations/${id}/priority-history`, undefined, { ttlMs: 300_000 }),
  organizationPatterns: (id: string) => request<RecurringPattern[]>(`/organizations/${id}/patterns`, undefined, { ttlMs: 30_000 }),
  signals: (params = "") => request<SignalsResponse>(`/signals${params ? `?${params}` : ""}`, undefined, { ttlMs: 30_000, abortKey: "signals-list" }),
  signal: (id: string) => request<SignalDetail>(`/signals/${id}`, undefined, { ttlMs: 30_000 }),
  signalPreview: (id: number) => request<SignalPreview>(`/signals/${id}/preview`, undefined, { ttlMs: 30_000 }),
  signalPatterns: (id: string | number) => request<RecurringPattern[]>(`/signals/${id}/patterns`, undefined, { ttlMs: 60_000 }),
  review: (id: number, status: ReviewStatus, comment: string, reasonCode?: string) => request<SignalDetail>(`/signals/${id}/review`, { method: "POST", body: JSON.stringify({ status, comment, reason_code: reasonCode, reviewer_name: "Айдана Сарсенова" }) }),
  signalDecisionHistory: (id: string | number) => request<DecisionHistory>(`/signals/${id}/decision-history`),
  signalRecurrenceHistory: (id: string | number) => request<RecurrenceHistory>(`/signals/${id}/recurrence-history`),
  signalDecisionEvent: (id: string | number, payload: { action_type: string; decision_status: string; reason_code: string; comment: string; supersedes_event_id?: number; feedback?: Partial<ExpertFeedback> }) => request<DecisionEvent>(`/signals/${id}/decision-events`, { method: "POST", body: JSON.stringify({ ...payload, reviewer_id: "expert-001", reviewer_display_name: "Айдана Сарсенова" }) }),
  methodology: () => request<Methodology>("/methodology", undefined, { ttlMs: 300_000 }),
  patterns: (params = "") => request<PatternsResponse>(`/patterns${params ? `?${params}` : ""}`, undefined, { ttlMs: 30_000, abortKey: "patterns-list" }),
  pattern: (id: string) => request<PatternDetail>(`/patterns/${id}`, undefined, { ttlMs: 30_000 }),
  patternSignals: (id: string) => request<Signal[]>(`/patterns/${id}/signals`, undefined, { ttlMs: 30_000 }),
  patternGraph: (id: string, limit = 60) => request<PatternGraph>(`/patterns/${id}/graph?limit=${limit}`, undefined, { ttlMs: 300_000 }),
  patternTimeline: (id: string) => request<PatternTimelinePoint[]>(`/patterns/${id}/timeline`, undefined, { ttlMs: 300_000 }),
  patternSummary: () => request<PatternSummary>("/analytics/pattern-summary"),
  patternChanges: () => request<PatternChanges>("/analytics/pattern-changes"),
  reviewPattern: (id: number, status: PatternReviewStatus, comment: string, reasonCode?: string) => request<PatternDetail>(`/patterns/${id}/review`, { method: "POST", body: JSON.stringify({ status, comment, reason_code: reasonCode, reviewer_name: "Айдана Сарсенова" }) }),
  patternDecisionHistory: (id: string | number) => request<DecisionHistory>(`/patterns/${id}/decision-history`),
  patternRecurrenceHistory: (id: string | number) => request<RecurrenceHistory>(`/patterns/${id}/recurrence-history`),
  patternDecisionEvent: (id: string | number, payload: { action_type: string; decision_status: string; reason_code: string; comment: string; supersedes_event_id?: number; feedback?: Partial<ExpertFeedback> }) => request<DecisionEvent>(`/patterns/${id}/decision-events`, { method: "POST", body: JSON.stringify({ ...payload, reviewer_id: "expert-001", reviewer_display_name: "Айдана Сарсенова" }) }),
  decisionJournal: (params = "") => request<DecisionJournalResponse>(`/decision-journal${params ? `?${params}` : ""}`, undefined, { ttlMs: 10_000, abortKey: "decision-journal" }),
  journalIntegrity: () => request<IntegrityCheck>("/decision-journal/integrity"),
  expertReviewSummary: () => request<ExpertReviewSummary>("/analytics/expert-review-summary"),
  expertReviewBySignalType: () => request<ExpertReviewBreakdown[]>("/analytics/expert-review-by-signal-type"),
  expertReviewByPatternType: () => request<ExpertReviewBreakdown[]>("/analytics/expert-review-by-pattern-type")
};
