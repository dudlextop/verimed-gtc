import Link from "next/link";
import { ArrowRight, Building2, CircleDollarSign, Clock3, ScanSearch, ShieldAlert } from "lucide-react";
import type { CommandCenter as CommandCenterData, PatternSummary } from "@/lib/types";
import { dateTimeText, money, number } from "@/lib/utils";
import { Card } from "./ui";

export const PRIORITY_QUEUE_URL = "/signals?levels=Критический&levels=Высокий&status=Не%20проверено&sort=priority";

export function CommandCenter({ data }: { data: CommandCenterData; patterns?: PatternSummary }) {
  return <Card className="relative overflow-hidden border-0 p-0 text-white shadow-raised" style={{backgroundImage: "var(--gradient-command)"}}>
    <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-violet-400/20 blur-3xl" aria-hidden="true"/>
    <div className="pointer-events-none absolute bottom-0 left-1/3 h-36 w-72 rounded-full bg-cyan-300/10 blur-3xl" aria-hidden="true"/>
    <div className="relative grid gap-0 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,.65fr)]">
      <div className="p-6 md:p-8 xl:p-9">
        <div className="flex items-center gap-2 text-violet-200"><span className="grid h-9 w-9 place-items-center rounded-md bg-white/10"><ShieldAlert className="h-5 w-5" aria-hidden="true"/></span><h2 className="text-xl font-bold tracking-[-0.02em] text-white md:text-2xl">Требуют внимания</h2></div>
        <div className="mt-7 flex flex-col gap-6 lg:flex-row lg:items-end">
          <div className="min-w-0 lg:w-[42%]"><p className="font-mono text-5xl font-bold tracking-[-0.055em] tabular-nums md:text-6xl">{number(data.new_high_critical_signals)}</p><p className="mt-2 max-w-xs text-sm leading-6 text-slate-300">{data.comparison_available ? "новых сигналов высокого и критического риска" : "сигналов высокого и критического риска"}</p></div>
          <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-3">
            <CommandMetric icon={Building2} value={number(data.high_risk_organizations)} label="организаций с повышенным риском"/>
            <CommandMetric icon={CircleDollarSign} value={money(data.potential_review_amount, true)} label="потенциальный объём проверки" tone="finance"/>
            <CommandMetric icon={Clock3} value={number(data.signals_without_decision)} label="сигналов без решения"/>
          </div>
        </div>
        <p className="mt-6 flex items-center gap-2 text-xs text-slate-400"><ScanSearch className="h-3.5 w-3.5" aria-hidden="true"/>Последний анализ: {data.last_analysis_at ? dateTimeText(data.last_analysis_at) : "ещё не выполнялся"}</p>
      </div>
      <div className="border-t border-white/10 bg-white/[0.055] p-6 backdrop-blur-sm md:p-8 xl:border-l xl:border-t-0">
        <p className="text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-cyan-200">Первое действие</p>
        {data.priority_organization ? <Link href={`/organizations/${data.priority_organization.id}`} className="group mt-4 block rounded-lg border border-white/10 bg-white/[0.065] p-4 transition-colors duration-100 hover:bg-white/[0.1] focus-visible:ring-2 focus-visible:ring-white"><span className="block font-semibold leading-6 text-white group-hover:text-cyan-100">{data.priority_organization.name}</span><span className="mt-2 block font-mono text-sm font-bold tabular-nums text-violet-100">Приоритет {data.priority_organization.priority_score} из 100 · {money(data.priority_organization.review_amount)}</span><span className="mt-2 line-clamp-2 block text-xs leading-5 text-slate-300">{data.priority_organization.main_reason}</span></Link> : <p className="mt-4 text-sm leading-6 text-slate-200">Приоритетные сигналы появятся после завершения анализа.</p>}
        <Link href={PRIORITY_QUEUE_URL} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-bold text-navigation shadow-[0_12px_30px_-18px_rgb(255_255_255_/.7)] transition-[transform,background-color] duration-100 hover:bg-cyan-50 active:translate-y-px focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-navigation motion-reduce:transition-none">Перейти к проверке<ArrowRight className="h-4 w-4" aria-hidden="true"/></Link>
      </div>
    </div>
  </Card>;
}

function CommandMetric({ icon: Icon, value, label, tone = "neutral" }: { icon: typeof ScanSearch; value: string; label: string; tone?: "neutral" | "finance" }) {
  return <div className="min-w-0 rounded-lg border border-white/[0.08] bg-white/[0.065] p-3.5"><Icon className={tone === "finance" ? "h-4 w-4 text-cyan-200" : "h-4 w-4 text-violet-200"} aria-hidden="true"/><p className="mt-3 break-words font-mono text-xl font-bold tracking-[-0.03em] tabular-nums">{value}</p><p className="mt-1 text-[0.6875rem] leading-4 text-slate-300">{label}</p></div>;
}
