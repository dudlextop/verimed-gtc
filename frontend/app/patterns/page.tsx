"use client";

import Link from "next/link";
import { ArrowRight, CircleDollarSign, Network, Waves } from "lucide-react";
import { api } from "@/lib/api";
import { money, number } from "@/lib/utils";
import { useApi } from "@/hooks/use-api";
import { PatternsView } from "@/components/patterns-view";
import {
  Button,
  EmptyState,
  InlineNotice,
  MetricCard,
  MetricStrip,
  PageHeader,
  PageSkeleton,
} from "@/components/foundation";

export default function PatternsPage() {
  const summary = useApi(api.patternSummary);
  const changes = useApi(api.patternChanges);
  if (summary.loading || changes.loading) return <div className="page-shell"><PageSkeleton variant="list" /></div>;
  const error = summary.error || changes.error;
  if (error || !summary.data || !changes.data) return <div className="page-shell"><EmptyState variant="error" title="Не удалось загрузить повторяющиеся модели" description="Проверьте соединение и повторите попытку." action={<Button variant="secondary" onClick={() => { void summary.retry(); void changes.retry(); }}>Повторить</Button>} /></div>;
  const data = summary.data;
  return <div className="page-shell">
    <PageHeader eyebrow="Устойчивые связи" title="Повторяющиеся модели" description="Связанные группы сигналов, которые повторяются во времени у организаций, врачей, услуг или обезличенных пациентов." />
    <MetricStrip className="mb-4 sm:grid-cols-3 xl:grid-cols-3" label="Показатели повторяющихся моделей">
      <MetricCard label="Всего моделей" value={number(data.total_patterns)} icon={Network} prominent />
      <MetricCard label="Высокая устойчивость" value={number(data.high_stability_patterns)} detail="Высокая или очень высокая повторяемость" icon={Waves} tone="stability" />
      <MetricCard label="Финансовая значимость" value={money(data.financial_significance, true)} detail="По уникальным связанным записям" icon={CircleDollarSign} tone="finance" />
    </MetricStrip>
    <InlineNotice
      className="mb-4 max-sm:flex-wrap max-sm:[&>div:last-child]:ml-7 max-sm:[&>div:last-child]:w-full"
      title={changes.data.comparison_available ? `Новых моделей после последнего анализа: ${number(data.new_patterns)}` : "Сравнение станет доступно после следующего запуска анализа"}
      description="Повторяющаяся модель показывает устойчивое сочетание сигналов и связей в доступных данных. Вывод требует экспертной оценки."
      action={<Button asChild variant="text" size="compact"><Link href="/methodology">Методика анализа<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button>}
    />
    <PatternsView />
  </div>;
}
