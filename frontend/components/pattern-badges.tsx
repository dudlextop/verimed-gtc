import { Layers3 } from "lucide-react";
import type { RecurringPattern, RiskLevel } from "@/lib/types";
import { DomainIndicator } from "./foundation";

export function ImportanceBadge({ level }: { level: RiskLevel }) {
  return <DomainIndicator kind="importance" level={level} label={`Важность: ${level}`} />;
}

export function StabilityBadge({ level, score }: { level: RecurringPattern["stability_level"]; score?: number }) {
  return <DomainIndicator kind="stability" level={level} value={score} compact />;
}

export function PatternTypeBadge({ label }: { label: string }) {
  return <span className="inline-flex min-h-7 items-center gap-1.5 rounded-v2-control bg-v2-primary-soft px-2.5 text-xs font-semibold text-v2-primary"><Layers3 className="h-3.5 w-3.5" aria-hidden="true"/>{label}</span>;
}
