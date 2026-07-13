import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AnalyticsPage from "@/app/page";
import { commandCenterFixture, patternSummaryFixture } from "@/components/__tests__/fixtures";

const ready = (data: unknown) => ({data, loading: false, error: null, retry: vi.fn(), setData: vi.fn()});
const response = ready({
  schema_version: 1,
  summary: {analysis: {period: "01.01–30.06.2026", organizations_count: 20, records_count: 15000, last_analysis_at: "2026-07-12T09:30:00", processing_status: "Обработка завершена"}, priority: {high_risk_signals: 47, review_amount: "12400000", top_organization_id: 4, top_organization: "Центр диагностики № 4"}, metrics: []},
  command_center: commandCenterFixture,
  changes: {comparison_available: false, current_run_id: 1, previous_run_id: null, new_signals: 0, resolved_signals: 0, organizations_risk_increased: 0, organizations_risk_decreased: 0, review_amount_change: "0", completed_reviews: 0, selected_for_review_rate_change: 0},
  risk_distribution: [], timeline: [], findings: [],
  quality: {precision: 0.8, recall: 0.7, f1: 0.75, selected_for_review_rate: 0.08},
  pattern_summary: patternSummaryFixture,
  expert_review: {reviewed_signals: 0, reviewed_patterns: 0, confirmed_share: null, rejected_share: null, escalated_share: null, average_first_decision_hours: null, average_completion_hours: null, signals_without_decision: 11, patterns_without_decision: 2, in_progress: 4, completed_current_period: 6, sample_sufficient: false, sample_message: "Недостаточно экспертных решений для устойчивого вывода.", usefulness_distribution: {}, explanation_quality_distribution: {}, priority_correctness_distribution: {}},
  priority_organizations: {items: [{id: 4, name: "Центр диагностики № 4", region: "Астана", signals_count: 38, priority_score: 91, priority_level: "Критический", financial_significance: "12400000"}], total: 1, page: 1, page_size: 3, regions: [], organization_types: []},
});

vi.mock("@/hooks/use-api", () => ({useApi: () => response}));
vi.mock("@/components/charts", () => ({RiskDonut: () => null, TimelineChart: () => null}));

describe("сокращённая сводная аналитика", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("оставляет приоритетные блоки на первом уровне и закрывает подробности", () => {
    render(<AnalyticsPage/>);
    expect(screen.getByText("Требуют внимания")).toBeInTheDocument();
    expect(screen.getByText("Что изменилось")).toBeInTheDocument();
    expect(screen.getByText("Приоритетные медицинские организации")).toBeInTheDocument();
    expect(screen.getByText("Повторяющиеся модели, требующие внимания")).toBeInTheDocument();
    expect(screen.queryByText("Следующее действие")).not.toBeInTheDocument();
    const details = screen.getByText("Подробная аналитика").closest("details");
    expect(details).not.toHaveAttribute("open");
  });
});
