import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignalPage from "../page";
import { api } from "@/lib/api";
import { patternFixture, signalFixture } from "@/components/__tests__/fixtures";

vi.mock("next/navigation", () => ({useParams: () => ({id: "10"}), useSearchParams: () => new URLSearchParams("returnTo=%2Fsignals%3Fpriority_level%3DВысокий&queueIds=9%2C10%2C11")}));
vi.mock("@/lib/api", () => ({api: {
  signal: vi.fn(),
  signalPatterns: vi.fn(),
  signalDecisionHistory: vi.fn(),
  signalRecurrenceHistory: vi.fn(),
  signalDecisionEvent: vi.fn(),
  review: vi.fn(),
}}));

describe("пошаговая карточка сигнала", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.signal).mockResolvedValue(signalFixture);
    vi.mocked(api.signalPatterns).mockResolvedValue([]);
    vi.mocked(api.signalDecisionHistory).mockResolvedValue({entity_type: "signal", entity_fingerprint: "f".repeat(64), current_status: null, history_found: false, events: []});
    vi.mocked(api.signalRecurrenceHistory).mockResolvedValue({entity_fingerprint: "f".repeat(64), first_detected_at: null, last_detected_at: null, appeared_runs: 1, absent_runs: 0, last_expert_status: null, points: []});
  });

  it("отображает четыре этапа и одну закреплённую панель действий", async () => {
    render(<SignalPage/>);
    await screen.findByRole("heading", {name: "Компьютерная томография"});
    for (const label of ["Сводка", "Обоснование", "Связи", "Решение"]) {
      expect(screen.getByRole("link", {name: new RegExp(label)})).toBeInTheDocument();
    }
    expect(screen.getByRole("link", {name: /Сводка/})).toHaveAttribute("aria-current", "step");
    expect(screen.getAllByLabelText("Действия специалиста")).toHaveLength(1);
    expect(screen.getByRole("link", {name: "Следующий"})).toHaveAttribute("href", expect.stringContaining("/signals/11"));
    expect(screen.getAllByText(/Фактор (риска|приоритета)/).length).toBeLessThanOrEqual(3);
  });

  it("обновляет статус и историю без перезагрузки", async () => {
    const updated = {...signalFixture, status: "Подтверждён сигнал" as const, reviews: [{id: 1, status: "Подтверждён сигнал" as const, comment: "Данные сопоставлены.", reviewer_name: "Айдана Сарсенова", created_at: "2026-07-12T10:00:00"}]};
    vi.mocked(api.review).mockResolvedValue(updated);
    render(<SignalPage/>);
    await screen.findByRole("heading", {name: "Компьютерная томография"});
    fireEvent.click(screen.getByText("Другие действия"));
    fireEvent.click(await screen.findByRole("menuitem", {name: "Подтвердить сигнал"}));
    fireEvent.change(screen.getByLabelText("Комментарий специалиста"), {target: {value: "Данные сопоставлены."}});
    fireEvent.click(screen.getByRole("button", {name: "Сохранить решение"}));
    await waitFor(() => expect(screen.getAllByText("Решение сохранено").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Подтверждён сигнал").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", {name: /Перейти к следующему сигналу/})).toHaveAttribute("href", expect.stringContaining("/signals/11"));
  });

  it("показывает связанную повторяющуюся модель", async () => {
    vi.mocked(api.signalPatterns).mockResolvedValue([patternFixture]);
    render(<SignalPage/>);
    expect(await screen.findByRole("link", {name: /Повторяющаяся услуга: Холтеровское мониторирование/})).toHaveAttribute("href", "/patterns/7");
  });

  it("поддерживает клавиатурную навигацию этапов и сохраняет контекст возврата", async () => {
    render(<SignalPage/>);
    await screen.findByRole("heading", { name: "Компьютерная томография" });
    const summary = screen.getByRole("link", { name: /Сводка/ });
    summary.focus();
    fireEvent.keyDown(summary, { key: "ArrowRight" });
    expect(screen.getByRole("link", { name: /Обоснование/ })).toHaveFocus();
    expect(screen.getByRole("link", { name: "К разделу «Проверка»" })).toHaveAttribute("href", "/signals?priority_level=Высокий");
  });

  it("показывает detail skeleton во время загрузки", async () => {
    vi.mocked(api.signal).mockImplementationOnce(() => new Promise(() => undefined));
    render(<SignalPage/>);
    expect(screen.getByLabelText("Загрузка данных")).toHaveAttribute("data-skeleton", "detail");
    await waitFor(() => expect(api.signal).toHaveBeenCalled());
  });

  it("показывает понятную ошибку без технического текста", async () => {
    vi.mocked(api.signal).mockRejectedValueOnce(new Error("stack trace: connection reset"));
    render(<SignalPage/>);
    expect(await screen.findByText("Сигнал недоступен")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
  });
});
