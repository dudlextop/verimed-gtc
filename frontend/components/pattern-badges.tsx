import { Activity, Circle, Diamond, Layers3, Waves } from "lucide-react";
import type { RecurringPattern, RiskLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

const stabilityStyles: Record<RecurringPattern["stability_level"], string> = {
  "Низкая": "border-border-strong bg-surface-soft text-muted-foreground",
  "Средняя": "border-cyan-200 bg-cyan-50 text-cyan-900",
  "Высокая": "border-teal-200 bg-stability-soft text-stability",
  "Очень высокая": "border-sky-200 bg-sky-50 text-sky-900",
};

const importanceStyles: Record<RiskLevel, string> = {
  "Низкий": "border-blue-200 bg-blue-50 text-blue-800",
  "Средний": "border-indigo-200 bg-indigo-50 text-indigo-800",
  "Высокий": "border-blue-300 bg-importance-soft text-importance",
  "Критический": "border-blue-700 bg-blue-700 text-white",
};

export function ImportanceBadge({ level }: { level: RiskLevel }) {
  return <span className={cn("inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-bold", importanceStyles[level])}><Diamond className="h-3.5 w-3.5" aria-hidden="true"/>Важность: {level}</span>;
}

export function StabilityBadge({ level, score }: { level: RecurringPattern["stability_level"]; score?: number }) {
  const Icon = level === "Очень высокая" ? Waves : level === "Высокая" ? Activity : Circle;
  return <span className={cn("inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold", stabilityStyles[level])}><Icon className="h-3.5 w-3.5" aria-hidden="true"/>Устойчивость: {level}{score !== undefined ? ` · ${score}` : ""}</span>;
}

export function PatternTypeBadge({ label }: { label: string }) {
  return <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-importance/15 bg-importance-soft px-2.5 text-xs font-semibold text-importance"><Layers3 className="h-3.5 w-3.5" aria-hidden="true"/>{label}</span>;
}
