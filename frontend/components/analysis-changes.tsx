import { ArrowDownRight, ArrowUpRight, CheckCircle2, CircleMinus, GitCompareArrows, ScanSearch } from "lucide-react";
import type { AnalyticsChanges } from "@/lib/types";
import { money, number } from "@/lib/utils";
import { DataPanel, InlineNotice } from "@/components/foundation";

export function AnalysisChangesPanel({ data }: { data: AnalyticsChanges }) {
  if (!data.comparison_available) {
    return (
      <DataPanel title="Что изменилось" description="Сравнение текущего анализа с предыдущим запуском.">
        <InlineNotice
          title="Сравнение пока недоступно"
          description="Сравнение станет доступно после следующего запуска анализа."
        />
      </DataPanel>
    );
  }

  const secondary = [
    { icon: CircleMinus, value: number(data.resolved_signals), text: "сигналов больше не формируются", tone: "positive" as const },
    { icon: ArrowDownRight, value: number(data.organizations_risk_decreased), text: "организаций со снижением оценки риска", tone: "positive" as const },
    {
      icon: GitCompareArrows,
      value: `${data.selected_for_review_rate_change >= 0 ? "+" : ""}${(data.selected_for_review_rate_change * 100).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} п. п.`,
      text: "изменение доли записей к проверке",
      tone: data.selected_for_review_rate_change > 0 ? "attention" as const : "positive" as const,
    },
  ];

  return (
    <DataPanel title="Что изменилось" description="Короткие изменения, которые влияют на текущую проверку.">
      <div className="grid gap-px overflow-hidden rounded-v2-card border border-v2-border bg-v2-border sm:grid-cols-2 xl:grid-cols-4">
        <Change icon={ScanSearch} value={number(data.new_signals)} text="новых сигналов появилось" tone="attention" />
        <Change icon={ArrowUpRight} value={number(data.organizations_risk_increased)} text="организаций с ростом оценки риска" tone="attention" />
        <Change icon={ArrowUpRight} value={money(data.review_amount_change, true)} text="изменение финансовой значимости" tone={Number(data.review_amount_change) > 0 ? "attention" : "positive"} />
        <Change icon={CheckCircle2} value={number(data.completed_reviews)} text="экспертных проверок завершено" tone="positive" />
      </div>
      <details className="group mt-4">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-v2-control px-2 text-sm font-semibold text-v2-primary hover:bg-v2-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary">
          Дополнительные изменения
        </summary>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {secondary.map((item) => <Change key={item.text} {...item} standalone />)}
        </div>
      </details>
    </DataPanel>
  );
}

function Change({
  icon: Icon,
  value,
  text,
  tone,
  standalone = false,
}: {
  icon: typeof ScanSearch;
  value: string;
  text: string;
  tone: "attention" | "positive";
  standalone?: boolean;
}) {
  return (
    <div className={standalone ? "rounded-v2-card border border-v2-border bg-v2-surface p-4" : "min-w-0 bg-v2-surface p-4"}>
      <div className="flex items-center gap-3">
        <span className={tone === "positive" ? "grid h-9 w-9 shrink-0 place-items-center rounded-v2-control bg-v2-success-soft text-v2-success-text" : "grid h-9 w-9 shrink-0 place-items-center rounded-v2-control bg-v2-warning-soft text-v2-warning-text"}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <strong className="v2-tabular text-xl font-bold tracking-[-0.03em] text-v2-text">{value}</strong>
      </div>
      <p className="mt-3 text-sm leading-5 text-v2-text-secondary">{text}</p>
    </div>
  );
}
