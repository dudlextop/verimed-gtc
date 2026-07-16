import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PatternPage from "@/app/patterns/[id]/page";
import PatternsPage from "@/app/patterns/page";
import { PatternAttention } from "@/components/pattern-attention";
import { PatternTimelineChart } from "@/components/pattern-timeline-chart";
import { PatternsView } from "@/components/patterns-view";
import { graphNodeLabel, RelationshipGraph } from "@/components/relationship-graph";
import type { PatternGraph, RecurrenceHistory } from "@/lib/types";
import { api } from "@/lib/api";
import {
  patternDetailFixture,
  patternFixture,
  patternGraphFixture,
  patternSummaryFixture,
  signalFixture,
} from "./fixtures";

const replace = vi.fn();
const push = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "7" }),
  useRouter: () => ({ replace, push }),
  useSearchParams: () => searchParams,
}));
vi.mock("@/lib/api", () => ({
  api: {
    patterns: vi.fn(),
    pattern: vi.fn(),
    patternGraph: vi.fn(),
    patternTimeline: vi.fn(),
    patternSignals: vi.fn(),
    patternSummary: vi.fn(),
    patternChanges: vi.fn(),
    patternDecisionHistory: vi.fn(),
    patternRecurrenceHistory: vi.fn(),
    patternDecisionEvent: vi.fn(),
    reviewPattern: vi.fn(),
    signalPreview: vi.fn(),
    review: vi.fn(),
  },
}));

const recurrenceFixture: RecurrenceHistory = {
  entity_fingerprint: patternFixture.fingerprint,
  first_detected_at: patternFixture.first_seen,
  last_detected_at: patternFixture.last_seen,
  appeared_runs: 3,
  absent_runs: 0,
  last_expert_status: null,
  points: [
    { analysis_run_id: 6, appeared_at: "2026-04-30", risk_score: null, priority_score: null, stability_score: 76, importance_score: 84, financial_significance: "3900000", signal_count: 29, status: "Активна", participant_signature: null },
    { analysis_run_id: 7, appeared_at: "2026-05-31", risk_score: null, priority_score: null, stability_score: 80, importance_score: 88, financial_significance: "4300000", signal_count: 34, status: "Активна", participant_signature: null },
    { analysis_run_id: 8, appeared_at: "2026-06-30", risk_score: null, priority_score: null, stability_score: 84, importance_score: 91, financial_significance: "4800000", signal_count: 38, status: "Активна", participant_signature: null },
  ],
};

function patternsResponse(items = [patternFixture]) {
  return {
    items,
    total: items.length,
    page: 1,
    page_size: 20,
    pattern_types: ["Повторяющаяся услуга"],
    organizations: patternDetailFixture.organizations,
  };
}

describe("повторяющиеся модели V2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    replace.mockReset();
    push.mockReset();
    searchParams = new URLSearchParams();
    vi.mocked(api.patterns).mockResolvedValue(patternsResponse());
    vi.mocked(api.pattern).mockResolvedValue(patternDetailFixture);
    vi.mocked(api.patternGraph).mockResolvedValue(patternGraphFixture);
    vi.mocked(api.patternTimeline).mockResolvedValue([
      { period: "2026-04", signal_count: 29, financial_significance: "3900000" },
      { period: "2026-05", signal_count: 34, financial_significance: "4300000" },
      { period: "2026-06", signal_count: 38, financial_significance: "4800000" },
    ]);
    vi.mocked(api.patternSignals).mockResolvedValue([signalFixture]);
    vi.mocked(api.signalPreview).mockResolvedValue(signalFixture);
    vi.mocked(api.patternSummary).mockResolvedValue(patternSummaryFixture);
    vi.mocked(api.patternChanges).mockResolvedValue({ comparison_available: true, current_run_id: 8, previous_run_id: 7, new_patterns: 4, recurring_patterns: 38, disappeared_patterns: 1, importance_increased: 6, importance_decreased: 2 });
    vi.mocked(api.patternDecisionHistory).mockResolvedValue({ entity_type: "pattern", entity_fingerprint: patternFixture.fingerprint, current_status: null, history_found: false, events: [] });
    vi.mocked(api.patternRecurrenceHistory).mockResolvedValue(recurrenceFixture);
  });

  it("показывает KPI страницы и компактное методологическое пояснение", async () => {
    render(<PatternsPage />);
    expect(await screen.findByRole("heading", { name: "Повторяющиеся модели" })).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText(/Новых моделей после последнего анализа: 4/)).toBeInTheDocument();
  });

  it("сохраняет фильтры, сортировку и пагинацию в URL", async () => {
    vi.mocked(api.patterns).mockResolvedValue({ ...patternsResponse(), total: 40 });
    render(<PatternsView />);
    await screen.findAllByText(patternFixture.name);
    fireEvent.change(screen.getByLabelText("Важность"), { target: { value: "Критический" } });
    expect(replace).toHaveBeenCalledWith("/patterns?importance=%D0%9A%D1%80%D0%B8%D1%82%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%B8%D0%B9", { scroll: false });
    fireEvent.click(screen.getByRole("button", { name: /Дополнительные фильтры/ }));
    fireEvent.change(screen.getByLabelText("Сортировка моделей"), { target: { value: "financial" } });
    expect(replace).toHaveBeenCalledWith("/patterns?sort=financial", { scroll: false });
    fireEvent.click(screen.getByRole("button", { name: "Следующая страница" }));
    expect(replace).toHaveBeenCalledWith("/patterns?page=2", { scroll: false });
  });

  it("открывает модель кликом по строке и мобильной карточке", async () => {
    render(<PatternsView />);
    const row = await screen.findByRole("row", { name: `Открыть модель «${patternFixture.name}»` });
    fireEvent.click(row);
    expect(push).toHaveBeenCalledWith(expect.stringContaining("/patterns/7?returnTo="));
    const mobile = within(screen.getByTestId("patterns-mobile-list")).getByRole("button", { name: /Повторяющаяся услуга/ });
    fireEvent.click(mobile);
    expect(push).toHaveBeenCalledTimes(2);
  });

  it("показывает длинные названия, loading, error и empty состояния", async () => {
    const longName = `${patternFixture.name} — межрегиональная повторяющаяся последовательность диагностических услуг`;
    vi.mocked(api.patterns).mockResolvedValue(patternsResponse([{ ...patternFixture, name: longName }]));
    const view = render(<PatternsView />);
    expect(await screen.findAllByText(longName)).not.toHaveLength(0);
    view.unmount();

    vi.mocked(api.patterns).mockImplementation(() => new Promise(() => undefined));
    const loading = render(<PatternsView />);
    expect(screen.getByLabelText("Загрузка данных")).toHaveAttribute("data-skeleton", "list");
    loading.unmount();

    vi.mocked(api.patterns).mockRejectedValue(new Error("Сервис недоступен"));
    const error = render(<PatternsView />);
    expect(await screen.findByText("Не удалось загрузить модели")).toBeInTheDocument();
    error.unmount();

    searchParams = new URLSearchParams("importance=Критический");
    vi.mocked(api.patterns).mockResolvedValue(patternsResponse([]));
    render(<PatternsView />);
    expect(await screen.findByText("По выбранным условиям моделей нет")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Сбросить все" })).toHaveLength(2);
  });

  it("командный центр сохраняет переход к модели", () => {
    render(<PatternAttention data={patternSummaryFixture} />);
    expect(screen.getByText("Повторяющиеся модели, требующие внимания")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Повторяющаяся услуга: Холтеровское мониторирование/ })).toHaveAttribute("href", "/patterns/7");
  });

  it("сохраняет topology графа и делает центральную модель главным узлом", () => {
    const original = structuredClone(patternGraphFixture);
    render(<RelationshipGraph data={patternGraphFixture} />);
    expect(screen.getByTestId("relationship-graph")).toBeInTheDocument();
    expect(screen.getByTestId("relationship-mobile-list")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-graph-node-id]")).toHaveLength(patternGraphFixture.nodes.length);
    expect(document.querySelectorAll("[data-graph-edge-id]")).toHaveLength(patternGraphFixture.edges.length);
    expect(document.querySelector("[data-graph-node-id='pattern-7']")).toHaveAttribute("aria-pressed", "true");
    expect(patternGraphFixture).toEqual(original);
  });

  it("усиливает выбранный узел и ослабляет несвязанные элементы", () => {
    render(<RelationshipGraph data={patternGraphFixture} />);
    const organizationNode = document.querySelector<HTMLButtonElement>("[data-graph-node-id='organization-4']");
    expect(organizationNode).not.toBeNull();
    if (!organizationNode) return;
    organizationNode.focus();
    expect(organizationNode).toHaveFocus();
    fireEvent.click(organizationNode);
    expect(organizationNode).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector("[data-graph-node-id='patient-22']")).toHaveAttribute("data-dimmed", "true");
    expect(document.querySelector("[data-graph-edge-id='p-s']")).toHaveAttribute("data-dimmed", "true");
    expect(screen.getByRole("link", { name: "Открыть объект" })).toHaveAttribute("href", "/organizations/4");
  });

  it("раскрывает дополнительные узлы без изменения алгоритма размещения", () => {
    const extraNodes = Array.from({ length: 10 }, (_, index) => ({
      id: `patient-extra-${index}`,
      node_type: "patient" as const,
      label: `PT-EXTRA-${index}`,
      subtitle: "1 сигнал",
      size: 12,
      signal_count: 1,
      financial_significance: "0",
      href: null,
      is_primary: false,
    }));
    render(<RelationshipGraph data={{ ...patternGraphFixture, nodes: [...patternGraphFixture.nodes, ...extraNodes] }} />);
    expect(screen.queryByText("PT-EXTRA-9")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Показать больше связей" }));
    expect(screen.getAllByText("PT-EXTRA-9").length).toBeGreaterThan(0);
  });

  it("имеет нейтральный fallback для неизвестного типа узла", () => {
    expect(graphNodeLabel("unknown")).toBe("Другой объект");
    const data = {
      ...patternGraphFixture,
      nodes: [...patternGraphFixture.nodes, { ...patternGraphFixture.nodes[1], id: "unknown-1", node_type: "unknown", label: "Неизвестный объект" }],
    } as unknown as PatternGraph;
    render(<RelationshipGraph data={data} />);
    expect(screen.getAllByText("Другой объект").length).toBeGreaterThan(0);
    expect(document.querySelector("[data-graph-node-id='unknown-1']")).toBeInTheDocument();
  });

  it("загружает граф только при приближении секции", async () => {
    const notifications: Array<(entries: Array<{ isIntersecting: boolean; target?: Element; boundingClientRect?: { top: number } }>) => void> = [];
    class DeferredObserver {
      constructor(callback: (entries: Array<{ isIntersecting: boolean; target?: Element; boundingClientRect?: { top: number } }>) => void) { notifications.push(callback); }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", DeferredObserver);
    render(<PatternPage />);
    await screen.findByRole("heading", { name: patternFixture.name });
    expect(api.patternGraph).not.toHaveBeenCalled();
    act(() => notifications.forEach((notify) => notify([{ isIntersecting: true }])));
    await waitFor(() => expect(api.patternGraph).toHaveBeenCalledWith("7"));
    vi.unstubAllGlobals();
  });

  it("строит пять секций и доступную локальную навигацию", async () => {
    render(<PatternPage />);
    await screen.findByRole("heading", { name: patternFixture.name });
    for (const title of ["Сводка", "Почему модель важна", "Участники и связи", "Граф связей", "Входящие сигналы", "Экспертное решение"]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    const nav = screen.getByRole("navigation", { name: "Разделы карточки модели" });
    expect(within(nav).getAllByRole("link")).toHaveLength(5);
    fireEvent.click(within(nav).getByRole("link", { name: "Граф" }));
    expect(within(nav).getByRole("link", { name: "Граф" })).toHaveAttribute("aria-current", "location");
  });

  it("показывает главные факторы и раскрывает остальные", async () => {
    const factors = [...patternDetailFixture.factors, ...Array.from({ length: 3 }, (_, index) => ({ ...patternDetailFixture.factors[0], name: `Дополнительный фактор ${index + 1}`, contribution: 10 - index }))];
    vi.mocked(api.pattern).mockResolvedValue({ ...patternDetailFixture, factors });
    render(<PatternPage />);
    await screen.findByRole("heading", { name: patternFixture.name });
    expect(screen.queryByText("Дополнительный фактор 3")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Показать ещё 2/ }));
    expect(screen.getByText("Дополнительный фактор 3")).toBeInTheDocument();
  });

  it("строит динамику важности и устойчивости только по фактической истории", async () => {
    const chart = render(<PatternTimelineChart recurrence={recurrenceFixture} timeline={[
      { period: "2026-04", signal_count: 29, financial_significance: "3900000" },
      { period: "2026-05", signal_count: 34, financial_significance: "4300000" },
    ]} />);
    expect(screen.getByRole("img", { name: "График изменения важности и устойчивости модели по появлениям" })).toBeInTheDocument();
    chart.unmount();

    render(<PatternPage />);
    await screen.findByRole("heading", { name: patternFixture.name });
    fireEvent.click(screen.getByText("Динамика важности и устойчивости"));
    await waitFor(() => expect(api.patternTimeline).toHaveBeenCalledWith("7"));
    await waitFor(() => expect(api.patternRecurrenceHistory).toHaveBeenCalledWith("7"));
  });

  it("честно показывает недостаточность динамики", async () => {
    render(<PatternTimelineChart recurrence={{ ...recurrenceFixture, points: recurrenceFixture.points.slice(0, 1) }} timeline={[]} />);
    expect(screen.getByText("Недостаточно данных для динамики")).toBeInTheDocument();
  });

  it("показывает участников до графа и поддерживает пустое состояние", async () => {
    const view = render(<PatternPage />);
    await screen.findByRole("heading", { name: patternFixture.name });
    expect(screen.getByRole("heading", { name: "Организации" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Центр диагностики Оңтүстік" })).toHaveAttribute("href", "/organizations/4");
    view.unmount();
    vi.mocked(api.pattern).mockResolvedValue({ ...patternDetailFixture, organizations: [], doctors: [], patients: [], services: [] });
    render(<PatternPage />);
    expect(await screen.findByText("Участники не сформированы")).toBeInTheDocument();
  });

  it("переиспользует быстрый просмотр входящих сигналов", async () => {
    render(<PatternPage />);
    const row = await screen.findByRole("row", { name: /Открыть быстрый просмотр сигнала/ });
    row.focus();
    fireEvent.keyDown(row, { key: "Enter" });
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: signalFixture.service_name })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(row).toHaveFocus();
  });

  it("сохраняет экспертное решение и предлагает следующую модель", async () => {
    searchParams = new URLSearchParams("returnTo=%2Fpatterns%3Fsort%3Dimportance&queueIds=6,7,8");
    vi.mocked(api.reviewPattern).mockResolvedValue({
      ...patternDetailFixture,
      review_status: "Значимость подтверждена",
      reviews: [{ id: 1, status: "Значимость подтверждена", comment: "Связи сопоставлены.", reviewer_name: "Айдана Сарсенова", created_at: "2026-07-13T10:00:00" }],
    });
    render(<PatternPage />);
    await screen.findByRole("heading", { name: patternFixture.name });
    fireEvent.click(screen.getByRole("button", { name: "Другие действия" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Подтвердить значимость" }));
    fireEvent.change(screen.getByLabelText("Комментарий специалиста"), { target: { value: "Связи сопоставлены." } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить оценку" }));
    expect(await screen.findByText("Оценка модели сохранена")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Перейти к следующей модели/ })).toHaveAttribute("href", expect.stringContaining("/patterns/8?"));
  });

  it("показывает loading и error карточки модели", async () => {
    vi.mocked(api.pattern).mockImplementation(() => new Promise(() => undefined));
    const loading = render(<PatternPage />);
    expect(screen.getByLabelText("Загрузка данных")).toHaveAttribute("data-skeleton", "detail");
    loading.unmount();
    vi.mocked(api.pattern).mockRejectedValue(new Error("Сервис недоступен"));
    render(<PatternPage />);
    expect(await screen.findByText("Не удалось загрузить модель")).toBeInTheDocument();
  });
});
