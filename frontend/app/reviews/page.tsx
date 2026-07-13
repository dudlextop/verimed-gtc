"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardCheck, MessageSquareText, Network } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { number, percent } from "@/lib/utils";
import { Card } from "@/components/ui";
import { ErrorState, PageLoading } from "@/components/data-state";
import { PageHeader } from "@/components/page-header";

export default function ReviewsPage() {
  const summary = useApi(api.expertReviewSummary);
  const signals = useApi(api.expertReviewBySignalType);
  const patterns = useApi(api.expertReviewByPatternType);
  if (summary.loading || signals.loading || patterns.loading) return <div className="page-shell"><PageLoading/></div>;
  const error = summary.error || signals.error || patterns.error;
  if (error || !summary.data || !signals.data || !patterns.data) return <div className="page-shell"><ErrorState message={error ?? "Аналитика решений недоступна"} retry={() => { void summary.retry(); void signals.retry(); void patterns.retry(); }}/></div>;
  const data = summary.data;
  return <div className="page-shell"><PageHeader eyebrow="Экспертная обратная связь" title="Результаты экспертной оценки" description="Агрегированные решения и оценки полезности без изменения аналитических выводов и автоматического переобучения." action={<Link href="/decision-journal" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white focus-visible:ring-2 focus-visible:ring-ring">Открыть журнал<ArrowRight className="h-4 w-4"/></Link>}/><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={ClipboardCheck} label="Рассмотрено сигналов" value={number(data.reviewed_signals)}/><Metric icon={Network} label="Рассмотрено моделей" value={number(data.reviewed_patterns)}/><Metric icon={CheckCircle2} label="Доля подтверждённых сигналов" value={data.confirmed_share === null ? "Недостаточно данных" : percent(data.confirmed_share)}/><Metric icon={MessageSquareText} label="Сигналов без решения" value={number(data.signals_without_decision)}/></section>{!data.sample_sufficient && <p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-950">{data.sample_message}</p>}<section className="mt-5 grid gap-5 xl:grid-cols-2"><Breakdown title="Решения по типам сигналов" items={signals.data} kind="signal"/><Breakdown title="Решения по типам моделей" items={patterns.data} kind="pattern"/></section><section className="mt-5 grid gap-4 md:grid-cols-3"><Distribution title="Полезность сигналов" values={data.usefulness_distribution}/><Distribution title="Качество объяснений" values={data.explanation_quality_distribution}/><Distribution title="Корректность приоритета" values={data.priority_correctness_distribution}/></section></div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof ClipboardCheck; label: string; value: string }) { return <Card className="p-5"><Icon className="h-5 w-5 text-primary"/><p className="mt-4 text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></Card>; }
function Breakdown({ title, items, kind }: { title: string; items: { category: string; total: number; confirmed: number; rejected: number; escalated: number }[]; kind: "signal" | "pattern" }) { const confirmedLabel = kind === "signal" ? "Подтверждён сигнал" : "Значимость подтверждена"; const rejectedLabel = kind === "signal" ? "Сигнал не подтверждён" : "Отмечено как несущественное"; return <Card className="p-6"><h2 className="text-lg font-bold">{title}</h2>{items.length ? <div className="mt-4 space-y-3">{items.map((item) => <div key={item.category} className="rounded-md bg-muted p-4"><div className="flex justify-between gap-3"><p className="font-semibold">{item.category}</p><strong>{item.total}</strong></div><p className="mt-2 text-xs text-muted-foreground">{confirmedLabel}: {item.confirmed} · {rejectedLabel}: {item.rejected} · направлено на углублённую проверку: {item.escalated}</p></div>)}</div> : <p className="mt-4 text-sm text-muted-foreground">Недостаточно экспертных решений для устойчивого вывода.</p>}</Card>; }
function Distribution({ title, values }: { title: string; values: Record<string, number> }) { const entries = Object.entries(values); return <Card className="p-5"><h2 className="font-bold">{title}</h2>{entries.length ? <ul className="mt-4 space-y-2">{entries.map(([label, value]) => <li key={label} className="flex justify-between gap-3 text-sm"><span>{label}</span><strong>{value}</strong></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">Оценки пока не собраны.</p>}</Card>; }
