import { Card } from "./ui";

export function QualityMetric({ label, value }: { label: string; value: number }) {
  const display = new Intl.NumberFormat("ru-RU", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <div className="mt-4 flex items-baseline justify-between gap-3">
        <p className="font-mono text-3xl font-bold tracking-tight tabular-nums">{display}</p>
        <span className="text-xs font-semibold text-success">Эталонная выборка</span>
      </div>
      <div className="mt-4 h-1.5 rounded-full bg-muted">
        <div
          className="h-1.5 rounded-full bg-primary"
          style={{ width: `${Math.min(100, value * 100)}%` }}
        />
      </div>
    </Card>
  );
}
