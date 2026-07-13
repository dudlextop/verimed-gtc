"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PatternTimelinePoint } from "@/lib/types";
import { money, number } from "@/lib/utils";
import { chartTheme, chartTick, chartTooltipStyle } from "@/lib/chart-theme";

export function PatternTimelineChart({ data }: { data: PatternTimelinePoint[] }) {
  if (data.length < 2) return <div className="rounded-lg border border-dashed border-border-strong bg-surface-soft p-5"><p className="font-semibold">Недостаточно данных для динамики</p><p className="mt-2 text-sm text-muted-foreground">Для отображения устойчивой последовательности требуется несколько периодов наблюдений.</p></div>;
  return <div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 16, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="patternBars" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chartTheme.importance}/><stop offset="100%" stopColor={chartTheme.stability}/></linearGradient></defs><CartesianGrid strokeDasharray="3 4" vertical={false} stroke={chartTheme.grid}/><XAxis dataKey="period" tick={chartTick} axisLine={false} tickLine={false}/><YAxis tick={chartTick} axisLine={false} tickLine={false}/><Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "hsl(var(--surface-soft))" }} formatter={(value, name) => [name === "financial_significance" ? money(String(value)) : number(Number(value)), name === "financial_significance" ? "Финансовая значимость" : "Сигналы"]} labelFormatter={(label) => `Период: ${label}`}/><Bar dataKey="signal_count" name="Сигналы" fill="url(#patternBars)" radius={[6, 6, 0, 0]}/></BarChart></ResponsiveContainer></div>;
}
