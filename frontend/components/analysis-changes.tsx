import { ArrowDownRight, ArrowUpRight, CheckCircle2, CircleMinus, GitCompareArrows, ScanSearch } from "lucide-react";
import type { AnalyticsChanges } from "@/lib/types";
import { money, number } from "@/lib/utils";
import { Card } from "./ui";

export function AnalysisChangesPanel({ data }: { data: AnalyticsChanges }) {
  return <Card className="p-5 md:p-6">
    <div className="flex items-center gap-2"><GitCompareArrows className="h-5 w-5 text-primary" aria-hidden="true"/><h2 className="text-lg font-bold">Что изменилось</h2></div>
    {!data.comparison_available ? <div className="mt-5 rounded-lg bg-muted p-5"><p className="font-semibold">Сравнение пока недоступно</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Сравнение станет доступно после следующего запуска анализа.</p></div> : <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Change icon={ScanSearch} value={number(data.new_signals)} text="новых сигналов появилось" tone="attention"/>
      <Change icon={CircleMinus} value={number(data.resolved_signals)} text="сигналов больше не формируются" tone="positive"/>
      <Change icon={ArrowUpRight} value={number(data.organizations_risk_increased)} text="организаций: риск вырос более чем на 10 пунктов" tone="attention"/>
      <Change icon={ArrowDownRight} value={number(data.organizations_risk_decreased)} text="организаций: риск снизился более чем на 10 пунктов" tone="positive"/>
      <Change icon={ArrowUpRight} value={money(data.review_amount_change)} text="изменение суммы услуг к проверке" tone={Number(data.review_amount_change) > 0 ? "attention" : "positive"}/>
      <Change icon={CheckCircle2} value={number(data.completed_reviews)} text="экспертных проверок завершено" tone="positive"/>
      <Change icon={GitCompareArrows} value={`${data.selected_for_review_rate_change >= 0 ? "+" : ""}${(data.selected_for_review_rate_change * 100).toLocaleString("ru-RU", {maximumFractionDigits: 1})} п. п.`} text="изменение доли записей к проверке" tone={data.selected_for_review_rate_change > 0 ? "attention" : "positive"}/>
    </div>}
  </Card>;
}

function Change({ icon: Icon, value, text, tone }: { icon: typeof ScanSearch; value: string; text: string; tone: "attention" | "positive" }) {
  return <div className="rounded-lg border border-border/70 bg-surface-raised p-4"><div className="flex items-center gap-2"><span className={tone === "positive" ? "grid h-8 w-8 place-items-center rounded-md bg-success-soft text-success" : "grid h-8 w-8 place-items-center rounded-md bg-warning-soft text-amber-800"}><Icon className="h-4 w-4" aria-hidden="true"/></span><strong className="font-mono text-xl tracking-tight tabular-nums">{value}</strong></div><p className="mt-3 text-sm leading-5 text-muted-foreground">{text}</p></div>;
}
