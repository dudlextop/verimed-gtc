"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Activity, ArrowRight, Building2, CalendarDays, CheckCircle2, ChevronDown, Clock3, Crosshair, Lightbulb, Maximize2, Minus, MoveDownRight, MoveUpRight, ScanSearch } from "lucide-react";
import type { Metric } from "@/lib/types";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { money, number, dateText } from "@/lib/utils";
import { Card, Badge, Skeleton } from "@/components/ui";
import { ErrorState, PageLoading } from "@/components/data-state";
import { PageHeader } from "@/components/page-header";
import { QualityMetric } from "@/components/quality-metric";
import { CommandCenter } from "@/components/command-center";
import { AnalysisChangesPanel } from "@/components/analysis-changes";
import { PatternAttention } from "@/components/pattern-attention";
import { ExpertWork } from "@/components/expert-work";
import { PriorityBadge } from "@/components/priority-badge";

const RiskDonut = dynamic(() => import("@/components/charts").then(module => module.RiskDonut), {loading: () => <Skeleton className="h-64"/>});
const TimelineChart = dynamic(() => import("@/components/charts").then(module => module.TimelineChart), {loading: () => <Skeleton className="h-64"/>});

export default function AnalyticsPage() {
  const home = useApi(api.home, []);
  if (home.loading) return <div className="page-shell"><PageLoading/></div>;
  if (home.error || !home.data) return <div className="page-shell"><ErrorState message={home.error ?? "Ответ сервиса неполон"} retry={() => void home.retry()}/></div>;
  const data = home.data;
  const s = data.summary;
  return <div className="page-shell"><PageHeader eyebrow="Обзор системы" title="Контроль медицинских услуг" description="Verimed анализирует сведения об оказанных медицинских услугах, выявляет нетипичные отклонения и формирует приоритеты для экспертной проверки." action={<div className="flex flex-wrap items-center gap-2"><Badge className="bg-emerald-100 text-emerald-800"><CheckCircle2 className="h-4 w-4" aria-hidden="true"/>{s.analysis.processing_status}</Badge><Link href="/overview" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border-strong bg-card px-3 text-sm font-semibold text-foreground transition-colors duration-100 hover:border-primary/30 hover:bg-surface-tint focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 motion-reduce:transition-none"><Maximize2 className="h-4 w-4 text-primary" aria-hidden="true"/>Открыть аналитический обзор</Link></div>}/>
    <CommandCenter data={data.command_center}/>
    <section className="mt-5"><AnalysisChangesPanel data={data.changes}/></section>
    <section className="mt-5"><Card className="p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Приоритетные медицинские организации</h2><p className="mt-1 text-sm text-muted-foreground">Организации с наибольшим текущим приоритетом проверки.</p></div><Link href="/organizations" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary focus-visible:ring-2 focus-visible:ring-ring">Все организации<ArrowRight className="h-4 w-4" aria-hidden="true"/></Link></div><div className="mt-5 grid gap-3 xl:grid-cols-3">{data.priority_organizations.items.slice(0, 3).map((organization) => <Link key={organization.id} href={`/organizations/${organization.id}`} className="rounded-lg bg-gradient-to-br from-slate-50 to-violet-50 p-4 focus-visible:ring-2 focus-visible:ring-ring"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{organization.name}</p><p className="mt-1 text-xs text-muted-foreground">{organization.region} · {organization.signals_count} сигналов</p></div>{organization.priority_level && <PriorityBadge level={organization.priority_level}/>}</div><div className="mt-4 flex items-baseline justify-between gap-4"><p className="font-mono text-2xl font-bold tabular-nums">{organization.priority_score ?? "—"}<span className="ml-1 text-xs font-normal text-muted-foreground">из 100</span></p><p className="font-mono text-sm font-semibold tabular-nums">{money(organization.financial_significance)}</p></div></Link>)}</div></Card></section>
    <section className="mt-5"><PatternAttention data={data.pattern_summary}/></section>
    <details className="group mt-5 rounded-lg bg-card shadow-card"><summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 font-bold focus-visible:ring-2 focus-visible:ring-ring"><span><span className="block">Подробная аналитика</span><span className="mt-1 block text-sm font-normal text-muted-foreground">Показатели качества, динамика и экспертная нагрузка</span></span><ChevronDown className="h-5 w-5 text-primary transition-transform group-open:rotate-180" aria-hidden="true"/></summary><div className="border-t p-5 md:p-6">
      <ExpertWork data={data.expert_review}/>
      <section className="mt-5"><Card className="p-6"><div className="flex items-center gap-2 text-sm font-semibold text-primary"><Activity className="h-4 w-4" aria-hidden="true"/>Текущий анализ</div><div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4"><Info icon={CalendarDays} label="Период" value={s.analysis.period}/><Info icon={Building2} label="Организации" value={number(s.analysis.organizations_count)}/><Info icon={ScanSearch} label="Обработано услуг" value={number(s.analysis.records_count)}/><Info icon={Clock3} label="Последний анализ" value={dateText(s.analysis.last_analysis_at)}/></div></Card></section>
      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{s.metrics.map(metric => <SummaryMetricCard key={metric.label} metric={metric}/>)}</section>
      <section className="mt-5"><div className="mb-3 flex items-center gap-2"><Crosshair className="h-5 w-5 text-primary" aria-hidden="true"/><h2 className="text-lg font-bold">Качество анализа</h2></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><QualityMetric label="Точность выявления (Precision)" value={data.quality.precision}/><QualityMetric label="Полнота выявления (Recall)" value={data.quality.recall}/><QualityMetric label="F1-мера" value={data.quality.f1}/><QualityMetric label="Доля услуг, направленных на проверку" value={data.quality.selected_for_review_rate}/></div></section>
      <section className="mt-5 grid gap-4 xl:grid-cols-[.8fr_1.2fr]"><Card className="p-6"><BlockTitle title="Распределение по уровням риска" subtitle="Количество сформированных сигналов"/><RiskDonut data={data.risk_distribution}/><div className="grid grid-cols-2 gap-2">{data.risk_distribution.map(item => <div key={item.name} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-xs"><span>{item.name}</span><strong>{number(item.value)}</strong></div>)}</div></Card><Card className="p-6"><BlockTitle title="Динамика объёма медицинских услуг" subtitle="Услуги и сигналы по месяцам"/><TimelineChart data={data.timeline}/></Card></section>
      <section className="mt-5"><Card className="p-6"><BlockTitle title="Ключевые выводы" subtitle="Наблюдения рассчитаны по данным текущего периода"/><div className="mt-5 grid gap-3 md:grid-cols-2">{data.findings.map(item => <div key={item.title} className="rounded-lg bg-gradient-to-br from-slate-50 to-violet-50 p-4"><div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white text-primary shadow-sm"><Lightbulb className="h-4 w-4" aria-hidden="true"/></span><div><p className="font-semibold">{item.title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p></div></div></div>)}</div></Card></section>
    </div></details>
  </div>;
}
function Info({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) { return <div><Icon className="mb-2 h-4 w-4 text-primary" aria-hidden="true"/><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-bold leading-5">{value}</p></div> }
function BlockTitle({ title, subtitle }: { title: string; subtitle: string }) { return <div><h2 className="text-lg font-bold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div> }
function SummaryMetricCard({ metric }: { metric: Metric }) {
  const changeText = metric.trend === "unavailable" ? "Сравнение появится после следующего запуска" : metric.trend === "neutral" ? "Без изменений к предыдущему запуску" : `${metric.change_percent > 0 ? "+" : ""}${metric.change_percent}% к предыдущему запуску`;
  const changeClass = metric.trend === "up" ? "text-primary" : metric.trend === "down" ? "text-success" : "text-muted-foreground";
  return <Card className="p-5"><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold leading-5 text-muted-foreground">{metric.label}</p><span className={changeClass}>{metric.trend === "up" ? <MoveUpRight className="h-4 w-4"/> : metric.trend === "down" ? <MoveDownRight className="h-4 w-4"/> : <Minus className="h-4 w-4"/>}</span></div><p className="mt-4 text-2xl font-bold tracking-tight">{metric.label.includes("сумм") || metric.label.includes("Сумма") ? money(metric.value) : number(Number(metric.value))}</p><p className={`mt-2 text-xs font-semibold ${changeClass}`}>{changeText}</p><p className="mt-3 text-xs leading-5 text-muted-foreground">{metric.explanation}</p></Card>;
}
