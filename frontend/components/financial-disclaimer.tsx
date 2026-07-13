import { Info } from "lucide-react";

export function FinancialDisclaimer() {
  return <div className="flex gap-3 rounded-md border border-finance/15 bg-finance-soft p-3 text-sm leading-6 text-foreground"><Info className="mt-0.5 h-4 w-4 shrink-0 text-finance" aria-hidden="true"/><p>Финансовая значимость не означает подтверждённое нарушение.</p></div>;
}
