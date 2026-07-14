import type { RiskLevel } from "@/lib/types";
import { DomainIndicator } from "./ui";

export function PriorityBadge({level, compact = false}: {level: RiskLevel; compact?: boolean}) {
  return <DomainIndicator kind="priority" level={level} compact={compact} label={compact ? level : `Приоритет: ${level}`} />;
}
