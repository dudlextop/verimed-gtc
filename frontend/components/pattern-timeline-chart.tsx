"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PatternTimelinePoint, RecurrenceHistory } from "@/lib/types";
import { dateText, money, number } from "@/lib/utils";
import { chartTheme, chartTick, chartTooltipStyle } from "@/lib/chart-theme";
import { EmptyState } from "./foundation";

export function PatternTimelineChart({ recurrence, timeline }: { recurrence: RecurrenceHistory; timeline: PatternTimelinePoint[] }) {
  const points = recurrence.points
    .filter((point) => point.importance_score !== null || point.stability_score !== null)
    .map((point) => ({
      period: dateText(point.appeared_at),
      importance: point.importance_score,
      stability: point.stability_score,
    }));
  const latestTimeline = timeline.at(-1);

  if (points.length < 2) {
    return <EmptyState variant="insufficient" title="Недостаточно данных для динамики" description="Для сравнения важности и устойчивости требуется не менее двух появлений модели." />;
  }

  return <div>
    <div className="h-72 w-full" role="img" aria-label="График изменения важности и устойчивости модели по появлениям">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 16, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 4" vertical={false} stroke={chartTheme.grid} />
          <XAxis dataKey="period" tick={chartTick} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={chartTick} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={chartTooltipStyle} formatter={(value, name) => [number(Number(value)), name === "importance" ? "Важность" : "Устойчивость"]} labelFormatter={(label) => `Появление: ${label}`} />
          <Legend verticalAlign="top" align="right" height={32} formatter={(value) => value === "importance" ? "Важность" : "Устойчивость"} />
          <Line type="monotone" dataKey="importance" name="importance" stroke={chartTheme.importance} strokeWidth={2.5} dot={{ r: 3, fill: chartTheme.surface, strokeWidth: 2 }} activeDot={{ r: 5 }} connectNulls={false} />
          <Line type="monotone" dataKey="stability" name="stability" stroke={chartTheme.stability} strokeWidth={2.5} dot={{ r: 3, fill: chartTheme.surface, strokeWidth: 2 }} activeDot={{ r: 5 }} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
    <p className="mt-3 text-xs leading-5 text-v2-text-secondary">Линии используют историю фактических появлений модели. Пропущенные значения не достраиваются.</p>
    {latestTimeline && <dl className="mt-4 grid gap-3 border-t border-v2-border pt-4 sm:grid-cols-2">
      <div><dt className="text-xs font-semibold text-v2-text-secondary">Связанные сигналы в последнем периоде</dt><dd className="v2-tabular mt-1 text-sm font-bold text-v2-text">{number(latestTimeline.signal_count)}</dd></div>
      <div><dt className="text-xs font-semibold text-v2-text-secondary">Финансовая значимость периода</dt><dd className="v2-tabular mt-1 text-sm font-bold text-v2-teal-text">{money(latestTimeline.financial_significance)}</dd></div>
    </dl>}
  </div>;
}
