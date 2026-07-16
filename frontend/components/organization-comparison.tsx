"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, MoveDownRight, MoveUpRight } from "lucide-react";
import type { OrganizationComparison as ComparisonData, OrganizationComparisonItem } from "@/lib/types";
import { money, number, percent } from "@/lib/utils";
import { Button, DataPanel, EmptyState, InlineNotice, SectionHeader } from "./foundation";

const MONEY_METRICS = new Set(["average_cost_per_patient", "median_cost", "signal_services_amount"]);
const SHARE_METRICS = new Set(["repeat_share", "high_cost_share", "month_end_share", "high_critical_share"]);

export function OrganizationComparisonBlock({ data }: { data: ComparisonData }) {
  const [expanded, setExpanded] = useState(false);
  if (!data.items.length) return <DataPanel><EmptyState variant="insufficient" title="Сравнение недоступно" description="Недостаточно сопоставимых организаций для устойчивого вывода."/></DataPanel>;

  const ordered = [...data.items].sort((a, b) => Math.abs(b.deviation_percent) - Math.abs(a.deviation_percent));
  const visible = expanded ? ordered : ordered.slice(0, 4);
  const disclosureId = "organization-comparison-additional";

  return <DataPanel className="scroll-mt-28">
    <SectionHeader
      id="organization-comparison-title"
      title="Сравнение с сопоставимой группой"
      description={`Организация сопоставлена с ${number(data.peer_group_size)} организациями. Надёжность сравнения: ${data.reliability.toLocaleLowerCase("ru-RU")}.`}
    />
    {data.limitation && <div className="mt-4"><InlineNotice tone="warning" title="Ограниченная сопоставимость" description={data.limitation}/></div>}
    <div id={disclosureId} className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{visible.map((item) => <ComparisonMetric key={item.metric_key} item={item}/>)}</div>
    {ordered.length > 4 && <Button variant="ghost" className="mt-4" aria-expanded={expanded} aria-controls={disclosureId} onClick={() => setExpanded((value) => !value)}>{expanded ? <ChevronUp className="h-4 w-4" aria-hidden="true"/> : <ChevronDown className="h-4 w-4" aria-hidden="true"/>}{expanded ? "Скрыть дополнительные показатели" : `Показать ещё ${ordered.length - 4}`}</Button>}
  </DataPanel>;
}

function formatMetric(item: OrganizationComparisonItem, value: number): string {
  if (MONEY_METRICS.has(item.metric_key)) return money(value);
  if (SHARE_METRICS.has(item.metric_key)) return percent(value);
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value);
}

function ComparisonMetric({ item }: { item: OrganizationComparisonItem }) {
  const higher = item.deviation_percent >= 0;
  const values = [item.value, item.peer_median, item.typical_low, item.typical_high];
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = Math.max(rawMax - rawMin, Math.abs(rawMax) * 0.1, 1);
  const min = rawMin - span * 0.12;
  const max = rawMax + span * 0.12;
  const place = (value: number) => Math.min(96, Math.max(4, ((value - min) / (max - min)) * 100));
  const rangeLeft = Math.max(0, place(item.typical_low));
  const rangeRight = Math.min(100, place(item.typical_high));
  const deviation = `${Math.abs(item.deviation_percent).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%`;
  const textualAlternative = `Значение организации ${formatMetric(item, item.value)}. Медиана группы ${formatMetric(item, item.peer_median)}. Типичный диапазон от ${formatMetric(item, item.typical_low)} до ${formatMetric(item, item.typical_high)}. ${higher ? "Выше" : "Ниже"} медианы на ${deviation}.`;

  return <article className="min-w-0 rounded-v2-card bg-v2-surface-soft p-4" aria-label={textualAlternative}>
    <div className="flex min-h-12 items-start justify-between gap-3">
      <h3 className="text-sm font-bold leading-5 text-v2-text">{item.metric_label}</h3>
      <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-v2-primary">{higher ? <MoveUpRight className="h-4 w-4" aria-hidden="true"/> : <MoveDownRight className="h-4 w-4" aria-hidden="true"/>}{higher ? "Выше" : "Ниже"} на {deviation}</span>
    </div>
    <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-v2-border pt-3">
      <div><dt className="text-xs font-semibold text-v2-text-secondary">Организация</dt><dd className="v2-tabular mt-1 text-lg font-bold text-v2-primary">{formatMetric(item, item.value)}</dd></div>
      <div><dt className="text-xs font-semibold text-v2-text-secondary">Медиана</dt><dd className="v2-tabular mt-1 text-lg font-bold text-v2-text">{formatMetric(item, item.peer_median)}</dd></div>
    </dl>
    <div className="mt-4" aria-hidden="true">
      <div className="relative h-2 rounded-full bg-v2-border">
        <span className="absolute top-0 h-2 rounded-full bg-v2-cyan/35" style={{ left: `${rangeLeft}%`, width: `${Math.max(3, rangeRight - rangeLeft)}%` }}/>
        <span className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-v2-text-muted" style={{ left: `${place(item.peer_median)}%` }}/>
        <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-v2-surface bg-v2-primary shadow-v2-dropdown" style={{ left: `${place(item.value)}%` }}/>
      </div>
    </div>
    <p className="mt-2 text-xs leading-5 text-v2-text-secondary">Типичный диапазон: {formatMetric(item, item.typical_low)}–{formatMetric(item, item.typical_high)} · {item.position}-е место из {item.peer_group_size}</p>
    <p className="mt-3 text-sm leading-5 text-v2-text-secondary">{item.explanation}</p>
  </article>;
}
