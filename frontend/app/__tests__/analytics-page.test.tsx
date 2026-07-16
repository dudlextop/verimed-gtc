import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AnalyticsPage from "@/app/page";
import { commandCenterFixture, patternSummaryFixture } from "@/components/__tests__/fixtures";

const ready = (data: unknown) => ({ data, loading: false, error: null as string | null, retry: vi.fn(), setData: vi.fn() });
const homeData = {
  schema_version: 1,
  summary: {
    analysis: { period: "01.01–30.06.2026", organizations_count: 20, records_count: 15000, last_analysis_at: "2026-07-12T09:30:00", processing_status: "Обработка завершена" },
    priority: { high_risk_signals: 47, review_amount: "12400000", top_organization_id: 4, top_organization: "Центр диагностики № 4" },
    metrics: [],
  },
  command_center: commandCenterFixture,
  changes: { comparison_available: false, current_run_id: 1, previous_run_id: null, new_signals: 0, resolved_signals: 0, organizations_risk_increased: 0, organizations_risk_decreased: 0, review_amount_change: "0", completed_reviews: 0, selected_for_review_rate_change: 0 },
  risk_distribution: [],
  timeline: [],
  findings: [{ title: "Приоритет проверки", description: "Рабочая выборка сформирована.", severity: "info" }],
  quality: { precision: 0.8, recall: 0.7, f1: 0.75, false_positive_rate: 0.02, true_positive_count: 100, false_positive_count: 20, false_negative_count: 10, selected_for_review_rate: 0.08, manual_review_reduction: 0.92 },
  pattern_summary: patternSummaryFixture,
  expert_review: { reviewed_signals: 0, reviewed_patterns: 0, confirmed_share: null, rejected_share: null, escalated_share: null, average_first_decision_hours: null, average_completion_hours: null, signals_without_decision: 11, patterns_without_decision: 2, in_progress: 4, completed_current_period: 6, sample_sufficient: false, sample_message: "Недостаточно экспертных решений для устойчивого вывода.", usefulness_distribution: {}, explanation_quality_distribution: {}, priority_correctness_distribution: {} },
  priority_organizations: {
    items: [{ id: 4, name: "Центр диагностики № 4", region: "Астана", organization_type: "Диагностический центр", services_count: 120, total_amount: "15000000", signals_count: 38, risk_score: 88, risk_level: "Критический", primary_reason: "Финансовая значимость", review_status: "Не проверено", priority_score: 91, priority_level: "Критический", financial_significance: "12400000", affected_patients: 20, unreviewed_share: 1, priority_factors: [], priority_history: [] }],
    total: 1, page: 1, page_size: 3, regions: [], organization_types: [],
  },
};

let apiState = ready(homeData);
vi.mock("@/hooks/use-api", () => ({ useApi: () => apiState }));

describe("сводная аналитика V2", () => {
  beforeEach(() => {
    apiState = ready(homeData);
  });

  it("показывает светлый рабочий старт и три приоритетных объекта", () => {
    render(<AnalyticsPage />);
    expect(screen.getByText("Требуют внимания")).toBeInTheDocument();
    expect(screen.getByTestId("command-center")).toHaveAttribute("data-command-theme", "light");
    expect(screen.getByRole("link", { name: /Компьютерная томография/ })).toHaveAttribute("href", "/signals/10");
    expect(document.querySelector('a[href="/organizations/4"]')).toHaveTextContent("Центр диагностики № 4");
    expect(screen.getByRole("link", { name: /Повторяющаяся услуга: Холтеровское мониторирование/ })).toHaveAttribute("href", "/patterns/7");
  });

  it("сохраняет главное действие и вторичный переход в overview", () => {
    render(<AnalyticsPage />);
    expect(screen.getByRole("link", { name: "Перейти к проверке" })).toHaveAttribute("href", expect.stringContaining("sort=priority"));
    expect(screen.getByRole("link", { name: "Открыть аналитический обзор" })).toHaveAttribute("href", "/overview");
  });

  it("оставляет экспертный контур на втором уровне", () => {
    render(<AnalyticsPage />);
    const details = screen.getByText("Экспертный контур и качество анализа").closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(screen.getByText("Что изменилось")).toBeInTheDocument();
  });

  it("показывает dashboard skeleton и понятную ошибку", () => {
    apiState = { data: null, loading: true, error: null, retry: vi.fn(), setData: vi.fn() };
    const loading = render(<AnalyticsPage />);
    expect(document.querySelector("[data-skeleton='dashboard']")).toBeInTheDocument();
    loading.unmount();
    apiState = { data: null, loading: false, error: "Сервис временно недоступен", retry: vi.fn(), setData: vi.fn() };
    render(<AnalyticsPage />);
    expect(screen.getByText("Не удалось получить данные")).toBeInTheDocument();
  });

  it("обрабатывает отсутствие приоритетных объектов", () => {
    apiState = ready({
      ...homeData,
      command_center: { ...commandCenterFixture, top_financial_signal: null, priority_organization: null },
      pattern_summary: { ...patternSummaryFixture, top_importance_pattern: null, attention_patterns: [] },
      priority_organizations: { ...homeData.priority_organizations, items: [] },
    });
    render(<AnalyticsPage />);
    expect(screen.getByText("Приоритетный сигнал пока не определён")).toBeInTheDocument();
    expect(screen.getByText("Приоритетная организация пока не определена")).toBeInTheDocument();
    expect(screen.getByText("Повторяющиеся модели пока не сформированы")).toBeInTheDocument();
  });
});
