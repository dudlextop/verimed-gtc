import type { RiskLevel } from "@/lib/types";
import { DomainIndicator } from "./ui";

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <DomainIndicator kind="risk" level={level} />;
}
