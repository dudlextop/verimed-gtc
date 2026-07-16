"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  FileSearch,
  Gauge,
  MapPin,
  Stethoscope,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { contextHref } from "@/lib/work-context";
import { cn, money, number, percent } from "@/lib/utils";
import {
  Button,
  DataPanel,
  DataTableCell,
  DataTableRow,
  DataTableShell,
  DomainIndicator,
  EmptyState,
  FinancialValue,
  MetricCard,
  MetricStrip,
  MobileObjectCard,
  PageHeader,
  PageSkeleton,
  SectionHeader,
  Skeleton,
} from "@/components/foundation";
import { FinancialDisclaimer } from "@/components/financial-disclaimer";
import { OrganizationComparisonBlock } from "@/components/organization-comparison";
import { PrioritySparkline } from "@/components/priority-sparkline";
import type { PriorityFactor, RecurringPattern, Signal } from "@/lib/types";

const TimelineChart = dynamic(() => import("@/components/charts").then((module) => module.TimelineChart), { loading: () => <Skeleton className="h-64" /> });
const RiskDonut = dynamic(() => import("@/components/charts").then((module) => module.RiskDonut), { loading: () => <Skeleton className="h-64" /> });
const organizationSections = [
  { id: "summary", label: "Сводка" },
  { id: "reasons", label: "Причины" },
  { id: "comparison", label: "Сравнение" },
  { id: "signals", label: "Сигналы" },
  { id: "patterns", label: "Модели" },
] as const;

export default function OrganizationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showAdditionalAnalytics, setShowAdditionalAnalytics] = useState(false);
  const [showAllReasons, setShowAllReasons] = useState(false);
  const state = useApi(() => api.organization(params.id), [params.id]);
  const detailsReady = state.data !== null;
  const comparison = useApi(() => api.organizationComparison(params.id), [params.id], detailsReady);
  const patterns = useApi(() => api.organizationPatterns(params.id), [params.id], detailsReady);
  const requestedReturnTo = searchParams.get("returnTo");
  const returnTo = requestedReturnTo?.startsWith("/organizations") ? requestedReturnTo : "/organizations";

  if (state.loading) return <div className="page-shell"><PageSkeleton variant="detail" /></div>;
  if (state.error || !state.data) return <div className="page-shell"><EmptyState variant="error" title="Не удалось загрузить организацию" description="Проверьте соединение и повторите попытку." action={<Button variant="secondary" onClick={() => void state.retry()}>Повторить</Button>} /></div>;

  const org = state.data;
  const visibleReasons = showAllReasons ? org.priority_factors : org.priority_factors.slice(0, 4);
  const recentIds = org.recent_signals.map((signal) => signal.id);
  const signalsUrl = `/signals?organization_id=${org.id}&sort=priority`;

  return <div className="page-shell min-w-0">
    <Button asChild variant="text" className="mb-4 -ml-2">
      <Link href={returnTo}><ArrowLeft className="h-4 w-4" aria-hidden="true" />К списку организаций</Link>
    </Button>

    <PageHeader
      eyebrow="Медицинская организация"
      title={org.name}
      description="Профиль приоритета, объяснимые причины и сравнение с сопоставимой группой."
      meta={<>
        <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-v2-primary" aria-hidden="true" />{org.region}</span>
        <span className="inline-flex items-center gap-1.5"><Building2 className="h-4 w-4 text-v2-primary" aria-hidden="true" />{org.organization_type}</span>
        {org.priority_level && org.priority_score != null && <DomainIndicator kind="priority" level={org.priority_level} value={org.priority_score} compact />}
        <DomainIndicator kind="reviewStatus" level={org.review_status} />
      </>}
      primaryAction={<Button asChild><Link href={signalsUrl}>Открыть сигналы организации<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button>}
    />

    <OrganizationSectionNav />

    <section id="summary" className="scroll-mt-24">
      <MetricStrip className="max-sm:grid-cols-2 max-sm:[&>div]:p-3 max-sm:[&>div:nth-child(odd)]:border-r max-sm:[&>div:nth-last-child(-n+2)]:border-b-0" label="Показатели медицинской организации">
        <MetricCard label="Приоритет проверки" value={org.priority_score == null ? "Не рассчитан" : `${org.priority_score} из 100`} detail={org.priority_level ?? "Приоритет пока не рассчитан"} icon={Gauge} tone="priority" prominent />
        <MetricCard label="Финансовая значимость" value={money(org.financial_significance, true)} detail={`Общая сумма услуг: ${money(org.total_amount, true)}`} icon={CircleDollarSign} tone="finance" />
        <MetricCard label="Сигналы" value={number(org.signals_count)} detail={`${number(org.affected_patients)} пациентов · ${percent(org.unreviewed_share)} без решения`} icon={Stethoscope} />
        <MetricCard label="Главное отклонение" value={<span className="text-xl leading-6">{org.primary_reason}</span>} detail="Основная причина текущего приоритета" icon={FileSearch} tone="risk" />
      </MetricStrip>
    </section>

    <div id="reasons" className="mt-5 grid scroll-mt-24 gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <DataPanel>
        <SectionHeader title="Почему организация в фокусе" description="Главные факторы показаны в порядке их вклада в приоритет проверки." />
        {visibleReasons.length ? <div id="organization-priority-reasons" className="mt-5 space-y-3">
          {visibleReasons.map((factor) => <PriorityReason key={`${factor.name}-${factor.contribution}`} factor={factor} />)}
        </div> : <EmptyState variant="insufficient" title="Причины пока не рассчитаны" description="Объяснение появится после завершения анализа." />}
        {org.priority_factors.length > 4 && <Button variant="ghost" className="mt-4" aria-expanded={showAllReasons} aria-controls="organization-priority-reasons" onClick={() => setShowAllReasons((value) => !value)}>{showAllReasons ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}{showAllReasons ? "Скрыть дополнительные причины" : `Показать ещё ${org.priority_factors.length - 4}`}</Button>}
      </DataPanel>

      <DataPanel>
        <SectionHeader title="Динамика приоритета" description="Как менялся приоритет организации между запусками анализа." />
        <div className="mt-5"><PrioritySparkline history={org.priority_history} /></div>
        <dl className="mt-5 grid gap-3 border-t border-v2-border pt-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <TrendValue label="Изменение приоритета" value={org.priority_change == null ? null : org.priority_change} suffix="пунктов" />
          <TrendValue label="Изменение финансовой значимости" value={org.financial_change == null ? null : Number(org.financial_change)} formatter={(value) => money(value, true)} />
        </dl>
      </DataPanel>
    </div>

    <div className="mt-5"><FinancialDisclaimer /></div>

    <section id="comparison" className="mt-5 scroll-mt-24">
      {comparison.loading ? <DataPanel><Skeleton className="h-64" /></DataPanel> : comparison.error || !comparison.data ? <DataPanel><EmptyState variant="error" title="Сравнение недоступно" description="Не удалось получить сопоставимую группу." action={<Button variant="secondary" onClick={() => void comparison.retry()}>Повторить</Button>} /></DataPanel> : <OrganizationComparisonBlock data={comparison.data} />}
    </section>

    <section id="signals" className="mt-5 scroll-mt-24">
      <RelatedSignals signals={org.recent_signals} returnTo={`/organizations/${org.id}#signals`} onOpen={(href) => router.push(href)} allSignalsHref={signalsUrl} orderedIds={recentIds} />
    </section>

    <section id="patterns" className="mt-5 scroll-mt-24">
      <OrganizationPatterns organizationId={org.id} loading={patterns.loading} error={patterns.error} patterns={patterns.data ?? []} retry={patterns.retry} />
    </section>

    <details className="group mt-5 overflow-hidden rounded-v2-section border border-v2-border bg-v2-surface" onToggle={(event) => setShowAdditionalAnalytics(event.currentTarget.open)}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-semibold text-v2-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-v2-primary md:px-6">
        <span>Дополнительная аналитика</span>
        <span className="inline-flex items-center gap-2 text-sm font-normal text-v2-text-secondary"><span className="max-sm:hidden">Динамика услуг и распределение риска</span><ChevronDown className="h-4 w-4 transition-transform duration-100 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" /></span>
      </summary>
      {showAdditionalAnalytics && <div className="grid gap-5 border-t border-v2-border p-5 xl:grid-cols-[1.15fr_.85fr] md:p-6">
        <div><SectionHeader title="Динамика медицинских услуг" /><div className="mt-4"><TimelineChart data={org.timeline} /></div></div>
        <div><SectionHeader title="Распределение по уровням риска" /><div className="mt-4"><RiskDonut data={org.risk_distribution} /></div></div>
      </div>}
    </details>
  </div>;
}

function OrganizationSectionNav() {
  const [activeSection, setActiveSection] = useState<(typeof organizationSections)[number]["id"]>("summary");

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
      if (visible?.target.id && organizationSections.some((section) => section.id === visible.target.id)) {
        setActiveSection(visible.target.id as (typeof organizationSections)[number]["id"]);
      }
    }, { rootMargin: "-20% 0px -65% 0px", threshold: [0, 0.1] });
    for (const section of organizationSections) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  return <nav aria-label="Разделы карточки организации" className="sticky top-16 z-20 -mx-4 mb-5 overflow-x-auto border-y border-v2-border bg-v2-canvas/95 px-4 backdrop-blur md:-mx-6 md:px-6 lg:top-0 lg:mx-0 lg:rounded-v2-control lg:border">
    <div className="flex min-w-max items-center gap-1 py-2">
      {organizationSections.map((section) => <a
        key={section.id}
        href={`#${section.id}`}
        aria-current={activeSection === section.id ? "location" : undefined}
        onClick={() => setActiveSection(section.id)}
        className={cn(
          "inline-flex min-h-11 items-center rounded-v2-control px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary",
          activeSection === section.id ? "bg-v2-selected text-v2-primary-active" : "text-v2-text-secondary hover:bg-v2-surface-soft hover:text-v2-text",
        )}
      >{section.label}</a>)}
    </div>
  </nav>;
}

function PriorityReason({ factor }: { factor: PriorityFactor }) {
  const contribution = `${factor.contribution > 0 ? "+" : ""}${number(factor.contribution)}`;
  return <article className="rounded-v2-card bg-v2-surface-soft p-4">
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0"><h3 className="font-semibold leading-5 text-v2-text">{factor.name}</h3><p className="mt-1 text-xs text-v2-text-secondary">Вклад в приоритет</p></div>
      <strong className="v2-tabular shrink-0 text-lg text-v2-primary">{contribution}</strong>
    </div>
    <dl className="mt-3 grid gap-2 border-t border-v2-border pt-3 sm:grid-cols-2">
      <div><dt className="text-xs font-semibold text-v2-text-secondary">Наблюдаемое значение</dt><dd className="mt-1 text-sm font-semibold text-v2-text">{factor.actual_value}</dd></div>
      <div><dt className="text-xs font-semibold text-v2-text-secondary">Сопоставимое значение</dt><dd className="mt-1 text-sm font-semibold text-v2-text">{factor.typical_value}</dd></div>
    </dl>
    <p className="mt-3 text-sm leading-6 text-v2-text-secondary">{factor.explanation}</p>
  </article>;
}

function TrendValue({ label, value, suffix, formatter }: { label: string; value: number | null; suffix?: string; formatter?: (value: number) => string }) {
  if (value == null || Number.isNaN(value)) return <div><dt className="text-xs font-semibold text-v2-text-secondary">{label}</dt><dd className="mt-1 text-sm font-semibold text-v2-text">Недостаточно запусков</dd></div>;
  const positive = value > 0;
  const negative = value < 0;
  const display = formatter ? formatter(value) : `${positive ? "+" : ""}${number(value)}${suffix ? ` ${suffix}` : ""}`;
  return <div><dt className="text-xs font-semibold text-v2-text-secondary">{label}</dt><dd className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-v2-text">{positive ? <TrendingUp className="h-4 w-4 text-v2-high-text" aria-hidden="true" /> : negative ? <TrendingDown className="h-4 w-4 text-v2-teal-text" aria-hidden="true" /> : null}<span className="v2-tabular">{display}</span></dd></div>;
}

function RelatedSignals({ signals, returnTo, onOpen, allSignalsHref, orderedIds }: { signals: Signal[]; returnTo: string; onOpen: (href: string) => void; allSignalsHref: string; orderedIds: number[] }) {
  const columns = [
    { id: "priority", label: "Приоритет", className: "w-36" },
    { id: "signal", label: "Медицинская услуга", className: "w-[32%]" },
    { id: "reason", label: "Основная причина", className: "w-[30%]" },
    { id: "financial", label: "Финансовая значимость", align: "right" as const, className: "w-44" },
    { id: "status", label: "Статус", className: "w-44" },
  ];
  const signalHref = (signal: Signal) => contextHref(`/signals/${signal.id}`, returnTo, orderedIds);
  return <DataPanel>
    <SectionHeader title="Последние сигналы" description="Наиболее актуальные сигналы организации. Полная выборка открывается с фильтром организации." action={<Button asChild variant="secondary"><Link href={allSignalsHref}>Открыть все сигналы<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button>} />
    {signals.length ? <div className="mt-5"><DataTableShell columns={columns} caption="Последние сигналы организации" tableClassName="min-w-[52rem] table-fixed" mobileContent={<div className="space-y-3">{signals.map((signal) => <MobileObjectCard key={signal.id} href={signalHref(signal)} title={signal.service_name} context={signal.primary_reason} indicator={<DomainIndicator kind="priority" level={signal.priority_level ?? signal.level} value={signal.priority_score ?? signal.score} compact />} financial={<FinancialValue value={signal.financial_significance ?? signal.amount} compact />} status={<DomainIndicator kind="reviewStatus" level={signal.status} />} reason={signal.organization_name} />)}</div>}>
      {signals.map((signal) => {
        const href = signalHref(signal);
        return <DataTableRow key={signal.id} tabIndex={0} className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-v2-primary" aria-label={`Открыть сигнал «${signal.service_name}»`} onClick={() => onOpen(href)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(href); } }}>
          <DataTableCell><DomainIndicator kind="priority" level={signal.priority_level ?? signal.level} value={signal.priority_score ?? signal.score} compact /></DataTableCell>
          <DataTableCell clamp><p className="line-clamp-2 font-semibold text-v2-text">{signal.service_name}</p></DataTableCell>
          <DataTableCell clamp><p className="line-clamp-2 text-v2-text-secondary">{signal.primary_reason}</p></DataTableCell>
          <DataTableCell className="text-right"><FinancialValue value={signal.financial_significance ?? signal.amount} compact className="justify-end" /></DataTableCell>
          <DataTableCell><DomainIndicator kind="reviewStatus" level={signal.status} /></DataTableCell>
        </DataTableRow>;
      })}
    </DataTableShell></div> : <EmptyState title="Сигналы не сформированы" description="В текущем анализе по организации нет связанных сигналов." />}
  </DataPanel>;
}

function OrganizationPatterns({ organizationId, loading, error, patterns, retry }: { organizationId: number; loading: boolean; error: string | null; patterns: RecurringPattern[]; retry: () => Promise<void> }) {
  return <DataPanel>
    <SectionHeader title="Повторяющиеся модели организации" description="Устойчивые сочетания сигналов и связей, в которых участвует организация." action={patterns.length ? <Button asChild variant="secondary"><Link href={`/patterns?organization_id=${organizationId}`}>Открыть все модели<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button> : undefined} />
    {loading ? <Skeleton className="mt-5 h-40" /> : error ? <EmptyState variant="error" title="Не удалось загрузить модели" description="Повторите запрос, чтобы восстановить список." action={<Button variant="secondary" onClick={() => void retry()}>Повторить</Button>} /> : patterns.length ? <div className="mt-5 grid gap-3 md:grid-cols-2">{patterns.slice(0, 4).map((pattern) => <PatternCard key={pattern.id} pattern={pattern} />)}</div> : <EmptyState variant="insufficient" title="Повторяющиеся модели не сформированы" description="Для устойчивого вывода требуется несколько периодов наблюдений." />}
  </DataPanel>;
}

function PatternCard({ pattern }: { pattern: RecurringPattern }) {
  return <Link href={`/patterns/${pattern.id}`} className="group block rounded-v2-card border border-v2-border bg-v2-surface p-4 transition-[background-color,border-color] duration-100 hover:border-v2-primary hover:bg-v2-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary focus-visible:ring-offset-2 motion-reduce:transition-none">
    <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold text-v2-text-secondary">{pattern.pattern_type_label}</p><h3 className="mt-1 line-clamp-2 font-semibold leading-5 text-v2-text group-hover:text-v2-primary">{pattern.name}</h3></div><ArrowRight className="h-5 w-5 shrink-0 text-v2-primary" aria-hidden="true" /></div>
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-v2-border pt-3"><DomainIndicator kind="importance" level={pattern.importance_level} value={pattern.importance_score} label={`Важность: ${pattern.importance_level}`} /><DomainIndicator kind="stability" level={pattern.stability_level} value={pattern.stability_score} compact /></div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-v2-text-secondary"><span>{number(pattern.signal_count)} сигналов · {number(pattern.period_count)} периодов</span><FinancialValue value={pattern.financial_significance} compact /></div>
    <div className="mt-3"><DomainIndicator kind="reviewStatus" level={pattern.review_status} /></div>
  </Link>;
}
