import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReviewsPage from "@/app/reviews/page";
import { api } from "@/lib/api";
import type { ExpertReviewSummary } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  api: {
    expertReviewSummary: vi.fn(),
    expertReviewBySignalType: vi.fn(),
    expertReviewByPatternType: vi.fn(),
  },
}));

const sufficient: ExpertReviewSummary = {
  reviewed_signals: 12,
  reviewed_patterns: 4,
  confirmed_share: 0.5,
  rejected_share: 0.25,
  escalated_share: 0.25,
  average_first_decision_hours: 3.2,
  average_completion_hours: 8.5,
  signals_without_decision: 30,
  patterns_without_decision: 7,
  in_progress: 3,
  completed_current_period: 8,
  sample_sufficient: true,
  sample_message: null,
  usefulness_distribution: { "Полезны": 7, "Частично полезны": 3, "Не помогли": 2 },
  explanation_quality_distribution: { "Понятные": 8, "Требуют уточнения": 4 },
  priority_correctness_distribution: { "Корректен": 9, "Требует уточнения": 3 },
};

describe("результаты экспертной оценки", () => {
  beforeEach(() => {
    vi.mocked(api.expertReviewSummary).mockResolvedValue(sufficient);
    vi.mocked(api.expertReviewBySignalType).mockResolvedValue([{ category: "Отклонение стоимости", total: 8, confirmed: 4, rejected: 2, escalated: 2 }]);
    vi.mocked(api.expertReviewByPatternType).mockResolvedValue([{ category: "Связанная группа пациентов", total: 4, confirmed: 2, rejected: 1, escalated: 1 }]);
  });

  it("показывает компактные метрики и две фактические визуализации", async () => {
    render(<ReviewsPage />);
    expect(await screen.findByRole("heading", { name: "Результаты экспертной оценки" })).toBeInTheDocument();
    expect(screen.getByText("16")).toBeInTheDocument();
    expect(screen.getByText(/50(?:,0)?\s?%/)).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: "Распределение экспертных решений" })).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: "Оценка полезности сигналов" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Открыть журнал решений/ })).toHaveAttribute("href", "/decision-journal");
  });

  it("при недостаточной выборке показывает одно честное состояние без графиков", async () => {
    vi.mocked(api.expertReviewSummary).mockResolvedValue({
      ...sufficient,
      reviewed_signals: 0,
      reviewed_patterns: 0,
      confirmed_share: null,
      rejected_share: null,
      escalated_share: null,
      sample_sufficient: false,
      sample_message: "Недостаточно завершённых проверок для устойчивого вывода.",
      usefulness_distribution: {},
    });
    render(<ReviewsPage />);
    expect(await screen.findByText("Недостаточно завершённых проверок")).toBeInTheDocument();
    expect(screen.getByText("Недостаточно завершённых проверок для устойчивого вывода.")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Распределение экспертных решений" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Оценка полезности сигналов" })).not.toBeInTheDocument();
  });

  it("показывает понятную ошибку и повторную попытку", async () => {
    vi.mocked(api.expertReviewSummary).mockRejectedValue(new Error("network"));
    render(<ReviewsPage />);
    expect(await screen.findByText("Не удалось загрузить результаты экспертной оценки")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
  });
});
