import { CheckCircle2, CircleDashed, Clock3, SearchCheck } from "lucide-react";
import type { ReviewStatus } from "@/lib/types";
import { Badge } from "./ui";

export function StatusBadge({ status }: { status: ReviewStatus }) {
  const completed = status === "Проверка завершена" || status === "Подтверждён сигнал" || status === "Сигнал не подтверждён";
  const active = status === "На рассмотрении" || status === "Направлено на углублённую проверку";
  const Icon = completed ? CheckCircle2 : active ? SearchCheck : status === "Не проверено" ? CircleDashed : Clock3;
  const style = completed ? "border-success/20 bg-success-soft text-success" : active ? "border-info/20 bg-info-soft text-blue-800" : "border-border-strong/70 bg-surface-soft text-muted-foreground";
  return <Badge className={`max-w-56 ${style}`}><Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true"/><span className="truncate">{status}</span></Badge>;
}
