import { useId } from "react";
import type { PriorityHistoryPoint } from "@/lib/types";

export function PrioritySparkline({ history }: { history: PriorityHistoryPoint[] }) {
  const titleId = useId();
  const descriptionId = useId();
  if (history.length < 3) return <p className="text-sm leading-6 text-v2-text-secondary">Динамика появится после нескольких запусков анализа.</p>;

  const values = history.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const x = (index: number) => 18 + (index / (history.length - 1)) * 484;
  const y = (value: number) => 118 - ((value - min) / range) * 88;
  const points = history.map((item, index) => `${x(index)},${y(item.value)}`).join(" ");
  const direction = values.at(-1)! > values.at(-2)! ? "вырос" : values.at(-1)! < values.at(-2)! ? "снизился" : "не изменился";
  const description = history.map((item) => `${item.period}: ${item.value}`).join("; ");

  return <figure className="min-w-0" aria-labelledby={titleId} aria-describedby={descriptionId}>
    <figcaption id={titleId} className="sr-only">Динамика приоритета организации</figcaption>
    <p id={descriptionId} className="sr-only">{description}. Последнее изменение: показатель {direction}.</p>
    <svg viewBox="0 0 520 154" className="h-auto w-full" role="img" aria-hidden="true">
      {[30, 74, 118].map((line) => <line key={line} x1="18" y1={line} x2="502" y2={line} stroke="var(--v2-border)" strokeWidth="1" />)}
      <polyline points={points} fill="none" stroke="var(--v2-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {history.map((item, index) => <circle key={`${item.analysis_run_id}-${item.period}`} cx={x(index)} cy={y(item.value)} r={index === history.length - 1 ? 5 : 3.5} fill="var(--v2-surface)" stroke="var(--v2-primary)" strokeWidth={index === history.length - 1 ? 3 : 2} />)}
      {history.map((item, index) => <text key={`label-${item.analysis_run_id}-${item.period}`} x={x(index)} y="146" textAnchor={index === 0 ? "start" : index === history.length - 1 ? "end" : "middle"} fill="var(--v2-text-muted)" fontSize="11">{item.period}</text>)}
    </svg>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm"><span className="text-v2-text-secondary">Последнее значение · показатель {direction}</span><strong className="v2-tabular text-lg text-v2-text">{values.at(-1)} из 100</strong></div>
  </figure>;
}
