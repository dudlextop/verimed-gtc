import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FinancialDisclaimer } from "@/components/financial-disclaimer";
import { OrganizationComparisonBlock } from "@/components/organization-comparison";
import { PriorityBadge } from "@/components/priority-badge";
import { PrioritySparkline } from "@/components/priority-sparkline";
import { RiskBadge } from "@/components/risk-badge";

const comparison = {
  organization_id: 1,
  analysis_run_id: 4,
  peer_group_size: 4,
  reliability: "Средняя",
  limitation: "В регионе недостаточно сопоставимых организаций. Критерии группы расширены.",
  items: [{metric_key: "repeat_share", metric_label: "Доля повторных услуг", value: 0.184, peer_median: 0.071, typical_low: 0.05, typical_high: 0.09, deviation_percent: 159.2, position: 1, peer_group_size: 4, reliability: "Средняя", limitation: "Критерии расширены", explanation: "Показатель выше медианы сопоставимой группы на 159,2%."}],
};

describe("финансовая значимость и приоритет", () => {
  it("терминологически разделяет риск и приоритет", () => {
    render(<div><RiskBadge level="Высокий"/><PriorityBadge level="Высокий"/></div>);
    expect(screen.getByText("Высокий")).toBeInTheDocument();
    expect(screen.getByText("Приоритет: Высокий")).toBeInTheDocument();
  });

  it("показывает обязательное пояснение финансовой значимости", () => {
    render(<FinancialDisclaimer/>);
    expect(screen.getByText("Финансовая значимость не означает подтверждённое нарушение.")).toBeInTheDocument();
  });

  it("показывает сравнение и ограничение малой группы", () => {
    render(<OrganizationComparisonBlock data={comparison}/>);
    expect(screen.getByText("Сравнение с сопоставимой группой")).toBeInTheDocument();
    expect(screen.getByText(/Критерии группы расширены/)).toBeInTheDocument();
    expect(screen.getByText("Доля повторных услуг")).toBeInTheDocument();
  });

  it("рисует мини-график только при наличии трёх запусков", () => {
    const history = [
      {analysis_run_id: 1, period: "01.07", value: 60, level: "Высокий" as const, financial_significance: "100000"},
      {analysis_run_id: 2, period: "08.07", value: 67, level: "Высокий" as const, financial_significance: "120000"},
      {analysis_run_id: 3, period: "12.07", value: 74, level: "Высокий" as const, financial_significance: "150000"},
    ];
    render(<PrioritySparkline history={history}/>);
    expect(screen.getByLabelText(/Динамика приоритета/)).toBeInTheDocument();
    expect(screen.getAllByText(/показатель вырос/).length).toBeGreaterThan(0);
  });

  it("объясняет отсутствие истории", () => {
    render(<PrioritySparkline history={[]}/>);
    expect(screen.getByText("Динамика появится после нескольких запусков анализа.")).toBeInTheDocument();
  });
});
