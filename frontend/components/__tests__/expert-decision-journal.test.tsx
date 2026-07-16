import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DecisionTimeline, RecurrenceHistoryCard } from "@/components/decision-timeline";
import type { DecisionHistory, RecurrenceHistory } from "@/lib/types";

const history: DecisionHistory = {
  entity_type: "signal",
  entity_fingerprint: "a".repeat(64),
  current_status: "Направлено на углублённую проверку",
  history_found: true,
  events: [
    {
      id: 1, entity_type: "signal", entity_fingerprint: "a".repeat(64), current_entity_id: 10, object_present: true, analysis_run_id: 3, medical_organization_id: 4,
      action_type: "Сигнал подтверждён", decision_status: "Подтверждён сигнал", reason_code: "данные подтверждают отклонение", comment: "Доступные сведения сопоставлены.", reviewer_display_name: "Айдана Сарсенова", created_at: "2026-07-12T10:00:00", supersedes_event_id: null, metadata: { object_name: "Сигнал по услуге" }, feedback: null,
    },
    {
      id: 2, entity_type: "signal", entity_fingerprint: "a".repeat(64), current_entity_id: 10, object_present: true, analysis_run_id: 4, medical_organization_id: 4,
      action_type: "Решение уточнено", decision_status: "Направлено на углублённую проверку", reason_code: "требуется запрос документов", comment: "Нужны дополнительные сведения.", reviewer_display_name: "Айдана Сарсенова", created_at: "2026-07-13T11:00:00", supersedes_event_id: 1, metadata: { object_name: "Сигнал по услуге" }, feedback: { usefulness: "Полезный", explanation_quality: "Понятное", data_sufficiency: "Частично достаточно", priority_correctness: "Корректен", grouping_correctness: null, graph_usefulness: null, comment: "" },
    },
  ],
};

const recurrence: RecurrenceHistory = {
  entity_fingerprint: "a".repeat(64), first_detected_at: "2026-07-12T09:00:00", last_detected_at: "2026-07-13T09:00:00", appeared_runs: 2, absent_runs: 1, last_expert_status: "Направлено на углублённую проверку",
  points: [{ analysis_run_id: 3, appeared_at: "2026-07-12T09:00:00", risk_score: 82, priority_score: 88, stability_score: null, importance_score: null, financial_significance: "450000", signal_count: null, status: "Подтверждён сигнал", participant_signature: null }],
};

describe("долговременный экспертный контур", () => {
  it("показывает неизменяемую хронологию и уточнение решения", () => {
    const refine = vi.fn(); render(<DecisionTimeline history={history} onRefine={refine}/>);
    expect(screen.getByText("Доступные сведения сопоставлены.")).toBeInTheDocument();
    expect(screen.getByText("Нужны дополнительные сведения.")).toBeInTheDocument();
    expect(screen.getByText(/Уточняет событие № 1/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Уточнить решение" })[0]);
    expect(refine).toHaveBeenCalledWith(1);
  });

  it("показывает историю повторного появления", () => {
    render(<RecurrenceHistoryCard data={recurrence} kind="signal"/>);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/Риск 82/)).toBeInTheDocument();
  });

  it("показывает состояние первого обнаружения", () => {
    render(<RecurrenceHistoryCard data={{ ...recurrence, points: [], appeared_runs: 0 }} kind="pattern"/>);
    expect(screen.getByText("Эта модель обнаружена впервые")).toBeInTheDocument();
  });
});
