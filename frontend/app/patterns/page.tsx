"use client";

import { CircleDollarSign, Network, Sparkles, Waves } from "lucide-react";
import { api } from "@/lib/api";
import { money, number } from "@/lib/utils";
import { useApi } from "@/hooks/use-api";
import { ErrorState, PageLoading } from "@/components/data-state";
import { PageHeader } from "@/components/page-header";
import { PatternsView } from "@/components/patterns-view";
import { Card } from "@/components/ui";

export default function PatternsPage() {
  const summary = useApi(api.patternSummary);
  const changes = useApi(api.patternChanges);
  if (summary.loading || changes.loading) return <div className="page-shell"><PageLoading /></div>;
  const error = summary.error || changes.error;
  if (error || !summary.data || !changes.data) return <div className="page-shell"><ErrorState message={error ?? "Ответ сервиса неполон"} retry={() => { void summary.retry(); void changes.retry(); }} /></div>;
  const data = summary.data;
  return <div className="page-shell">
    <PageHeader eyebrow="Устойчивые связи" title="Повторяющиеся модели" description="Связанные группы сигналов, которые повторяются во времени у организаций, врачей, услуг или обезличенных пациентов." />
    <section className="grid gap-4 sm:grid-cols-3">
      <Metric icon={Network} label="Всего моделей" value={number(data.total_patterns)} />
      <Metric icon={Waves} label="Высокая устойчивость" value={number(data.high_stability_patterns)} />
      <Metric icon={CircleDollarSign} label="Финансовая значимость" value={money(data.financial_significance, true)} />
    </section>
    <Card className="mt-4 flex flex-col gap-3 bg-gradient-to-r from-violet-50 to-cyan-50 p-5 md:flex-row md:items-center md:justify-between">
      <div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white text-primary shadow-sm"><Sparkles className="h-5 w-5" aria-hidden="true" /></span><div><p className="font-semibold">{changes.data.comparison_available ? `Новых моделей после последнего анализа: ${number(data.new_patterns)}` : "Сравнение появится после следующего запуска анализа"}</p><p className="mt-1 text-sm text-muted-foreground">{data.disclaimer}</p></div></div>
    </Card>
    <section className="mt-5"><PatternsView /></section>
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Network; label: string; value: string }) {
  return <Card className="p-5"><Icon className="h-5 w-5 text-primary" aria-hidden="true" /><p className="mt-4 font-mono text-2xl font-bold tabular-nums">{value}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{label}</p></Card>;
}
