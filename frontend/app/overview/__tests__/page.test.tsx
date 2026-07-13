import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OverviewPage from "@/app/overview/page";
import { isAnalysisStale } from "@/lib/overview";
import { OverviewActions } from "@/components/overview-actions";
import { commandCenterFixture, patternSummaryFixture } from "@/components/__tests__/fixtures";

const ready = (data: unknown) => ({data, loading: false, error: null, retry: vi.fn(), setData: vi.fn()});
const summary = {analysis: {period: "01.01–30.06.2026", organizations_count: 20, records_count: 15000, last_analysis_at: "2026-07-12T09:30:00", processing_status: "Обработка завершена"}, priority: {high_risk_signals: 47, review_amount: "12400000", top_organization_id: 4, top_organization: "Центр диагностики № 4"}, metrics: []};
const changes = {comparison_available: false, current_run_id: 8, previous_run_id: null, new_signals: 0, resolved_signals: 0, organizations_risk_increased: 0, organizations_risk_decreased: 0, review_amount_change: "0", completed_reviews: 0, selected_for_review_rate_change: 0};
const priorities = {analysis_run_id: 8, top_organization: commandCenterFixture.priority_organization, top_signal: commandCenterFixture.top_financial_signal, critical_priority_signals: 32, high_priority_signals: 68};
const patternChanges = {comparison_available: false, current_run_id: 8, previous_run_id: null, new_patterns: 0, recurring_patterns: 0, disappeared_patterns: 0, importance_increased: 0, importance_decreased: 0};
const quality = {precision: 0.7988, recall: 0.9592, f1: 0.8716, false_positive_rate: 0.021, true_positive_count: 1151, false_positive_count: 290, false_negative_count: 49, selected_for_review_rate: 0.0961, manual_review_reduction: 0.9039};
const expert = {reviewed_signals: 2, reviewed_patterns: 0, confirmed_share: null, rejected_share: null, escalated_share: null, average_first_decision_hours: null, average_completion_hours: null, signals_without_decision: 91, patterns_without_decision: 42, in_progress: 1, completed_current_period: 0, sample_sufficient: false, sample_message: "Недостаточно экспертных решений для устойчивого вывода.", usefulness_distribution: {}, explanation_quality_distribution: {}, priority_correctness_distribution: {}};

const response = ready({schema_version: 1, summary, command_center: commandCenterFixture, changes, priority_summary: priorities, pattern_summary: patternSummaryFixture, pattern_changes: patternChanges, pattern_distribution: [{label: "Повторяющаяся услуга", value: 12, percent: 100}], quality, expert_review: expert});

vi.mock("@/hooks/use-api", () => ({useApi: () => response}));

describe("аналитический обзор", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("получает данные и формирует главный вывод из значений API", () => {
    render(<OverviewPage/>);
    expect(screen.getByRole("heading", {name: "Аналитический обзор"})).toBeInTheDocument();
    expect(screen.getByText(/Verimed проанализировал/)).toHaveTextContent("15 000 медицинских услуг");
    expect(screen.getByText(/Verimed проанализировал/)).toHaveTextContent("1 441 запись");
    expect(screen.getByText(/Verimed проанализировал/)).toHaveTextContent("1 441 запись (9,61 %)");
    expect(screen.getByText(/Verimed проанализировал/)).toHaveTextContent("15,1 млн");
  });

  it("показывает три приоритетных объекта с переходами", () => {
    render(<OverviewPage/>);
    expect(document.querySelector('a[href="/organizations/4"]')).toHaveTextContent("Центр диагностики № 4");
    expect(document.querySelector('a[href="/signals/10"]')).toHaveTextContent("Компьютерная томография");
    expect(document.querySelector('a[href="/patterns/7"]')).toHaveTextContent("Повторяющаяся услуга: Холтеровское мониторирование");
  });

  it("показывает фактические метрики и ограничение синтетических данных", () => {
    render(<OverviewPage/>);
    expect(screen.getByText("79,88 %")).toBeInTheDocument();
    expect(screen.getByText("95,92 %")).toBeInTheDocument();
    expect(screen.getByText("87,16 %")).toBeInTheDocument();
    expect(screen.getByText("2,1 %")).toBeInTheDocument();
    expect(screen.getByText(/воспроизводимом синтетическом наборе/)).toBeInTheDocument();
    expect(screen.getByText("Недостаточно экспертных решений для устойчивого вывода.")).toBeInTheDocument();
  });

  it("объясняет отсутствие прошлого запуска", () => {
    render(<OverviewPage/>);
    expect(screen.getByText("Изменения станут доступны после следующего запуска анализа.")).toBeInTheDocument();
  });

  it("ведёт к существующей отфильтрованной очереди", () => {
    render(<OverviewPage/>);
    const link = screen.getByRole("link", {name: "Перейти к приоритетной проверке"});
    expect(link.getAttribute("href")).toContain("sort=priority");
    expect(link.getAttribute("href")).toContain("status=Не%20проверено");
  });

  it("сохраняет полноширинную оболочку без горизонтального переполнения", () => {
    render(<OverviewPage/>);
    const root = screen.getByTestId("overview-root");
    expect(root).toHaveClass("overview-shell");
    expect(root.querySelector(".overview-content")).toBeInTheDocument();
  });

  it("помечает печатные действия для исключения из печати", () => {
    render(<OverviewPage/>);
    expect(screen.getByRole("link", {name: "Перейти к проверке"}).closest(".overview-header-actions")?.className).toContain("print:hidden");
    expect(screen.getByRole("button", {name: "Печать аналитического обзора"}).closest(".overview-utility-actions")?.className).toContain("print:hidden");
  });
});

describe("полноэкранное действие", () => {
  it("показывает понятный fallback, если Fullscreen API недоступен", async () => {
    const original = document.documentElement.requestFullscreen;
    Object.defineProperty(document.documentElement, "requestFullscreen", {configurable: true, value: undefined});
    render(<OverviewActions/>);
    fireEvent.click(screen.getByRole("button", {name: "Развернуть аналитический обзор"}));
    expect(await screen.findByRole("status")).toHaveTextContent("Полноэкранный режим недоступен в этом браузере.");
    Object.defineProperty(document.documentElement, "requestFullscreen", {configurable: true, value: original});
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
