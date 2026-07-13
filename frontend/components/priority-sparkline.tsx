import type { PriorityHistoryPoint } from "@/lib/types";

export function PrioritySparkline({history}: {history: PriorityHistoryPoint[]}) {
  if (history.length < 3) return <p className="max-w-36 text-xs leading-5 text-muted-foreground">Динамика появится после нескольких запусков анализа.</p>;
  const values = history.map(item => item.value); const min = Math.min(...values); const max = Math.max(...values); const range = Math.max(1, max - min);
  const points = history.map((item, index) => `${(index / (history.length - 1)) * 112 + 4},${34 - ((item.value - min) / range) * 26}`).join(" ");
  const direction = values.at(-1)! > values.at(-2)! ? "вырос" : values.at(-1)! < values.at(-2)! ? "снизился" : "не изменился";
  const description = history.map(item => `${item.period}: ${item.value}`).join("; ");
  return <div className="w-32 rounded-md bg-priority-soft/70 px-2 py-1" tabIndex={0} aria-label={`Динамика приоритета: ${description}. Последнее изменение: показатель ${direction}.`} title={`${description}. Последнее изменение: показатель ${direction}.`}><svg viewBox="0 0 120 40" className="h-10 w-28" role="img" aria-hidden="true"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-priority"/></svg><p className="text-[0.6875rem] font-semibold text-muted-foreground">{direction}</p></div>;
}
