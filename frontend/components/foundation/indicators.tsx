import { Activity, CircleDollarSign, Diamond, Flag, ShieldAlert } from "lucide-react";
import { cn, money } from "@/lib/utils";

export type DomainIndicatorKind = "priority" | "risk" | "importance" | "stability" | "reviewStatus";

const levelClasses: Record<string, { text: string; soft: string; marker: string }> = {
  "низкий": { text: "text-v2-low-text", soft: "bg-v2-low-soft", marker: "bg-v2-low" },
  "низкая": { text: "text-v2-low-text", soft: "bg-v2-low-soft", marker: "bg-v2-low" },
  "средний": { text: "text-v2-medium-text", soft: "bg-v2-medium-soft", marker: "bg-v2-medium" },
  "средняя": { text: "text-v2-medium-text", soft: "bg-v2-medium-soft", marker: "bg-v2-medium" },
  "высокий": { text: "text-v2-high-text", soft: "bg-v2-high-soft", marker: "bg-v2-high" },
  "высокая": { text: "text-v2-high-text", soft: "bg-v2-high-soft", marker: "bg-v2-high" },
  "очень высокая": { text: "text-v2-cyan-text", soft: "bg-v2-cyan-soft", marker: "bg-v2-cyan" },
  "критический": { text: "text-v2-critical-text", soft: "bg-v2-critical-soft", marker: "bg-v2-critical" },
  "критическая": { text: "text-v2-critical-text", soft: "bg-v2-critical-soft", marker: "bg-v2-critical" },
};

function levelStyle(level: string) {
  return levelClasses[level.toLocaleLowerCase("ru-RU")] ?? { text: "text-v2-text-secondary", soft: "bg-v2-surface-soft", marker: "bg-v2-text-muted" };
}

export interface DomainIndicatorProps {
  kind: DomainIndicatorKind;
  level: string;
  value?: number | string;
  label?: string;
  compact?: boolean;
  className?: string;
}

export function DomainIndicator({ kind, level, value, label, compact = false, className }: DomainIndicatorProps) {
  const style = levelStyle(level);
  if (kind === "reviewStatus") {
    return (
      <span data-domain-indicator="reviewStatus" className={cn("inline-flex min-h-7 max-w-64 items-center gap-2 rounded-full border border-v2-border bg-v2-surface-soft px-2.5 text-xs font-semibold text-v2-text-secondary", className)}>
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-v2-text-muted" aria-hidden="true" />
        <span className="truncate">{label ?? level}</span>
      </span>
    );
  }

  if (kind === "importance") {
    return (
      <span data-domain-indicator="importance" className={cn("inline-flex min-h-8 items-center gap-2 rounded-v2-control bg-v2-primary-soft px-2.5 text-sm font-semibold text-v2-primary-active", className)}>
        <Diamond className="h-4 w-4" aria-hidden="true" />
        {value !== undefined && <strong className="v2-tabular text-lg leading-none">{value}</strong>}
        <span>{label ?? `Важность: ${level}`}</span>
      </span>
    );
  }

  if (kind === "stability") {
    const score = typeof value === "number" ? Math.max(0, Math.min(100, value)) : undefined;
    return (
      <span data-domain-indicator="stability" className={cn("inline-grid min-w-32 gap-1 text-xs font-semibold text-v2-text-secondary", className)}>
        <span className="inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5 text-v2-cyan-text" aria-hidden="true" />{label ?? `Устойчивость: ${level}`}{value !== undefined ? ` · ${value}` : ""}</span>
        {!compact && score !== undefined && <span className="h-1.5 overflow-hidden rounded-full bg-v2-surface-soft" aria-hidden="true"><span className="block h-full rounded-full bg-v2-cyan" style={{ width: `${score}%` }} /></span>}
      </span>
    );
  }

  if (kind === "risk") {
    return (
      <span data-domain-indicator="risk" className={cn("inline-flex min-h-7 items-center gap-1.5 text-xs font-semibold text-v2-text-secondary", className)}>
        <ShieldAlert className={cn("h-3.5 w-3.5", style.text)} aria-hidden="true" />
        {value !== undefined && <strong className="v2-tabular text-sm text-v2-text">{value}</strong>}
        {label ? <span>{label}</span> : <><span>Риск:</span><span>{level}</span></>}
      </span>
    );
  }

  return (
    <span data-domain-indicator="priority" className={cn("inline-flex min-h-8 items-center gap-2 rounded-v2-control px-2.5 text-xs font-bold", style.soft, style.text, className)}>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", style.marker)} aria-hidden="true" />
      <Flag className="h-3.5 w-3.5" aria-hidden="true" />
      {value !== undefined && <strong className="v2-tabular text-lg leading-none text-v2-text">{value}</strong>}
      <span>{label ?? (compact ? level : `Приоритет: ${level}`)}</span>
    </span>
  );
}

export function FinancialValue({ value, label, compact = false, leading = false, className }: { value: string | number; label?: string; compact?: boolean; leading?: boolean; className?: string }) {
  const displayValue = typeof value === "number" ? money(value, compact) : value;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2 text-v2-teal-text", className)}>
      <CircleDollarSign className={cn("shrink-0", leading ? "h-5 w-5" : "h-4 w-4")} aria-hidden="true" />
      <span className="min-w-0">
        {label && <span className="block text-xs font-semibold leading-5 text-v2-text-secondary">{label}</span>}
        <span className={cn("v2-tabular block font-bold", leading ? "text-2xl" : compact ? "text-sm" : "text-base")}>{displayValue}</span>
      </span>
    </span>
  );
}
