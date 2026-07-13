import Link from "next/link";
import { ArrowRight, Building2, CircleDollarSign, Network, Sparkles, Waves } from "lucide-react";
import type { PatternSummary } from "@/lib/types";
import { money, number } from "@/lib/utils";
import { ImportanceBadge, StabilityBadge } from "./pattern-badges";
import { Card, FinancialValue, SectionHeader } from "./ui";

export function PatternAttention({ data }: { data: PatternSummary }) {
  return <Card className="overflow-hidden p-5 md:p-6">
    <SectionHeader title="Повторяющиеся модели, требующие внимания" description="Устойчивые сочетания сигналов, общих участников и медицинских услуг." action={<Link href="/patterns" className="inline-flex min-h-10 shrink-0 items-center gap-2 text-sm font-semibold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring">Все модели<ArrowRight className="h-4 w-4" aria-hidden="true"/></Link>}/>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Mini icon={Sparkles} label="Новые модели" value={number(data.new_patterns)} tone="importance"/><Mini icon={Waves} label="Высокая устойчивость" value={number(data.high_stability_patterns)} tone="stability"/><Mini icon={Building2} label="Связано организаций" value={number(data.affected_organizations)}/><Mini icon={CircleDollarSign} label="Финансовая значимость" value={money(data.financial_significance, true)} tone="finance"/></div>
    {data.attention_patterns.length ? <div className="mt-5 grid gap-3 xl:grid-cols-3">{data.attention_patterns.slice(0,5).map(pattern => <Link key={pattern.id} href={`/patterns/${pattern.id}`} className="interactive-card group p-4 focus-visible:ring-2 focus-visible:ring-ring"><div className="flex flex-wrap gap-2"><ImportanceBadge level={pattern.importance_level}/><StabilityBadge level={pattern.stability_level} score={pattern.stability_score}/></div><h3 className="mt-3 font-semibold leading-6 group-hover:text-importance">{pattern.name}</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">{pattern.main_organization ?? "Несколько организаций"} · {pattern.signal_count} сигналов</p><div className="mt-4 flex items-end justify-between gap-3"><FinancialValue label="Финансовая значимость" value={money(pattern.financial_significance)} compact/><ArrowRight className="h-4 w-4 text-importance" aria-hidden="true"/></div></Link>)}</div> : <div className="mt-5 rounded-lg border border-dashed border-border-strong bg-surface-soft p-5"><p className="font-semibold">Повторяющиеся модели пока не сформированы</p><p className="mt-2 text-sm text-muted-foreground">Для анализа требуется несколько периодов наблюдений.</p></div>}
    <p className="mt-5 max-w-4xl text-xs leading-5 text-muted-foreground">{data.disclaimer}</p>
  </Card>;
}

function Mini({ icon: Icon, label, value, tone = "neutral" }: { icon: typeof Network; label: string; value: string; tone?: "neutral" | "importance" | "stability" | "finance" }) {
  const style = tone === "importance" ? "bg-importance-soft text-importance" : tone === "stability" ? "bg-stability-soft text-stability" : tone === "finance" ? "bg-finance-soft text-finance" : "bg-surface-soft text-primary";
  return <div className="rounded-lg border border-border/65 bg-surface-raised p-4"><span className={`grid h-8 w-8 place-items-center rounded-md ${style}`}><Icon className="h-4 w-4" aria-hidden="true"/></span><p className="mt-3 font-mono text-xl font-bold tracking-tight tabular-nums">{value}</p><p className="mt-1 text-xs font-semibold text-muted-foreground">{label}</p></div>;
}
