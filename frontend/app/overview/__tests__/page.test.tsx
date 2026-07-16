import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OverviewPage from "@/app/overview/page";
import { isAnalysisStale } from "@/lib/overview";
import { OverviewActions } from "@/components/overview-actions";
import { commandCenterFixture, patternSummaryFixture } from "@/components/__tests__/fixtures";

vi.mock("@/components/regional-monitoring-map", () => ({
  RegionalMonitoringMap: ({ regions }: { regions: unknown[] }) => <section data-testid="regional-monitoring">Регионов: {regions.length}</section>,
  regionalDataCoverage: () => ({ regionsWithData: 1, mappedRegionsWithData: 1, regionsWithoutData: 15, unknownRegions: 0 }),
}));
vi.mock("@/components/overview-signal-timeline", () => ({
  OverviewSignalTimeline: ({ data }: { data?: unknown[] }) => <div data-testid="overview-timeline">Периодов: {data?.length ?? 0}</div>,
}));

const ready = (data: unknown) => ({ data, loading: false, error: null as string | null, retry: vi.fn(), setData: vi.fn() });
const summary = { analysis: { period: "01.01–30.06.2026", organizations_count: 20, records_count: 15000, last_analysis_at: "2026-07-12T09:30:00", processing_status: "Обработка завершена" }, priority: { high_risk_signals: 47, review_amount: "12400000", top_organization_id: 4, top_organization: "Центр диагностики № 4" }, metrics: [] };
const changes = { comparison_available: false, current_run_id: 8, previous_run_id: null, new_signals: 0, resolved_signals: 0, organizations_risk_increased: 0, organizations_risk_decreased: 0, review_amount_change: "0", completed_reviews: 0, selected_for_review_rate_change: 0 };
const priorities = { analysis_run_id: 8, top_organization: commandCenterFixture.priority_organization, top_signal: commandCenterFixture.top_financial_signal, critical_priority_signals: 32, high_priority_signals: 68 };
const patternChanges = { comparison_available: false, current_run_id: 8, previous_run_id: null, new_patterns: 0, recurring_patterns: 0, disappeared_patterns: 0, importance_increased: 0, importance_decreased: 0 };
const quality = { precision: 0.7988, recall: 0.9592, f1: 0.8716, false_positive_rate: 0.021, true_positive_count: 1151, false_positive_count: 290, false_negative_count: 49, selected_for_review_rate: 0.0961, manual_review_reduction: 0.9039 };
const expert = { reviewed_signals: 2, reviewed_patterns: 0, confirmed_share: null, rejected_share: null, escalated_share: null, average_first_decision_hours: null, average_completion_hours: null, signals_without_decision: 91, patterns_without_decision: 42, in_progress: 1, completed_current_period: 0, sample_sufficient: false, sample_message: "Недостаточно экспертных решений для устойчивого вывода.", usefulness_distribution: {}, explanation_quality_distribution: {}, priority_correctness_distribution: {} };
const regional = [{ region_name: "Алматы", region_code: "KZ-ALA", signal_count: 120, unique_record_count: 118, financial_significance: "8500000", organization_count: 4, maximum_priority: 94, leading_organization: { id: 4, name: "Центр диагностики № 4", priority_score: 94 } }];
const timeline = [
  { period: "Май 2026", services: 7400, amount: "7100000", signals: 680 },
  { period: "Июнь 2026", services: 7600, amount: "8000000", signals: 761 },
];
const overviewData = {
  schema_version: 2,
  summary,
  command_center: commandCenterFixture,
  changes,
  priority_summary: priorities,
  pattern_summary: patternSummaryFixture,
  pattern_changes: patternChanges,
  pattern_distribution: [{ label: "Повторяющаяся услуга", value: 12, percent: 100 }],
  quality,
  expert_review: expert,
  regional_monitoring: regional,
  timeline,
};

let apiState = ready(overviewData);
vi.mock("@/hooks/use-api", () => ({ useApi: () => apiState }));

describe("аналитический обзор V2", () => {
  beforeEach(() => {
    apiState = ready(overviewData);
  });

  it("использует schema version 2 и формирует главный вывод из API", () => {
    render(<OverviewPage />);
    expect(screen.getByRole("heading", { name: "Аналитический обзор" })).toBeInTheDocument();
    expect(screen.getByText(/Verimed проанализировал/)).toHaveTextContent("15 000 медицинских услуг");
    expect(screen.getByText(/Verimed проанализировал/)).toHaveTextContent("1 441 запись (9,61 %)");
    expect(screen.queryByText(/ограниченный контракт/)).not.toBeInTheDocument();
    expect(screen.getByTestId("regional-monitoring")).toHaveTextContent("Регионов: 1");
    expect(screen.getByTestId("overview-timeline")).toHaveTextContent("Периодов: 2");
  });

  it("показывает три приоритетных объекта с реальными переходами", () => {
    render(<OverviewPage />);
    expect(document.querySelector('a[href="/organizations/4"]')).toHaveTextContent("Центр диагностики № 4");
    expect(document.querySelector('a[href="/signals/10"]')).toHaveTextContent("Компьютерная томография");
    expect(document.querySelector('a[href="/patterns/7"]')).toHaveTextContent("Повторяющаяся услуга: Холтеровское мониторирование");
  });

  it("показывает метрики качества и ограничение синтетических данных", () => {
    render(<OverviewPage />);
    expect(screen.getByText("79,88 %")).toBeInTheDocument();
    expect(screen.getByText("95,92 %")).toBeInTheDocument();
    expect(screen.getByText("87,16 %")).toBeInTheDocument();
    expect(screen.getByText("2,1 %")).toBeInTheDocument();
    expect(screen.getByText(/воспроизводимом синтетическом наборе/)).toBeInTheDocument();
  });

  it("объясняет отсутствие прошлого запуска", () => {
    render(<OverviewPage />);
    expect(screen.getAllByText("Изменения станут доступны после следующего запуска анализа.").length).toBeGreaterThan(0);
  });

  it("ведёт к существующей отфильтрованной очереди", () => {
    render(<OverviewPage />);
    const link = screen.getByRole("link", { name: "Перейти к проверке" });
    expect(link.getAttribute("href")).toContain("sort=priority");
    expect(link.getAttribute("href")).toContain("status=Не%20проверено");
  });

  it("использует полноширинную V2-оболочку и утверждённый BrandLogo", () => {
    render(<OverviewPage />);
    const root = screen.getByTestId("overview-root");
    expect(root).toHaveClass("bg-v2-canvas");
    expect(screen.getByAltText("Verimed")).toBeInTheDocument();
    expect(document.getElementById("overview-content")).toBeInTheDocument();
  });

  it("помечает print/fullscreen controls и рекомендуемое действие для печати", () => {
    render(<OverviewPage />);
    expect(screen.getByRole("button", { name: "Печать аналитического обзора" }).closest(".print\\:hidden")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Перейти к проверке" })).toHaveClass("print:hidden");
  });

  it("обрабатывает loading и общую ошибку", () => {
    apiState = { data: null, loading: true, error: null, retry: vi.fn(), setData: vi.fn() };
    const loading = render(<OverviewPage />);
    expect(document.querySelector("[data-skeleton='overview']")).toBeInTheDocument();
    loading.unmount();
    apiState = { data: null, loading: false, error: "Сервис временно недоступен", retry: vi.fn(), setData: vi.fn() };
    render(<OverviewPage />);
    expect(screen.getByText("Не удалось получить данные")).toBeInTheDocument();
  });
});

describe("полноэкранное действие", () => {
  it("показывает понятный fallback, если Fullscreen API недоступен", async () => {
    const original = document.documentElement.requestFullscreen;
    Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: undefined });
    render(<OverviewActions />);
    fireEvent.click(screen.getByRole("button", { name: "Развернуть аналитический обзор" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Полноэкранный режим недоступен в этом браузере.");
    Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: original });
  });
});

describe("актуальность данных", () => {
  it("определяет устаревший анализ воспроизводимо", () => {
    const now = new Date("2026-07-13T12:00:00Z").getTime();
    expect(isAnalysisStale("2026-07-12T12:00:00Z", now)).toBe(false);
    expect(isAnalysisStale("2026-07-01T12:00:00Z", now)).toBe(true);
    expect(isAnalysisStale(null, now)).toBe(true);
  });
});
