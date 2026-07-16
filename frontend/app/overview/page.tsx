"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FileSearch,
  MapPinned,
  Network,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import type { AnalyticsChanges, PatternChanges } from "@/lib/types";
import { dateTimeText, money, number, percent, plural } from "@/lib/utils";
import { isAnalysisStale } from "@/lib/overview";
import {
  Badge,
  BrandLogo,
  Button,
  DataPanel,
  DomainIndicator,
  EmptyState,
  FinancialValue,
  InlineNotice,
  MetricCard,
  MetricStrip,
  PageSkeleton,
  SectionHeader,
} from "@/components/foundation";
import { ErrorState } from "@/components/data-state";
import { OverviewActions } from "@/components/overview-actions";
import { OverviewSignalTimeline } from "@/components/overview-signal-timeline";
import { RegionalMonitoringMap, regionalDataCoverage } from "@/components/regional-monitoring-map";
import { PRIORITY_QUEUE_URL } from "@/components/command-center";

const SYNTHETIC_DATA_NOTE = "Показатели рассчитаны на воспроизводимом синтетическом наборе с известной эталонной разметкой.";

function OverviewPage() {
  const overview = useApi(api.overview, []);
  if (overview.loading) return <OverviewLoading />;
  if (overview.error || !overview.data) {
    return (
      <div className="min-h-screen bg-v2-canvas px-4 py-8 text-v2-text">
        <div className="mx-auto max-w-3xl">
          <ErrorState message={overview.error ?? "Ответ сервиса неполон"} retry={() => void overview.retry()} />
        </div>
      </div>
    );
  }

  const data = overview.data;
  const analysis = data.summary.analysis;
  const selectedCount = data.quality.true_positive_count + data.quality.false_positive_count;
  const reviewAmount = data.command_center.potential_review_amount;
  const stale = isAnalysisStale(data.command_center.last_analysis_at);
  const topOrganization = data.priority_summary.top_organization ?? data.command_center.priority_organization;
  const topSignal = data.priority_summary.top_signal ?? data.command_center.top_financial_signal;
  const topPattern = data.pattern_summary.top_importance_pattern;
  const regions = data.regional_monitoring ?? [];
  const topRegion = [...regions].sort((left, right) => right.signal_count - left.signal_count || left.region_name.localeCompare(right.region_name, "ru"))[0];
  const coverage = regionalDataCoverage(regions);
  const newSignals = data.changes.comparison_available ? data.changes.new_signals : null;

  const systemFindings: Array<{ icon: typeof Network; title: string; text: string; href?: string }> = [
    {
      icon: FileSearch,
      title: "Главный сигнал",
      text: topSignal
        ? `${topSignal.service_name}: приоритет ${topSignal.priority_score} из 100, финансовая значимость ${money(topSignal.financial_significance)}.`
        : "Приоритетный сигнал появится после формирования рабочей выборки.",
      href: topSignal ? `/signals/${topSignal.id}` : PRIORITY_QUEUE_URL,
    },
    {
      icon: MapPinned,
      title: "Региональная концентрация",
      text: topRegion
        ? `${topRegion.region_name}: ${number(topRegion.signal_count)} сигналов и ${money(topRegion.financial_significance)} финансовой значимости.`
        : "Региональные агрегаты пока отсутствуют.",
      href: topRegion ? `/organizations?region=${encodeURIComponent(topRegion.region_name)}` : "/organizations",
    },
    {
      icon: TrendingUp,
      title: "Изменение",
      text: newSignals === null
        ? "Изменения станут доступны после следующего запуска анализа."
        : `${number(newSignals)} новых сигналов сформировано относительно предыдущего запуска.`,
      href: PRIORITY_QUEUE_URL,
    },
    {
      icon: Network,
      title: "Ограничения данных",
      text: `${number(coverage.regionsWithoutData)} регионов геометрии не имеют фактического агрегата. Это не интерпретируется как нулевое значение.`,
    },
  ];

  return (
    <div className="min-h-screen min-w-0 max-w-full overflow-x-clip bg-v2-canvas text-v2-text" data-testid="overview-root">
      <OverviewHeader
        period={analysis.period}
        lastAnalysis={data.command_center.last_analysis_at}
        organizations={analysis.organizations_count}
        status={analysis.processing_status}
        stale={stale}
      />

      <main className="mx-auto grid w-full max-w-[1720px] gap-5 px-4 py-5 md:px-6 xl:px-8" id="overview-content">
        <section className="overview-print-section rounded-v2-section border border-v2-border bg-v2-surface p-5 md:p-6" aria-labelledby="overview-result-title">
          <div className="grid gap-5 xl:grid-cols-[minmax(24rem,.65fr)_minmax(0,1.35fr)] xl:items-center">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-v2-primary">Главный результат</p>
              <h1 id="overview-result-title" className="mt-2 text-[clamp(1.75rem,3vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.035em] text-v2-text">
                Аналитический обзор
              </h1>
              <p className="mt-3 max-w-[72ch] text-[0.9375rem] leading-6 text-v2-text-secondary">
                Verimed проанализировал <strong className="text-v2-text">{number(analysis.records_count)} медицинских услуг</strong> и отобрал для экспертной проверки{" "}
                <strong className="text-v2-text">{plural(selectedCount, ["запись", "записи", "записей"])} ({percent(data.quality.selected_for_review_rate, 2)})</strong>. Потенциальный объём проверки составляет{" "}
                <strong className="text-v2-teal-text">{money(reviewAmount, true)}</strong>.
              </p>
            </div>
            <MetricStrip className="xl:grid-cols-4" label="Управленческие показатели">
              <MetricCard variant="leading" icon={ClipboardCheck} label="Требуют проверки" value={<span className="whitespace-nowrap">{number(selectedCount)}</span>} detail={percent(data.quality.selected_for_review_rate, 2)} />
              <MetricCard tone="finance" icon={CircleDollarSign} label="Финансовый масштаб" value={<span className="whitespace-nowrap text-xl md:text-2xl">{money(reviewAmount, true)}</span>} />
              <MetricCard icon={MapPinned} label="Ведущий регион" value={<span className="block text-lg leading-6">{topRegion?.region_name ?? "Нет данных"}</span>} detail={topRegion ? `${number(topRegion.signal_count)} сигналов` : undefined} />
              <MetricCard icon={TrendingUp} label="Главное изменение" value={<span className="whitespace-nowrap">{newSignals === null ? "Нет сравнения" : number(newSignals)}</span>} detail={newSignals === null ? "Нужен следующий запуск" : "новых сигналов"} />
            </MetricStrip>
          </div>
        </section>

        <section aria-labelledby="overview-attention-title">
          <SectionHeader
            id="overview-attention-title"
            title="Требуют внимания"
            description="Три объекта с наибольшей текущей рабочей значимостью."
          />
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {topSignal ? (
              <AttentionLink
                href={`/signals/${topSignal.id}`}
                eyebrow="Сигнал"
                title={topSignal.service_name}
                context={topSignal.organization_name}
                reason="Наибольшая финансовая значимость среди текущих сигналов."
                indicator={<DomainIndicator kind="priority" level={topSignal.priority_level} value={topSignal.priority_score} />}
                finance={topSignal.financial_significance}
              />
            ) : <AttentionEmpty label="Приоритетный сигнал пока не определён" />}
            {topOrganization ? (
              <AttentionLink
                href={`/organizations/${topOrganization.id}`}
                eyebrow="Медицинская организация"
                title={topOrganization.name}
                reason={topOrganization.main_reason}
                indicator={<DomainIndicator kind="priority" level={topOrganization.priority_level} value={topOrganization.priority_score} />}
                finance={topOrganization.review_amount}
              />
            ) : <AttentionEmpty label="Приоритетная организация пока не определена" />}
            {topPattern ? (
              <AttentionLink
                href={`/patterns/${topPattern.id}`}
                eyebrow="Повторяющаяся модель"
                title={topPattern.name}
                context={topPattern.main_organization ?? "Несколько организаций"}
                reason={topPattern.primary_reason}
                indicator={<DomainIndicator kind="importance" level={topPattern.importance_level} value={topPattern.importance_score} compact />}
                secondaryIndicator={<DomainIndicator kind="stability" level={topPattern.stability_level} value={topPattern.stability_score} compact />}
                finance={topPattern.financial_significance}
              />
            ) : <AttentionEmpty label="Повторяющиеся модели пока не сформированы" />}
          </div>
        </section>

        {data.schema_version < 2 && (
          <InlineNotice
            tone="warning"
            title="Региональный слой использует ограниченный контракт"
            description="Для полной карты требуется версия overview API 2. Остальные показатели загружены."
          />
        )}

        <div className="overview-visual-grid grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,.75fr)]">
          <RegionalMonitoringMap regions={regions} />
          <DataPanel
            className="overview-print-section"
            title="Динамика сигналов"
            description="Как менялось количество сигналов за доступные фактические периоды."
          >
            <OverviewSignalTimeline data={data.timeline} />
          </DataPanel>
        </div>

        <div className="overview-insight-grid-v2 grid min-w-0 gap-5 xl:grid-cols-[1.1fr_.9fr_1fr]">
          <DataPanel className="overview-print-section" title="Структурированные выводы" description="Короткие выводы построены только из полей текущего ответа API.">
            <div className="space-y-1">
              {systemFindings.map((finding) => {
                const content = (
                  <>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-v2-control bg-v2-primary-soft text-v2-primary">
                      <finding.icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm text-v2-text">{finding.title}</strong>
                      <span className="mt-1 block text-xs leading-5 text-v2-text-secondary">{finding.text}</span>
                    </span>
                    {finding.href && <ArrowRight className="h-4 w-4 shrink-0 text-v2-primary" aria-hidden="true" />}
                  </>
                );
                return finding.href ? (
                  <Link key={finding.title} href={finding.href} className="flex min-h-16 items-start gap-3 rounded-v2-control p-2 hover:bg-v2-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary">
                    {content}
                  </Link>
                ) : (
                  <div key={finding.title} className="flex min-h-16 items-start gap-3 rounded-v2-control p-2">{content}</div>
                );
              })}
            </div>
          </DataPanel>

          <DataPanel className="overview-print-section" title="Качество анализа" description="Метрики воспроизводимого анализа без технической перегрузки.">
            <div className="grid grid-cols-2 gap-4">
              <QualityValue label="Точность" value={data.quality.precision} />
              <QualityValue label="Полнота" value={data.quality.recall} />
              <QualityValue label="F1-мера" value={data.quality.f1} />
              <QualityValue label="Ложноположительные записи" value={data.quality.false_positive_rate} />
            </div>
            <InlineNotice className="mt-5" title="Синтетические данные" description={SYNTHETIC_DATA_NOTE} />
            {!data.expert_review.sample_sufficient && (
              <p className="mt-3 text-xs leading-5 text-v2-text-secondary">
                {data.expert_review.sample_message ?? "Недостаточно экспертных решений для устойчивого вывода."}
              </p>
            )}
          </DataPanel>

          <DataPanel className="overview-print-section" title="Повторяющиеся модели" description="Распределение по типам без дополнительного крупного графика.">
            {data.pattern_summary.total_patterns > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-v2-card border border-v2-border bg-v2-border">
                  <SmallStat label="Всего моделей" value={number(data.pattern_summary.total_patterns)} />
                  <SmallStat label="Высокая устойчивость" value={number(data.pattern_summary.high_stability_patterns)} />
                  <SmallStat label="Организации" value={number(data.pattern_summary.affected_organizations)} />
                  <SmallStat label="Финансовая значимость" value={money(data.pattern_summary.financial_significance, true)} finance />
                </div>
                <div className="mt-5 space-y-3" aria-label="Распределение моделей по типам">
                  {data.pattern_distribution.slice(0, 4).map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="truncate text-v2-text-secondary">{item.label}</span>
                        <strong className="v2-tabular text-v2-text">{number(item.value)}</strong>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-v2-surface-soft" aria-hidden="true">
                        <span className="block h-full rounded-full bg-v2-primary" style={{ width: `${Math.min(100, item.percent)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState className="min-h-48" title="Повторяющиеся модели пока не сформированы" description="Для анализа требуется несколько периодов наблюдений." />
            )}
          </DataPanel>
        </div>

        <div className="grid min-w-0 gap-5 xl:grid-cols-[.8fr_1.2fr]">
          <ChangesSummary changes={data.changes} patternChanges={data.pattern_changes} />
          <section className="overview-print-section flex min-w-0 flex-col gap-5 rounded-v2-section border border-v2-primary/20 bg-v2-primary-soft p-5 md:flex-row md:items-center md:justify-between md:p-6" aria-labelledby="recommendation-title">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-v2-primary">Рекомендуемое действие</p>
              <h2 id="recommendation-title" className="mt-2 text-xl font-bold text-v2-text">Начать приоритетную проверку</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-v2-text-secondary">
                {topOrganization
                  ? `Начните с ${topOrganization.name}: приоритет ${topOrganization.priority_score} из 100 · ${number(topOrganization.high_risk_signals)} сигналов · ${money(topOrganization.review_amount)}.`
                  : "Перейдите к сигналам с наибольшим текущим приоритетом."}
              </p>
            </div>
            <Button asChild className="print:hidden">
              <Link href={PRIORITY_QUEUE_URL}>
                Перейти к проверке
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </section>
        </div>
      </main>
    </div>
  );
}

function OverviewHeader({
  period,
  lastAnalysis,
  organizations,
  status,
  stale,
}: {
  period: string;
  lastAnalysis: string | null;
  organizations: number;
  status: string;
  stale: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-v2-border bg-v2-surface/95 backdrop-blur print:static print:bg-white">
      <div className="mx-auto flex w-full max-w-[1720px] flex-wrap items-center gap-4 px-4 py-3 md:px-6 xl:flex-nowrap xl:px-8">
        <BrandLogo size="default" priority className="shrink-0" />
        <div className="order-3 flex min-w-0 basis-full flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-v2-text-secondary xl:order-none xl:flex-1 xl:basis-auto">
          <span className="inline-flex min-h-8 items-center gap-1.5"><BarChart3 className="h-4 w-4" aria-hidden="true" />{period}</span>
          <span className="inline-flex min-h-8 items-center gap-1.5"><Building2 className="h-4 w-4" aria-hidden="true" />{number(organizations)} организаций</span>
          <span className="inline-flex min-h-8 items-center gap-1.5"><Clock3 className="h-4 w-4" aria-hidden="true" />{lastAnalysis ? dateTimeText(lastAnalysis) : "Анализ ещё не выполнялся"}</span>
          <Badge className={stale ? "border-v2-warning/20 bg-v2-warning-soft text-v2-warning-text" : "border-v2-success/20 bg-v2-success-soft text-v2-success-text"}>
            <span className={stale ? "h-1.5 w-1.5 rounded-full bg-v2-warning" : "h-1.5 w-1.5 rounded-full bg-v2-success"} aria-hidden="true" />
            {stale ? "Данные требуют обновления" : status}
          </Badge>
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-2 print:hidden">
          <Link href="/" className="hidden min-h-11 items-center rounded-v2-control px-3 text-sm font-semibold text-v2-text hover:bg-v2-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary sm:inline-flex">
            Вернуться в систему
          </Link>
          <OverviewActions />
        </div>
      </div>
    </header>
  );
}

function AttentionLink({
  href,
  eyebrow,
  title,
  context,
  reason,
  indicator,
  secondaryIndicator,
  finance,
}: {
  href: string;
  eyebrow: string;
  title: string;
  context?: string;
  reason: string;
  indicator: React.ReactNode;
  secondaryIndicator?: React.ReactNode;
  finance: string;
}) {
  return (
    <Link
      href={href}
      className="overview-print-section group flex min-h-52 min-w-0 flex-col rounded-v2-card border border-v2-border bg-v2-surface p-5 transition-[background-color,border-color,box-shadow] duration-100 hover:border-v2-primary hover:bg-v2-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary focus-visible:ring-offset-2 motion-reduce:transition-none"
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-[0.12em] text-v2-text-muted">{eyebrow}</span>
        {indicator}
      </div>
      <h3 className="mt-4 line-clamp-2 text-base font-bold leading-6 text-v2-text">{title}</h3>
      {context && <p className="mt-1 line-clamp-1 text-sm text-v2-text-secondary">{context}</p>}
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-v2-text-secondary">{reason}</p>
      <div className="mt-auto flex items-end justify-between gap-3 border-t border-v2-border pt-4">
        <div>{secondaryIndicator}</div>
        <FinancialValue value={finance} compact />
      </div>
    </Link>
  );
}

function AttentionEmpty({ label }: { label: string }) {
  return <EmptyState className="min-h-52" title={label} description="Объект появится после формирования соответствующих результатов." />;
}

function QualityValue({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <strong className="v2-tabular block text-xl font-bold tracking-[-0.03em] text-v2-text">{percent(value, 2)}</strong>
      <span className="mt-1 block text-xs leading-5 text-v2-text-secondary">{label}</span>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-v2-surface-soft" aria-hidden="true">
        <span className="block h-full rounded-full bg-v2-primary" style={{ width: `${Math.min(value * 100, 100)}%` }} />
      </div>
    </div>
  );
}

function SmallStat({ label, value, finance = false }: { label: string; value: string; finance?: boolean }) {
  return (
    <div className="min-w-0 bg-v2-surface p-3">
      <strong className={finance ? "v2-tabular block truncate text-base font-bold text-v2-teal-text" : "v2-tabular block truncate text-base font-bold text-v2-text"}>{value}</strong>
      <span className="mt-1 block text-xs leading-4 text-v2-text-secondary">{label}</span>
    </div>
  );
}

function ChangesSummary({ changes, patternChanges }: { changes: AnalyticsChanges; patternChanges: PatternChanges }) {
  return (
    <DataPanel className="overview-print-section" title="Что изменилось" description="Изменения относительно предыдущего запуска.">
      {changes.comparison_available ? (
        <div className="grid gap-px overflow-hidden rounded-v2-card border border-v2-border bg-v2-border sm:grid-cols-3">
          <ChangeValue value={number(changes.new_signals)} label="новых сигналов" />
          <ChangeValue value={money(changes.review_amount_change, true)} label="финансовая значимость" finance />
          <ChangeValue value={number(patternChanges.new_patterns)} label="новых моделей" />
        </div>
      ) : (
        <EmptyState className="min-h-36" variant="history" title="Сравнение пока недоступно" description="Изменения станут доступны после следующего запуска анализа." />
      )}
    </DataPanel>
  );
}

function ChangeValue({ value, label, finance = false }: { value: string; label: string; finance?: boolean }) {
  return <div className="bg-v2-surface p-4"><strong className={finance ? "v2-tabular block text-lg font-bold text-v2-teal-text" : "v2-tabular block text-lg font-bold text-v2-text"}>{value}</strong><span className="mt-1 block text-xs text-v2-text-secondary">{label}</span></div>;
}

function OverviewLoading() {
  return (
    <div className="min-h-screen bg-v2-canvas px-4 py-5 text-v2-text md:px-6 xl:px-8" aria-label="Загрузка аналитического обзора" aria-busy="true">
      <div className="mx-auto max-w-[1720px]">
        <PageSkeleton variant="overview" />
      </div>
    </div>
  );
}

export default OverviewPage;
