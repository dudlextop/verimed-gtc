import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PatternPage from "@/app/patterns/[id]/page";
import { PatternAttention } from "@/components/pattern-attention";
import { PatternsView } from "@/components/patterns-view";
import { RelationshipGraph } from "@/components/relationship-graph";
import { api } from "@/lib/api";
import {
  patternDetailFixture,
  patternFixture,
  patternGraphFixture,
  patternSummaryFixture,
  signalFixture,
} from "./fixtures";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "7" }),
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/api", () => ({
  api: {
    patterns: vi.fn(),
    pattern: vi.fn(),
    patternGraph: vi.fn(),
    patternTimeline: vi.fn(),
    patternSignals: vi.fn(),
    patternDecisionHistory: vi.fn(),
    patternRecurrenceHistory: vi.fn(),
    patternDecisionEvent: vi.fn(),
    reviewPattern: vi.fn(),
    signalPreview: vi.fn(),
    review: vi.fn(),
  },
}));

describe("повторяющиеся модели", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    replace.mockReset();
    vi.mocked(api.patterns).mockResolvedValue({
      items: [patternFixture],
      total: 1,
      page: 1,
      page_size: 20,
      pattern_types: ["Повторяющаяся услуга"],
      organizations: patternDetailFixture.organizations,
    });
    vi.mocked(api.pattern).mockResolvedValue(patternDetailFixture);
    vi.mocked(api.patternGraph).mockResolvedValue(patternGraphFixture);
    vi.mocked(api.patternTimeline).mockResolvedValue([
      { period: "2026-03", signal_count: 8, financial_significance: "900000" },
      { period: "2026-04", signal_count: 10, financial_significance: "1200000" },
      { period: "2026-05", signal_count: 12, financial_significance: "1500000" },
    ]);
    vi.mocked(api.patternSignals).mockResolvedValue([signalFixture]);
    vi.mocked(api.signalPreview).mockResolvedValue(signalFixture);
    vi.mocked(api.patternDecisionHistory).mockResolvedValue({entity_type: "pattern", entity_fingerprint: patternFixture.fingerprint, current_status: null, history_found: false, events: []});
    vi.mocked(api.patternRecurrenceHistory).mockResolvedValue({entity_fingerprint: patternFixture.fingerprint, first_detected_at: patternFixture.first_seen, last_detected_at: patternFixture.last_seen, appeared_runs: 3, absent_runs: 0, last_expert_status: null, points: []});
  });

  it("отображает список, фильтры и сортировку", async () => {
    render(<PatternsView />);
    expect((await screen.findAllByText(patternFixture.name)).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Сортировка моделей")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Сортировка моделей"), { target: { value: "financial" } });
    expect(replace).toHaveBeenCalledWith("/patterns?sort=financial", { scroll: false });
    expect(screen.getByTestId("patterns-mobile-list")).toBeInTheDocument();
    expect(screen.queryByRole("button", {name: /Сортировать по/})).not.toBeInTheDocument();
  });

  it("командный центр показывает модели, требующие внимания", () => {
    render(<PatternAttention data={patternSummaryFixture} />);
    expect(screen.getByText("Повторяющиеся модели, требующие внимания")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Повторяющаяся услуга: Холтеровское мониторирование/ })).toHaveAttribute("href", "/patterns/7");
  });

  it("граф отображает ключевые связи и визуальный центр", () => {
    render(<RelationshipGraph data={patternGraphFixture} />);
    expect(screen.getByTestId("relationship-graph")).toBeInTheDocument();
    expect(screen.getByText("Модель")).toBeInTheDocument();
    expect(screen.getAllByText("DR-000012").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: /Центр диагностики Оңтүстік/ })[0]);
    expect(screen.getByRole("link", { name: "Открыть объект" })).toHaveAttribute("href", "/organizations/4");
    expect(screen.getByTestId("relationship-mobile-list")).toBeInTheDocument();
  });

  it("загружает граф карточки только при приближении раздела", async () => {
    const notifications: Array<(entries: Array<{isIntersecting: boolean}>) => void> = [];
    class DeferredObserver {
      constructor(callback: (entries: Array<{isIntersecting: boolean}>) => void) { notifications.push(callback); }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", DeferredObserver);
    render(<PatternPage/>);
    await screen.findByRole("heading", {name: patternFixture.name});
    expect(api.patternGraph).not.toHaveBeenCalled();
    act(() => notifications.forEach((notify) => notify([{isIntersecting: true}])));
    await waitFor(() => expect(api.patternGraph).toHaveBeenCalledWith("7"));
    vi.unstubAllGlobals();
  });

  it("скрывает второстепенные узлы графа до явного раскрытия", () => {
    const extraNodes = Array.from({length: 10}, (_, index) => ({
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
    render(<RelationshipGraph data={{...patternGraphFixture, nodes: [...patternGraphFixture.nodes, ...extraNodes]}}/>);
    expect(screen.queryByText("PT-EXTRA-9")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {name: "Показать больше связей"}));
    expect(screen.getAllByText("PT-EXTRA-9").length).toBeGreaterThan(0);
  });

  it("карточка содержит все разделы и переходы", async () => {
    render(<PatternPage />);
    await screen.findByRole("heading", { name: patternFixture.name });
    for (const title of ["Сводка", "Почему модель важна", "Связи", "Сигналы", "Экспертная оценка"]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("link", { name: /Центр диагностики Оңтүстік/ })[0]).toHaveAttribute("href", "/organizations/4");
    expect(screen.getByRole("link", { name: "Открыть" })).toHaveAttribute("href", "/signals/10");
    expect(screen.getAllByLabelText("Экспертная оценка модели")).toHaveLength(1);
  });

  it("экспертная оценка обновляет карточку без перезагрузки", async () => {
    vi.mocked(api.reviewPattern).mockResolvedValue({
      ...patternDetailFixture,
      review_status: "Значимость подтверждена",
      reviews: [{ id: 1, status: "Значимость подтверждена", comment: "Связи сопоставлены.", reviewer_name: "Айдана Сарсенова", created_at: "2026-07-13T10:00:00" }],
    });
    render(<PatternPage />);
    await screen.findByRole("heading", { name: patternFixture.name });
    fireEvent.click(screen.getByText("Другие действия"));
    fireEvent.click(screen.getByRole("button", { name: "Подтвердить значимость" }));
    fireEvent.change(screen.getByLabelText("Комментарий специалиста"), { target: { value: "Связи сопоставлены." } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить оценку" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Оценка модели сохранена"));
    expect(screen.getAllByText("Значимость подтверждена").length).toBeGreaterThan(0);
  });

  it("показывает состояние отсутствия моделей", async () => {
    vi.mocked(api.patterns).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20, pattern_types: [], organizations: [] });
    render(<PatternsView />);
    expect(await screen.findByText("Повторяющиеся модели пока не сформированы")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Сбросить фильтры" })).toBeInTheDocument();
  });
});
