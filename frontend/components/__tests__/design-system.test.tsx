import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImportanceBadge, StabilityBadge } from "@/components/pattern-badges";
import { PriorityBadge } from "@/components/priority-badge";
import { RiskBadge } from "@/components/risk-badge";
import { Button, FinancialValue, InlineNotice } from "@/components/foundation";

describe("визуальная семантика Verimed", () => {
  it("разделяет рабочий приоритет, риск, важность и устойчивость", () => {
    render(<div><PriorityBadge level="Высокий"/><RiskBadge level="Высокий"/><ImportanceBadge level="Высокий"/><StabilityBadge level="Высокая" score={74}/></div>);
    expect(screen.getByText("Приоритет: Высокий").closest("[data-domain-indicator]")).toHaveAttribute("data-domain-indicator", "priority");
    expect(screen.getByText("Важность: Высокий").closest("[data-domain-indicator]")).toHaveAttribute("data-domain-indicator", "importance");
    expect(screen.getByText(/Устойчивость: Высокая/).closest("[data-domain-indicator]")).toHaveAttribute("data-domain-indicator", "stability");
    expect(screen.getByText("Риск:").closest("[data-domain-indicator]")).toHaveAttribute("data-domain-indicator", "risk");
  });

  it("показывает финансовую значимость как масштаб", () => {
    render(<FinancialValue label="Финансовая значимость" value="4 800 000 ₸"/>);
    expect(screen.getByText("4 800 000 ₸").closest("span")?.parentElement?.parentElement).toHaveClass("text-v2-teal-text");
  });

  it("сохраняет доступные состояния действий и уведомлений", () => {
    render(<div><Button>Продолжить проверку</Button><InlineNotice tone="success" title="Решение сохранено"/></div>);
    expect(screen.getByRole("button", {name: "Продолжить проверку"})).toHaveClass("min-h-11", "focus-visible:ring-2");
    expect(screen.getByText("Решение сохранено")).toBeInTheDocument();
  });
});
