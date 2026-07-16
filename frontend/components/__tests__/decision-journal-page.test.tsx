import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DecisionJournalPage from "@/app/decision-journal/page";
import { api } from "@/lib/api";

const replace = vi.fn();
let currentParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => currentParams,
}));
vi.mock("@/lib/api", () => ({api: {decisionJournal: vi.fn(), journalIntegrity: vi.fn()}}));

const event = {
  id: 4,
  entity_type: "signal" as const,
  entity_fingerprint: "f".repeat(64),
  current_entity_id: 10,
  object_present: true,
  analysis_run_id: 3,
  medical_organization_id: 4,
  action_type: "Сигнал подтверждён",
  decision_status: "Подтверждён сигнал",
  reason_code: "данные подтверждают отклонение",
  comment: "Сопоставлены доступные документы.",
  reviewer_display_name: "Специалист 01",
  created_at: "2026-07-13T09:30:00",
  supersedes_event_id: null,
  metadata: {object_name: "Компьютерная томография", organization_name: "Центр диагностики Оңтүстік"},
  feedback: null,
};

describe("журнал решений", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentParams = new URLSearchParams();
    vi.mocked(api.decisionJournal).mockResolvedValue({items: [event], total: 1, page: 1, page_size: 50, reviewers: ["Специалист 01"], actions: [event.action_type], decision_statuses: [event.decision_status], organizations: [{id: 4, label: "Центр диагностики Оңтүстік"}], object_types: [{value: "price_deviation", label: "Отклонение стоимости"}], analysis_runs: [3]});
    vi.mocked(api.journalIntegrity).mockResolvedValue({is_valid: true, checked_events: 1, mismatch_count: 0, details: [], checked_at: "2026-07-13T10:00:00", message: "Целостность истории проверена"});
  });

  it("показывает мобильные карточки и сокращённые настольные колонки", async () => {
    render(<DecisionJournalPage/>);
    expect(await screen.findByTestId("decision-journal-mobile-list")).toBeInTheDocument();
    for (const heading of ["Событие", "Объект", "Специалист", "Решение", "Дата", "Статус"]) expect(screen.getByRole("columnheader", {name: heading})).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", {name: "Причина"})).not.toBeInTheDocument();
  });

  it("открывает рабочий контекст события без служебных значений", async () => {
    render(<DecisionJournalPage/>);
    const triggers = await screen.findAllByRole("button", {name: "Открыть событие 4"});
    fireEvent.click(triggers[0]);
    expect(screen.getByRole("dialog")).toHaveTextContent("данные подтверждают отклонение");
    expect(screen.getByRole("dialog")).toHaveTextContent("Сопоставлены доступные документы");
    expect(screen.getByRole("link", {name: "Перейти к объекту"})).toHaveAttribute("href", "/signals/10");
    expect(screen.queryByText(event.entity_fingerprint)).not.toBeInTheDocument();
  });

  it("сохраняет основные и дополнительные фильтры в URL", async () => {
    render(<DecisionJournalPage/>);
    fireEvent.change(await screen.findByLabelText("Тип объекта"), { target: { value: "signal" } });
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("entity_type=signal"), { scroll: false });
    fireEvent.click(screen.getByRole("button", { name: /Дополнительные фильтры/ }));
    fireEvent.change(screen.getByLabelText("Специалист"), { target: { value: "Специалист 01" } });
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("reviewer="), { scroll: false });
  });

  it("закрывает preview по Escape и возвращает фокус", async () => {
    render(<DecisionJournalPage/>);
    const trigger = (await screen.findAllByRole("button", {name: "Открыть событие 4"}))[0];
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("удерживает фокус внутри event preview", async () => {
    render(<DecisionJournalPage/>);
    fireEvent.click((await screen.findAllByRole("button", {name: "Открыть событие 4"}))[0]);
    const dialog = screen.getByRole("dialog");
    const close = screen.getByRole("button", { name: "Закрыть" });
    const objectLink = screen.getByRole("link", { name: /Перейти к объекту/ });
    await waitFor(() => expect(close).toHaveFocus());
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(objectLink).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();
    expect(dialog).toContainElement(close);
  });

  it("показывает спокойное состояние целостности без hash и fingerprint", async () => {
    render(<DecisionJournalPage/>);
    expect(await screen.findByText("Целостность истории проверена")).toBeInTheDocument();
    expect(screen.queryByText(/fingerprint/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/hash/i)).not.toBeInTheDocument();
  });

  it("показывает одно рабочее empty state без технических сообщений", async () => {
    vi.mocked(api.decisionJournal).mockResolvedValue({items: [], total: 0, page: 1, page_size: 50, reviewers: [], actions: [], decision_statuses: [], organizations: [], object_types: [], analysis_runs: []});
    render(<DecisionJournalPage/>);
    expect(await screen.findByText("Экспертные решения пока не зафиксированы")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Перейти к проверке" })).toHaveAttribute("href", "/signals");
  });
});
