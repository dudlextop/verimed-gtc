import { AlertTriangle, CircleCheck, ShieldAlert, ShieldCheck } from "lucide-react";
import type { RiskLevel } from "@/lib/types";
import { Badge } from "./ui";

export function RiskBadge({ level }: { level: RiskLevel }) {
  const Icon = level === "Критический" ? ShieldAlert : level === "Высокий" ? AlertTriangle : level === "Средний" ? ShieldCheck : CircleCheck;
  const color = level === "Критический" ? "border-red-200 bg-risk-soft text-red-800" : level === "Высокий" ? "border-orange-200 bg-orange-50 text-orange-800" : level === "Средний" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return <Badge className={color}><Icon className="h-3.5 w-3.5" aria-hidden="true"/><span className="font-medium">Риск:</span><span>{level}</span></Badge>;
}
