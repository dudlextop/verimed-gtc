"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, MoveDownRight, MoveUpRight } from "lucide-react";
import type { OrganizationComparison as ComparisonData, OrganizationComparisonItem } from "@/lib/types";
import { money, number, percent } from "@/lib/utils";
import { Button, Card, InlineNotice, SectionHeader } from "./ui";

const MONEY_METRICS = new Set(["average_cost_per_patient", "median_cost", "signal_services_amount"]);
const SHARE_METRICS = new Set(["repeat_share", "high_cost_share", "month_end_share", "high_critical_share"]);

export function OrganizationComparisonBlock({data}: {data: ComparisonData}) {
  const [expanded, setExpanded] = useState(false);
  if (!data.items.length) return <Card className="p-6"><SectionHeader title="Сравнение с сопоставимыми организациями"/><div className="mt-4"><InlineNotice title="Сравнение недоступно" description="Недостаточно сопоставимых организаций для устойчивого вывода."/></div></Card>;
  const ordered = [...data.items].sort((a,b) => Math.abs(b.deviation_percent) - Math.abs(a.deviation_percent));
  const visible = expanded || ordered.length <= 6 ? ordered : ordered.slice(0, 4);
  return <Card className="p-5 md:p-6">
    <SectionHeader title="Сравнение с сопоставимыми организациями" description={`Группа: ${number(data.peer_group_size)} организаций · надёжность: ${data.reliability}`}/>
    {data.limitation && <div className="mt-4"><InlineNotice tone="warning" title="Ограниченная сопоставимость" description={data.limitation}/></div>}
    <div className="mt-5 grid gap-3 md:grid-cols-2">{visible.map(item => <ComparisonMetric key={item.metric_key} item={item}/>)}</div>
    {ordered.length > 6 && <Button variant="ghost" className="mt-4" onClick={() => setExpanded(value => !value)}>{expanded ? <ChevronUp className="h-4 w-4" aria-hidden="true"/> : <ChevronDown className="h-4 w-4" aria-hidden="true"/>}{expanded ? "Скрыть дополнительные показатели" : "Показать все показатели"}</Button>}
  </Card>;
}

function formatMetric(item: OrganizationComparisonItem, value: number): string {
  if (MONEY_METRICS.has(item.metric_key)) return money(value);
  if (SHARE_METRICS.has(item.metric_key)) return percent(value);
  return new Intl.NumberFormat("ru-RU", {maximumFractionDigits: 1}).format(value);
}

function ComparisonMetric({item}: {item: OrganizationComparisonItem}) {
  const higher = item.deviation_percent >= 0;
  const position = `${item.position}-е место из ${item.peer_group_size}`;
  const values = [item.value, item.peer_median, item.typical_low, item.typical_high];
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = Math.max(rawMax - rawMin, Math.abs(rawMax) * 0.1, 1);
  const min = rawMin - span * 0.12;
  const max = rawMax + span * 0.12;
  const place = (value: number) => `${Math.min(96, Math.max(4, ((value - min) / (max - min)) * 100))}%`;
  const rangeLeft = ((item.typical_low - min) / (max - min)) * 100;
  const rangeWidth = Math.max(3, ((item.typical_high - item.typical_low) / (max - min)) * 100);
  return <div className="rounded-lg border border-border/75 bg-surface-raised p-4">
    <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold leading-5">{item.metric_label}</p><span className={higher ? "flex shrink-0 items-center gap-1 text-sm font-semibold text-amber-800" : "flex shrink-0 items-center gap-1 text-sm font-semibold text-success"}>{higher ? <MoveUpRight className="h-4 w-4" aria-hidden="true"/> : <MoveDownRight className="h-4 w-4" aria-hidden="true"/>}{Math.abs(item.deviation_percent).toLocaleString("ru-RU", {maximumFractionDigits: 1})}%</span></div>
    <div className="mt-4 grid grid-cols-2 gap-3"><div><p className="metric-label">Организация</p><p className="mt-1 font-mono text-lg font-bold text-primary tabular-nums">{formatMetric(item, item.value)}</p></div><div><p className="metric-label">Медиана группы</p><p className="mt-1 font-mono text-lg font-bold tabular-nums">{formatMetric(item, item.peer_median)}</p></div></div>
    <div className="mt-4" aria-label={`Значение организации ${formatMetric(item, item.value)}, медиана ${formatMetric(item, item.peer_median)}, типичный диапазон от ${formatMetric(item, item.typical_low)} до ${formatMetric(item, item.typical_high)}`}>
      <div className="relative h-2 rounded-full bg-muted"><span className="absolute top-0 h-2 rounded-full bg-stability/20" style={{left: `${rangeLeft}%`, width: `${rangeWidth}%`}}/><span className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-foreground/45" style={{left: place(item.peer_median)}}/><span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary shadow-sm" style={{left: place(item.value)}}/></div>
      <div className="mt-2 flex items-center justify-between text-[0.6875rem] text-muted-foreground"><span>Типичный диапазон</span><span>{position}</span></div>
    </div>
    <p className="mt-3 text-sm leading-5 text-muted-foreground">{item.explanation}</p>
  </div>;
}
