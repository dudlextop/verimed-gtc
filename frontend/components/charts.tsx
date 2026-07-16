"use client";

import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DistributionPoint, TimelinePoint } from "@/lib/types";
import { number } from "@/lib/utils";
import { chartTheme, chartTick, chartTooltipStyle } from "@/lib/chart-theme";

export function RiskDonut({ data }: { data: DistributionPoint[] }) {
  return <div className="h-72"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3} stroke="var(--v2-surface)" strokeWidth={3}>{data.map(item => <Cell key={item.name} fill={chartTheme.risk[item.name] ?? chartTheme.primary}/>)}</Pie><Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => number(value)}/></PieChart></ResponsiveContainer></div>;
}

export function TimelineChart({ data }: { data: TimelinePoint[] }) {
  return <div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ left: -22, right: 10, top: 12 }}><CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 4" vertical={false}/><XAxis dataKey="period" tick={chartTick} tickLine={false} axisLine={false}/><YAxis tick={chartTick} tickLine={false} axisLine={false}/><Tooltip contentStyle={chartTooltipStyle} cursor={{stroke: chartTheme.grid}} formatter={(value: number) => number(value)}/><Line type="monotone" dataKey="services" name="Услуги" stroke={chartTheme.primary} strokeWidth={2.5} dot={{ r: 3.5, fill: chartTheme.surface, strokeWidth: 2 }}/><Line type="monotone" dataKey="signals" name="Сигналы" stroke={chartTheme.accent} strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></div>;
}
