"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardCheck, Network, ScanSearch } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { number, percent } from "@/lib/utils";
import {
  Badge,
  DomainIndicator,
  EmptyState,
  FinancialValue,
  MetricCard,
  MetricStrip,
  PageHeader,
  PageSkeleton,
  SectionHeader,
} from "@/components/foundation";
import { ErrorState } from "@/components/data-state";
import { CommandCenter } from "@/components/command-center";
import { AnalysisChangesPanel } from "@/components/analysis-changes";

export default function AnalyticsPage() {
  const home = useApi(api.home, []);
  if (home.loading) return <div className="page-shell"><PageSkeleton variant="dashboard" /></div>;
  if (home.error || !home.data) {
    return <div className="page-shell"><ErrorState message={home.error ?? "Ответ сервиса неполон"} retry={() => void home.retry()} /></div>;
  }

  const data = home.data;
  const analysis = data.summary.analysis;
  const topSignal = data.command_center.top_financial_signal;
  const topOrganization = data.command_center.priority_organization ?? data.priority_organizations.items[0] ?? null;
  const topPattern = data.pattern_summary.top_importance_pattern ?? data.pattern_summary.attention_patterns[0] ?? null;

  return (
    <div className="page-shell" data-testid="analytics-home">
      <PageHeader
        eyebrow="Обзор системы"
        title="Контроль медицинских услуг"
        description="Рабочий старт: приоритеты текущего анализа, изменения и объекты для следующей экспертной проверки."
        meta={(
          <>
            <Badge className="border-v2-success/20 bg-v2-success-soft text-v2-success-text">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {analysis.processing_status}
            </Badge>
            <span className="v2-tabular">{analysis.period}</span>
          </>
        )}
      />

      <CommandCenter data={data.command_center} />

      <section className="mt-6" aria-labelledby="home-attention-title">
        <SectionHeader
          id="home-attention-title"
          title="Приоритетные рабочие объекты"
          description="Один сигнал, одна организация и одна повторяющаяся модель с наибольшей текущей значимостью."
        />
        <div className="mt-4 grid gap-4 xl:grid-cols-3" data-testid="home-priority-objects">
          {topSignal ? (
            <PriorityObjectLink
              href={`/signals/${topSignal.id}`}
              eyebrow="Сигнал"
              title={topSignal.service_name}
              context={topSignal.organization_name}
              indicator={<DomainIndicator kind="priority" level={topSignal.priority_level} value={topSignal.priority_score} />}
              reason="Наибольшая финансовая значимость среди текущих сигналов."
              finance={topSignal.financial_significance}
            />
          ) : <PriorityObjectEmpty title="Приоритетный сигнал пока не определён" />}

          {topOrganization ? (
            <PriorityObjectLink
              href={`/organizations/${topOrganization.id}`}
              eyebrow="Медицинская организация"
              title={topOrganization.name}
              context={"region" in topOrganization ? `${topOrganization.region} · ${number(topOrganization.signals_count)} сигналов` : `${number(topOrganization.high_risk_signals)} сигналов`}
              indicator={topOrganization.priority_level ? <DomainIndicator kind="priority" level={topOrganization.priority_level} value={topOrganization.priority_score ?? undefined} /> : undefined}
              reason={"main_reason" in topOrganization ? topOrganization.main_reason : topOrganization.primary_reason}
              finance={"review_amount" in topOrganization ? topOrganization.review_amount : topOrganization.financial_significance}
            />
          ) : <PriorityObjectEmpty title="Приоритетная организация пока не определена" />}

          {topPattern ? (
            <PriorityObjectLink
              href={`/patterns/${topPattern.id}`}
              eyebrow="Повторяющаяся модель"
              title={topPattern.name}
              context={topPattern.main_organization ?? topPattern.pattern_type_label}
              indicator={<DomainIndicator kind="importance" level={topPattern.importance_level} value={topPattern.importance_score} compact />}
              secondaryIndicator={<DomainIndicator kind="stability" level={topPattern.stability_level} value={topPattern.stability_score} compact />}
              reason={topPattern.primary_reason}
              finance={topPattern.financial_significance}
            />
          ) : <PriorityObjectEmpty title="Повторяющиеся модели пока не сформированы" />}
        </div>
      </section>

      <section className="mt-6">
        <AnalysisChangesPanel data={data.changes} />
      </section>

      <details className="group mt-6 overflow-hidden rounded-v2-section border border-v2-border bg-v2-surface">
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-v2-text hover:bg-v2-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-v2-primary md:px-6">
          <span>
            <span className="block">Экспертный контур и качество анализа</span>
            <span className="mt-1 block text-sm font-normal text-v2-text-secondary">Вторичный контекст без дублирования управленческого обзора.</span>
          </span>
          <ArrowRight className="h-4 w-4 transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
        </summary>
        <div className="border-t border-v2-border p-5 md:p-6">
          <MetricStrip label="Экспертная работа и качество">
            <MetricCard icon={ClipboardCheck} label="Сигналов без решения" value={number(data.expert_review.signals_without_decision)} />
            <MetricCard icon={Network} label="Моделей без решения" value={number(data.expert_review.patterns_without_decision)} />
            <MetricCard icon={CheckCircle2} label="F1-мера" value={percent(data.quality.f1, 2)} />
            <MetricCard icon={ScanSearch} label="Доля отбора" value={percent(data.quality.selected_for_review_rate, 2)} />
          </MetricStrip>
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <p className="text-sm font-bold text-v2-text">Фактические выводы текущего анализа</p>
              {data.findings.length ? (
                <ul className="mt-3 grid gap-2 md:grid-cols-2">
                  {data.findings.slice(0, 4).map((finding) => (
                    <li key={finding.title} className="rounded-v2-card bg-v2-surface-soft p-4">
                      <p className="font-semibold text-v2-text">{finding.title}</p>
                      <p className="mt-1 text-sm leading-6 text-v2-text-secondary">{finding.description}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState className="mt-3 min-h-36" title="Дополнительные выводы пока не сформированы" description="Основные рабочие приоритеты уже доступны выше." />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/reviews" className="inline-flex min-h-11 items-center gap-2 rounded-v2-control px-3 text-sm font-semibold text-v2-primary hover:bg-v2-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary">
                Результаты экспертной оценки
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/decision-journal" className="inline-flex min-h-11 items-center gap-2 rounded-v2-control px-3 text-sm font-semibold text-v2-primary hover:bg-v2-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary">
                Журнал решений
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

function PriorityObjectLink({
  href,
  eyebrow,
  title,
  context,
  indicator,
  secondaryIndicator,
  reason,
  finance,
}: {
  href: string;
  eyebrow: string;
  title: string;
  context: string;
  indicator?: React.ReactNode;
  secondaryIndicator?: React.ReactNode;
  reason: string;
  finance: string | null;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-56 min-w-0 flex-col rounded-v2-card border border-v2-border bg-v2-surface p-5 transition-[background-color,border-color,box-shadow] duration-100 hover:border-v2-primary hover:bg-v2-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary focus-visible:ring-offset-2 motion-reduce:transition-none"
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-v2-text-muted">{eyebrow}</p>
        {indicator}
      </div>
      <h3 className="mt-4 line-clamp-2 text-base font-bold leading-6 text-v2-text">{title}</h3>
      <p className="mt-1 line-clamp-1 text-sm text-v2-text-secondary">{context}</p>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-v2-text-secondary">{reason}</p>
      <div className="mt-auto flex min-w-0 items-end justify-between gap-3 border-t border-v2-border pt-4">
        <div>{secondaryIndicator}</div>
        <FinancialValue value={finance ?? "—"} compact />
      </div>
    </Link>
  );
}

function PriorityObjectEmpty({ title }: { title: string }) {
  return <EmptyState className="min-h-56" title={title} description="Объект появится после формирования соответствующих результатов анализа." />;
}
