"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ExpertReviewSummary } from "@/lib/types";
import { number, percent } from "@/lib/utils";
import { chartTheme, chartTick, chartTooltipStyle } from "@/lib/chart-theme";
import { EmptyState } from "@/components/foundation";

const decisionColors = [chartTheme.primary, chartTheme.finance, "var(--v2-warning)"];

export function ExpertDecisionDistribution({ data }: { data: ExpertReviewSummary }) {
  const chartData = [
    { name: "Подтверждены", value: data.confirmed_share },
    { name: "Не подтверждены", value: data.rejected_share },
    { name: "Углублённая проверка", value: data.escalated_share },
  ].flatMap((item) => item.value === null ? [] : [{ ...item, percent: item.value * 100 }]);

  if (!chartData.length) {
    return <EmptyState variant="insufficient" title="Распределение решений пока недоступно" description="Доли появятся после достаточного числа завершённых экспертных проверок." />;
  }

  return (
    <div>
      <div className="h-64" role="img" aria-label="Распределение экспертных решений">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 18 }}>
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 4" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={chartTick} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
            <YAxis type="category" dataKey="name" width={132} tick={{ ...chartTick, fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "var(--v2-surface-soft)" }} formatter={(value: number) => [`${value.toFixed(1).replace(".", ",")}%`, "Доля"]} />
            <Bar dataKey="percent" radius={[0, 6, 6, 0]} isAnimationActive={false}>
              {chartData.map((item, index) => <Cell key={item.name} fill={decisionColors[index]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="sr-only" aria-label="Текстовая альтернатива распределения решений">
        {chartData.map((item) => <p key={item.name}>{item.name}: {percent(item.value)}</p>)}
      </div>
    </div>
  );
}

export function ExpertUsefulnessDistribution({ values }: { values: Record<string, number> }) {
  const chartData = Object.entries(values).map(([name, value]) => ({ name, value }));
  if (!chartData.length) {
    return <EmptyState variant="insufficient" title="Оценки полезности пока не собраны" description="Распределение появится после экспертной обратной связи по завершённым проверкам." />;
  }

  return (
    <div>
      <div className="h-64" role="img" aria-label="Оценка полезности сигналов">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ left: -16, right: 12, top: 8 }}>
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 4" vertical={false} />
            <XAxis dataKey="name" tick={{ ...chartTick, fontSize: 11 }} tickLine={false} axisLine={false} interval={0} />
            <YAxis allowDecimals={false} tick={chartTick} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "var(--v2-surface-soft)" }} formatter={(value: number) => [number(value), "Ответы"]} />
            <Bar dataKey="value" fill={chartTheme.finance} radius={[6, 6, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="sr-only" aria-label="Текстовая альтернатива оценки полезности">
        {chartData.map((item) => <p key={item.name}>{item.name}: {number(item.value)}</p>)}
      </div>
    </div>
  );
}
