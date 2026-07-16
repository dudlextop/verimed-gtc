"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  MessageSquareText,
  ThumbsDown,
} from "lucide-react";
import { api } from "@/lib/api";
import type { ExpertReviewBreakdown } from "@/lib/types";
import { useApi } from "@/hooks/use-api";
import { number, percent } from "@/lib/utils";
import {
  Button,
  DataPanel,
  EmptyState,
  MetricCard,
  MetricStrip,
  PageHeader,
  PageSkeleton,
  SectionHeader,
  Skeleton,
} from "@/components/foundation";

const ExpertDecisionDistribution = dynamic(
  () => import("@/components/expert-review-charts").then((module) => module.ExpertDecisionDistribution),
  { ssr: false, loading: () => <Skeleton className="h-64" /> },
);
const ExpertUsefulnessDistribution = dynamic(
  () => import("@/components/expert-review-charts").then((module) => module.ExpertUsefulnessDistribution),
  { ssr: false, loading: () => <Skeleton className="h-64" /> },
);

export default function ReviewsPage() {
  const summary = useApi(api.expertReviewSummary);
  const signals = useApi(api.expertReviewBySignalType);
  const patterns = useApi(api.expertReviewByPatternType);
  const header = (
    <PageHeader
      eyebrow="Экспертная обратная связь"
      title="Результаты экспертной оценки"
      description="Агрегированные решения и оценки полезности без изменения аналитических выводов и автоматического переобучения."
      primaryAction={<Button asChild><Link href="/decision-journal">Открыть журнал решений<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button>}
    />
  );

  if (summary.loading || signals.loading || patterns.loading) {
    return <div className="page-shell">{header}<PageSkeleton variant="dashboard" /></div>;
  }
  const error = summary.error || signals.error || patterns.error;
  if (error || !summary.data || !signals.data || !patterns.data) {
    return (
      <div className="page-shell">
        {header}
        <EmptyState
          variant="error"
          title="Не удалось загрузить результаты экспертной оценки"
          description="Проверьте соединение и повторите попытку."
          action={<Button variant="secondary" onClick={() => { void summary.retry(); void signals.retry(); void patterns.retry(); }}>Повторить</Button>}
        />
      </div>
    );
  }

  const data = summary.data;
  const decisions = data.reviewed_signals + data.reviewed_patterns;

  return (
    <div className="page-shell" data-testid="expert-reviews">
      {header}
      <MetricStrip className="mb-5" label="Показатели экспертных решений">
        <MetricCard label="Зафиксировано решений" value={number(decisions)} detail={`${number(data.reviewed_signals)} по сигналам · ${number(data.reviewed_patterns)} по моделям`} icon={ClipboardCheck} prominent />
        <MetricCard label="Доля подтверждений" value={percent(data.confirmed_share)} detail="Среди завершённых проверок" icon={CheckCircle2} tone="stability" />
        <MetricCard label="Доля неподтверждённых" value={percent(data.rejected_share)} detail="Сигнал не подтверждён специалистом" icon={ThumbsDown} tone="neutral" />
        <MetricCard label="Сигналов без решения" value={number(data.signals_without_decision)} detail={`${number(data.in_progress)} находятся на рассмотрении`} icon={MessageSquareText} tone="priority" />
      </MetricStrip>

      {!data.sample_sufficient ? (
        <EmptyState
          variant="insufficient"
          title="Недостаточно завершённых проверок"
          description={data.sample_message ?? "Для устойчивого расчёта долей требуется больше экспертных решений."}
        />
      ) : (
        <>
          <section className="grid gap-5 xl:grid-cols-2" aria-labelledby="review-visuals-title">
            <h2 id="review-visuals-title" className="sr-only">Распределение экспертных решений и оценок</h2>
            <DataPanel title="Распределение экспертных решений" description="Как специалисты завершали проверку сигналов и повторяющихся моделей.">
              <ExpertDecisionDistribution data={data} />
            </DataPanel>
            <DataPanel title="Полезность сигналов" description="Как специалисты оценивали пользу аналитических сигналов в работе.">
              <ExpertUsefulnessDistribution values={data.usefulness_distribution} />
            </DataPanel>
          </section>

          <section className="mt-5" aria-labelledby="review-breakdown-title">
            <SectionHeader
              id="review-breakdown-title"
              title="Решения по типам объектов"
              description="Разбивка помогает понять, где экспертных решений уже достаточно для содержательного сравнения."
            />
            <div className="mt-4 grid gap-5 xl:grid-cols-2">
              <ReviewBreakdown title="По типам сигналов" items={signals.data} kind="signal" />
              <ReviewBreakdown title="По типам моделей" items={patterns.data} kind="pattern" />
            </div>
          </section>

          <QualitySummary
            explanation={data.explanation_quality_distribution}
            priority={data.priority_correctness_distribution}
          />
        </>
      )}
    </div>
  );
}

function ReviewBreakdown({ title, items, kind }: { title: string; items: ExpertReviewBreakdown[]; kind: "signal" | "pattern" }) {
  const confirmedLabel = kind === "signal" ? "Подтверждён сигнал" : "Значимость подтверждена";
  const rejectedLabel = kind === "signal" ? "Сигнал не подтверждён" : "Отмечено как несущественное";
  return (
    <DataPanel title={title}>
      {items.length ? (
        <ul className="divide-y divide-v2-border">
          {items.slice(0, 6).map((item) => (
            <li key={item.category} className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <p className="font-semibold text-v2-text">{item.category}</p>
                <p className="mt-1 text-xs leading-5 text-v2-text-secondary">
                  {confirmedLabel}: {number(item.confirmed)} · {rejectedLabel}: {number(item.rejected)} · углублённая проверка: {number(item.escalated)}
                </p>
              </div>
              <strong className="v2-tabular text-lg text-v2-text">{number(item.total)}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState variant="insufficient" title="Решений по типам пока недостаточно" description="Разбивка появится после накопления экспертных решений." className="min-h-40" />
      )}
    </DataPanel>
  );
}

function QualitySummary({ explanation, priority }: { explanation: Record<string, number>; priority: Record<string, number> }) {
  const groups = [
    { title: "Качество объяснений", values: explanation },
    { title: "Корректность приоритета", values: priority },
  ];
  return (
    <DataPanel
      className="mt-5"
      title="Качество аналитического контекста"
      description="Оценки специалистов используются как обратная связь и не изменяют автоматически аналитические выводы."
    >
      <div className="grid gap-5 md:grid-cols-2">
        {groups.map((group) => (
          <div key={group.title}>
            <h3 className="text-sm font-bold text-v2-text">{group.title}</h3>
            {Object.keys(group.values).length ? (
              <ul className="mt-3 space-y-2">
                {Object.entries(group.values).map(([label, value]) => (
                  <li key={label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-v2-text-secondary">{label}</span>
                    <strong className="v2-tabular text-v2-text">{number(value)}</strong>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-sm text-v2-text-secondary">Оценки пока не собраны.</p>}
          </div>
        ))}
      </div>
    </DataPanel>
  );
}
