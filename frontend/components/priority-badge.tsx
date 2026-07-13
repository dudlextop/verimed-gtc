import { Flag } from "lucide-react";
import type { RiskLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

const styles: Record<RiskLevel, string> = {
  "Низкий": "border-emerald-200 bg-emerald-50 text-emerald-800",
  "Средний": "border-amber-200 bg-amber-50 text-amber-900",
  "Высокий": "border-violet-200 bg-priority-soft text-priority",
  "Критический": "border-indigo-700 bg-indigo-700 text-white shadow-[0_6px_18px_-10px_rgb(67_56_202_/.8)]",
};

export function PriorityBadge({level, compact = false}: {level: RiskLevel; compact?: boolean}) {
  return <span className={cn("inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-bold", styles[level])}><Flag className="h-3.5 w-3.5" aria-hidden="true"/>{compact ? level : `Приоритет: ${level}`}</span>;
}
