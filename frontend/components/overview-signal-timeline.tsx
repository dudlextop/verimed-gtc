"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TimelinePoint } from "@/lib/types";
import { number } from "@/lib/utils";
import { chartTheme, chartTick, chartTooltipStyle } from "@/lib/chart-theme";
import { EmptyState } from "@/components/foundation";

export function OverviewSignalTimeline({ data }: { data?: TimelinePoint[] }) {
  if (data === undefined) {
    return <EmptyState variant="error" title="Динамика недоступна" description="Обзор загружен, но временной ряд не получен. Остальные показатели остаются актуальными." />;
  }
  if (data.length === 0) {
    return <EmptyState title="История сигналов пока отсутствует" description="Динамика появится после сохранения нескольких периодов анализа." />;
  }
  if (data.length < 2) {
    return <EmptyState variant="insufficient" title="Недостаточно периодов для динамики" description="Для сравнения требуется не менее двух фактических периодов." />;
  }

  return (
    <div>
      <div className="h-72" role="img" aria-label={`Динамика сигналов за ${data.length} периодов`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: -18, right: 12, top: 12, bottom: 4 }}>
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 4" vertical={false} />
            <XAxis dataKey="period" tick={chartTick} tickLine={false} axisLine={false} />
            <YAxis tick={chartTick} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={chartTooltipStyle}
              cursor={{ stroke: chartTheme.grid }}
              formatter={(value: number) => [number(value), "Сигналы"]}
            />
            <Line
              type="linear"
              dataKey="signals"
              name="Сигналы"
              stroke={chartTheme.primary}
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: chartTheme.surface, stroke: chartTheme.primary, strokeWidth: 2 }}
              activeDot={{ r: 5, fill: chartTheme.surface, stroke: chartTheme.primary, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="sr-only" aria-label="Текстовая альтернатива динамики сигналов">
        {data.map((point) => <p key={point.period}>{point.period}: {number(point.signals)} сигналов</p>)}
      </div>
    </div>
  );
}
