import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DecisionJournalPage from "@/app/decision-journal/page";
import { api } from "@/lib/api";

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
    vi.mocked(api.decisionJournal).mockResolvedValue({items: [event], total: 1, page: 1, page_size: 50, reviewers: ["Специалист 01"], actions: [event.action_type], decision_statuses: [event.decision_status], organizations: [{id: 4, label: "Центр диагностики Оңтүстік"}], object_types: [{value: "price_deviation", label: "Отклонение стоимости"}], analysis_runs: [3]});
    vi.mocked(api.journalIntegrity).mockResolvedValue({is_valid: true, checked_events: 1, mismatch_count: 0, details: [], checked_at: "2026-07-13T10:00:00", message: "Целостность истории проверена"});
  });

  it("показывает мобильные карточки и сокращённые настольные колонки", async () => {
    render(<DecisionJournalPage/>);
    expect(await screen.findByTestId("decision-journal-mobile-list")).toBeInTheDocument();
    for (const heading of ["Дата", "Объект", "Действие", "Решение", "Специалист", "Организация"]) expect(screen.getByRole("columnheader", {name: heading})).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", {name: "Причина"})).not.toBeInTheDocument();
  });

  it("открывает рабочий контекст события без служебных значений", async () => {
    render(<DecisionJournalPage/>);
    fireEvent.click(await screen.findByRole("button", {name: "Открыть событие 4"}));
    expect(screen.getByRole("dialog")).toHaveTextContent("данные подтверждают отклонение");
    expect(screen.getByRole("dialog")).toHaveTextContent("Сопоставлены доступные документы");
    expect(screen.getByRole("link", {name: "Перейти к объекту"})).toHaveAttribute("href", "/signals/10");
    expect(screen.queryByText(event.entity_fingerprint)).not.toBeInTheDocument();
  });
});
