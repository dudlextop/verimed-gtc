import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalysisChangesPanel } from "@/components/analysis-changes";
import { CommandCenter, PRIORITY_QUEUE_URL } from "@/components/command-center";
import { commandCenterFixture } from "./fixtures";

describe("командный центр V2", () => {
  it("показывает рабочий приоритет на светлой поверхности", () => {
    render(<CommandCenter data={commandCenterFixture} />);
    expect(screen.getByText("Требуют внимания")).toBeInTheDocument();
    expect(screen.getByTestId("command-center")).toHaveAttribute("data-command-theme", "light");
    expect(screen.getByText("Центр диагностики № 4")).toBeInTheDocument();
    expect(screen.getByText("47")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Открыть аналитический обзор" })).toHaveAttribute("href", "/overview");
  });

  it("открывает правильно отфильтрованную очередь", () => {
    render(<CommandCenter data={commandCenterFixture} />);
    expect(screen.getByRole("link", { name: "Перейти к проверке" })).toHaveAttribute("href", PRIORITY_QUEUE_URL);
  });

  it("объясняет отсутствие предыдущего запуска", () => {
    render(<AnalysisChangesPanel data={{ comparison_available: false, current_run_id: 1, previous_run_id: null, new_signals: 0, resolved_signals: 0, organizations_risk_increased: 0, organizations_risk_decreased: 0, review_amount_change: "0", completed_reviews: 0, selected_for_review_rate_change: 0 }} />);
    expect(screen.getByText("Сравнение станет доступно после следующего запуска анализа.")).toBeInTheDocument();
  });
});
