"use client";
/* eslint-disable react-hooks/refs -- callback refs come from useNearViewport state, not useRef values. */

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  ExternalLink,
  Network,
  Users,
  Waves,
} from "lucide-react";
import { api } from "@/lib/api";
import type { PatternDetail, PatternParticipant, Signal } from "@/lib/types";
import { useApi } from "@/hooks/use-api";
import { useNearViewport } from "@/hooks/use-near-viewport";
import { adjacentIds, contextHref, parseOrderedIds } from "@/lib/work-context";
import { cn, dateText, money, number } from "@/lib/utils";
import {
  Button,
  DataPanel,
  DataTableCell,
  DataTableRow,
  DataTableShell,
  DomainIndicator,
  EmptyState,
  FinancialValue,
  InlineNotice,
  MetricCard,
  MetricStrip,
  MobileObjectCard,
  OverflowActions,
  PageHeader,
  PageSkeleton,
  SectionHeader,
  Skeleton,
  StickyActionBar,
} from "@/components/foundation";
import { DecisionTimeline, RecurrenceHistoryCard } from "@/components/decision-timeline";
import { ExpertFeedbackForm } from "@/components/expert-feedback-form";
import { PatternTypeBadge } from "@/components/pattern-badges";
import { PatternReviewActions, PatternReviewDialog, type PatternChoice } from "@/components/pattern-review-controls";
import { SignalPreviewPanel } from "@/components/signal-preview-panel";

const PatternTimelineChart = dynamic(() => import("@/components/pattern-timeline-chart").then((module) => module.PatternTimelineChart), { loading: () => <Skeleton className="h-64" /> });
const RelationshipGraph = dynamic(() => import("@/components/relationship-graph").then((module) => module.RelationshipGraph), { loading: () => <Skeleton className="h-96" /> });

const patternSections = [
  { id: "summary", label: "Сводка" },
  { id: "importance", label: "Важность" },
  { id: "participants", label: "Участники" },
  { id: "graph", label: "Граф" },
  { id: "work", label: "Сигналы и решение" },
] as const;

type Notice = { tone: "success" | "danger" | "info"; message: string } | null;

export default function PatternPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const detail = useApi(() => api.pattern(params.id), [params.id]);
  const graphSection = useNearViewport();
  const signalsSection = useNearViewport();
  const reviewSection = useNearViewport();
  const [timelineOpen, setTimelineOpen] = useState(false);
  const detailsReady = detail.data !== null;
  const graph = useApi(() => api.patternGraph(params.id), [params.id], detailsReady && graphSection.near);
  const timeline = useApi(() => api.patternTimeline(params.id), [params.id], detailsReady && timelineOpen);
  const signals = useApi(() => api.patternSignals(params.id), [params.id], detailsReady && signalsSection.near);
  const history = useApi(() => api.patternDecisionHistory(params.id), [params.id], detailsReady && reviewSection.near);
  const recurrence = useApi(() => api.patternRecurrenceHistory(params.id), [params.id], detailsReady && (timelineOpen || reviewSection.near));
  const [choice, setChoice] = useState<PatternChoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [refineEventId, setRefineEventId] = useState<number | null>(null);
  const [showAllFactors, setShowAllFactors] = useState(false);
  const [showAllSignals, setShowAllSignals] = useState(false);
  const [decisionSaved, setDecisionSaved] = useState(false);
  const requestedReturnTo = searchParams.get("returnTo");
  const returnTo = requestedReturnTo?.startsWith("/patterns") ? requestedReturnTo : "/patterns";
  const orderedIds = parseOrderedIds(searchParams.get("queueIds"));
  const { previousId, nextId } = adjacentIds(orderedIds, Number(params.id));
  const patternHref = (id: number) => contextHref(`/patterns/${id}`, returnTo, orderedIds);

  const save = async (comment: string, reasonCode: string) => {
    if (!choice || !detail.data) return;
    const savedChoice = choice;
    setSaving(true);
    setNotice(null);
    try {
      let updated;
      if (refineEventId !== null) {
        await api.patternDecisionEvent(detail.data.id, { action_type: "Решение уточнено", decision_status: savedChoice.status, reason_code: reasonCode, comment, supersedes_event_id: refineEventId });
        updated = await api.pattern(params.id);
      } else {
        updated = await api.reviewPattern(detail.data.id, savedChoice.status, comment, reasonCode);
      }
      detail.setData(updated);
      setChoice(null);
      setRefineEventId(null);
      setDecisionSaved(!savedChoice.commentOnly);
      void history.retry();
      void recurrence.retry();
      setNotice({ tone: "success", message: savedChoice.commentOnly ? "Комментарий добавлен" : "Оценка модели сохранена" });
    } catch {
      setNotice({ tone: "danger", message: "Не удалось сохранить экспертную оценку. Повторите попытку." });
    } finally {
      setSaving(false);
    }
  };

  const saveFeedback = async (feedback: Parameters<typeof api.patternDecisionEvent>[1]["feedback"]) => {
    if (!detail.data) return;
    setSaving(true);
    setNotice(null);
    try {
      await api.patternDecisionEvent(detail.data.id, { action_type: "Добавлен комментарий", decision_status: detail.data.review_status, reason_code: "иная причина", comment: "Сохранена экспертная оценка качества анализа.", feedback });
      void history.retry();
      setNotice({ tone: "success", message: "Обратная связь сохранена и добавлена в историю." });
    } catch {
      setNotice({ tone: "danger", message: "Не удалось сохранить обратную связь. Повторите попытку." });
    } finally {
      setSaving(false);
    }
  };

  if (detail.loading) return <div className="page-shell"><PageSkeleton variant="detail" /></div>;
  if (detail.error || !detail.data) return <div className="page-shell"><EmptyState variant="error" title="Не удалось загрузить модель" description="Проверьте соединение и повторите попытку." action={<Button variant="secondary" onClick={() => void detail.retry()}>Повторить</Button>} /></div>;

  const pattern = detail.data;
  const visibleFactors = showAllFactors ? pattern.factors : pattern.factors.slice(0, 3);
  const signalIds = signals.data?.map((signal) => signal.id) ?? [];
  const visibleSignals = showAllSignals ? signals.data ?? [] : signals.data?.slice(0, 8) ?? [];
  const previewIndex = previewId === null ? -1 : signalIds.indexOf(previewId);
  const currentPatternHref = contextHref(`/patterns/${pattern.id}`, returnTo, orderedIds);
  const recentHistory = history.data ? { ...history.data, events: history.data.events.slice(-3) } : null;

  return <div className="page-shell min-w-0 pb-24 sm:pb-28">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <Button asChild variant="text" className="-ml-2"><Link href={returnTo}><ArrowLeft className="h-4 w-4" aria-hidden="true" />К повторяющимся моделям</Link></Button>
      {orderedIds.length > 0 && <div className="flex items-center gap-1">
        <Button asChild={Boolean(previousId)} variant="ghost" size="compact" disabled={!previousId}>{previousId ? <Link href={patternHref(previousId)}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Предыдущая</Link> : <span><ArrowLeft className="h-4 w-4" aria-hidden="true" />Предыдущая</span>}</Button>
        <Button asChild={Boolean(nextId)} variant="ghost" size="compact" disabled={!nextId}>{nextId ? <Link href={patternHref(nextId)}>Следующая<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link> : <span>Следующая<ArrowRight className="h-4 w-4" aria-hidden="true" /></span>}</Button>
      </div>}
    </div>

    <PageHeader
      eyebrow="Повторяющаяся модель"
      title={pattern.name}
      description={pattern.description}
      meta={<>
        <PatternTypeBadge label={pattern.pattern_type_label} />
        {pattern.main_organization && <span className="inline-flex items-center gap-1.5"><Building2 className="h-4 w-4 text-v2-primary" aria-hidden="true" />{pattern.main_organization}</span>}
        <DomainIndicator kind="reviewStatus" level={pattern.review_status} />
      </>}
    />

    <PatternSectionNav />

    <section id="summary" className="scroll-mt-24">
      <SectionHeader className="mb-4" title="Сводка" description="Главные показатели модели и краткий аналитический вывод." />
      <MetricStrip className="max-sm:grid-cols-2 max-sm:[&>div]:p-3 max-sm:[&>div:nth-child(odd)]:border-r max-sm:[&>div:nth-last-child(-n+2)]:border-b-0" label="Сводка повторяющейся модели">
        <MetricCard label="Важность модели" value={`${pattern.importance_score} из 100`} detail={pattern.importance_level} icon={Network} tone="importance" prominent />
        <MetricCard label="Устойчивость" value={`${pattern.stability_score} из 100`} detail={`${pattern.stability_level} повторяемость`} icon={Waves} tone="stability" />
        <MetricCard label="Финансовая значимость" value={money(pattern.financial_significance, true)} detail="По уникальным связанным записям" icon={CircleDollarSign} tone="finance" />
        <MetricCard label="Период наблюдения" value={<span className="text-xl leading-6">{dateText(pattern.first_seen)} — {dateText(pattern.last_seen)}</span>} detail={`${number(pattern.period_count)} периодов`} icon={CalendarRange} />
      </MetricStrip>
      <DataPanel className="mt-5">
        <SectionHeader title="Краткий вывод" description={pattern.explanation} />
        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          <SummaryFact label="Связано сигналов" value={number(pattern.signal_count)} />
          <SummaryFact label="Организаций" value={number(pattern.organization_count)} />
          <SummaryFact label="Участников" value={`${number(pattern.doctor_count)} врачей · ${number(pattern.patient_count)} обезличенных пациентов`} />
        </dl>
      </DataPanel>
    </section>

    <section id="importance" className="mt-5 scroll-mt-24">
      <DataPanel>
        <SectionHeader title="Почему модель важна" description="Главные факторы показаны в порядке их вклада в важность модели." />
        {visibleFactors.length ? <div id="pattern-factors" className="mt-5 grid gap-3 lg:grid-cols-3">{visibleFactors.map((factor) => <FactorCard key={`${factor.factor_group}-${factor.name}`} factor={factor} />)}</div> : <EmptyState className="mt-5" variant="insufficient" title="Факторы пока не рассчитаны" description="Объяснение появится после формирования устойчивой модели." />}
        {pattern.factors.length > 3 && <Button variant="ghost" className="mt-4" aria-expanded={showAllFactors} aria-controls="pattern-factors" onClick={() => setShowAllFactors((value) => !value)}>{showAllFactors ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}{showAllFactors ? "Скрыть дополнительные факторы" : `Показать ещё ${pattern.factors.length - 3}`}</Button>}

        <details className="group mt-5 overflow-hidden rounded-v2-card border border-v2-border bg-v2-surface" onToggle={(event) => setTimelineOpen(event.currentTarget.open)}>
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-v2-primary">
            <span>Динамика важности и устойчивости</span>
            <ChevronDown className="h-4 w-4 text-v2-primary transition-transform duration-100 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
          </summary>
          {timelineOpen && <div className="border-t border-v2-border p-4">
            {recurrence.loading || timeline.loading ? <Skeleton className="h-64" /> : recurrence.error || !recurrence.data ? <EmptyState variant="error" title="Динамика недоступна" description="Не удалось получить историю появлений модели." action={<Button variant="secondary" onClick={() => { void recurrence.retry(); void timeline.retry(); }}>Повторить</Button>} /> : <PatternTimelineChart recurrence={recurrence.data} timeline={timeline.data ?? []} />}
          </div>}
        </details>

        <details className="group mt-5 overflow-hidden rounded-v2-card border border-v2-warning/25 bg-v2-warning-soft">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold text-v2-warning-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-v2-primary">
            <span>Ограничения анализа</span>
            <ChevronDown className="h-4 w-4 transition-transform duration-100 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
          </summary>
          <div className="border-t border-v2-warning/20 p-4"><p className="text-sm leading-6 text-v2-text-secondary">{pattern.disclaimer}</p>{pattern.limitations.length > 0 && <ul className="mt-3 space-y-2">{pattern.limitations.map((item) => <li key={item} className="text-sm leading-6 text-v2-text-secondary">• {item}</li>)}</ul>}</div>
        </details>
      </DataPanel>
    </section>

    <section id="participants" className="mt-5 scroll-mt-24">
      <DataPanel>
        <SectionHeader title="Участники и связи" description="Сначала показан читаемый состав модели; граф ниже дополняет, а не заменяет этот список." />
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ParticipantSummary icon={Building2} label="Основная организация" value={pattern.organizations[0]?.label ?? "Несколько организаций"} />
          <ParticipantSummary icon={Users} label="Основная услуга" value={pattern.services[0]?.label ?? "Несколько услуг"} />
          <ParticipantSummary icon={Network} label="Связано сигналов" value={number(pattern.signal_count)} />
        </div>
        {pattern.organizations.length || pattern.doctors.length || pattern.services.length || pattern.patients.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ParticipantList title="Организации" items={pattern.organizations} type="organization" />
          <ParticipantList title="Врачи" items={pattern.doctors} type="doctor" />
          <ParticipantList title="Услуги" items={pattern.services} type="service" />
          <ParticipantList title="Обезличенные пациенты" items={pattern.patients} type="patient" />
        </div> : <EmptyState className="mt-5" variant="insufficient" title="Участники не сформированы" description="Состав модели станет доступен после обновления аналитического снимка." />}
      </DataPanel>
    </section>

    <section ref={graphSection.ref} id="graph" className="mt-5 scroll-mt-24">
      <DataPanel>
        <SectionHeader title="Граф связей" description="Центральная модель объединяет участников и сигналы, которые устойчиво повторяются в доступных данных." />
        <InlineNotice className="mt-5" title="Что требует внимания" description={`Модель повторяется в ${number(pattern.period_count)} периодах и объединяет ${number(pattern.signal_count)} сигналов. Связь является аналитическим контекстом и требует экспертной оценки.`} />
        <div className="mt-5">
          {graph.loading || !graphSection.near ? <Skeleton className="h-96" /> : graph.error || !graph.data ? <EmptyState variant="error" title="Граф связей недоступен" description="Повторите запрос, чтобы восстановить визуальное представление." action={<Button variant="secondary" onClick={() => void graph.retry()}>Повторить</Button>} /> : graph.data.nodes.length ? <RelationshipGraph data={graph.data} /> : <EmptyState variant="insufficient" title="Связи не сформированы" description="Текстовый состав участников остаётся доступным выше." />}
        </div>
      </DataPanel>
    </section>

    <section id="work" className="mt-5 scroll-mt-24">
      <div ref={signalsSection.ref} id="incoming-signals" className="scroll-mt-24">
        <DataPanel>
          <SectionHeader title="Входящие сигналы" description="Откройте быстрый просмотр сигнала без потери контекста текущей модели." />
          <div className="mt-5">
            {signals.loading || !signalsSection.near ? <Skeleton className="h-52" /> : signals.error ? <EmptyState variant="error" title="Не удалось загрузить сигналы" description="Повторите запрос, чтобы восстановить список." action={<Button variant="secondary" onClick={() => void signals.retry()}>Повторить</Button>} /> : visibleSignals.length ? <PatternSignals signals={visibleSignals} allSignalIds={signalIds} currentPatternHref={currentPatternHref} onPreview={setPreviewId} /> : <EmptyState variant="insufficient" title="Связанные сигналы недоступны" description="В текущем запуске анализа у модели нет доступных сигналов." />}
          </div>
          {(signals.data?.length ?? 0) > 8 && <Button variant="ghost" className="mt-4" aria-expanded={showAllSignals} onClick={() => setShowAllSignals((value) => !value)}>{showAllSignals ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}{showAllSignals ? "Показать основные сигналы" : `Показать все сигналы (${signals.data?.length ?? 0})`}</Button>}
        </DataPanel>
      </div>

      <div ref={reviewSection.ref} id="decision" className="mt-5 scroll-mt-24">
        <DataPanel>
          <SectionHeader title="Экспертное решение" description="Решение специалиста фиксируется отдельно и не изменяет аналитические формулы." />
          <div className="mt-5 flex flex-wrap items-center gap-3"><span className="text-sm font-semibold text-v2-text-secondary">Текущий статус</span><DomainIndicator kind="reviewStatus" level={pattern.review_status} /></div>
          <div className="mt-6">
            <SectionHeader title="Последние действия" />
            <div className="mt-4">{history.loading || !reviewSection.near ? <Skeleton className="h-32" /> : recentHistory ? <DecisionTimeline history={recentHistory} onRefine={(eventId) => { setRefineEventId(eventId); setNotice({ tone: "info", message: "Выберите уточнённое решение и добавьте комментарий." }); }} /> : <EmptyState variant="error" title="История решений недоступна" description="Повторите запрос, чтобы восстановить журнал." action={<Button variant="secondary" onClick={() => void history.retry()}>Повторить</Button>} />}</div>
          </div>
          {history.data && history.data.events.length > 3 && <Disclosure title="Полная история решений"><DecisionTimeline history={history.data} onRefine={(eventId) => { setRefineEventId(eventId); setNotice({ tone: "info", message: "Выберите уточнённое решение и добавьте комментарий." }); }} /></Disclosure>}
          <Disclosure title="Что изменилось с предыдущего появления">
            {recurrence.loading || !reviewSection.near ? <Skeleton className="h-36" /> : recurrence.error || !recurrence.data ? <EmptyState variant="error" title="История появлений недоступна" description="Повторите запрос, чтобы восстановить сравнение." action={<Button variant="secondary" onClick={() => void recurrence.retry()}>Повторить</Button>} /> : <RecurrenceHistoryCard data={recurrence.data} kind="pattern" />}
          </Disclosure>
          <Disclosure title="Оценить качество анализа"><ExpertFeedbackForm pattern saving={saving} onSave={saveFeedback} /></Disclosure>
        </DataPanel>
      </div>
    </section>

    <StickyActionBar>
      <PatternReviewActions
        currentStatus={pattern.review_status}
        onChoose={setChoice}
        nextHref={decisionSaved && nextId ? patternHref(nextId) : undefined}
      />
    </StickyActionBar>

    {notice && <div className="fixed bottom-24 left-4 right-4 z-50 sm:left-auto sm:right-5 sm:max-w-sm"><InlineNotice tone={notice.tone} title={notice.message} action={<Button variant="text" size="compact" onClick={() => setNotice(null)}>Закрыть</Button>} /></div>}
    {choice && <PatternReviewDialog choice={choice} saving={saving} onCancel={() => setChoice(null)} onSave={(comment, reasonCode) => void save(comment, reasonCode)} />}
    {previewId !== null && <SignalPreviewPanel
      signalId={previewId}
      previousId={previewIndex > 0 ? signalIds[previewIndex - 1] : undefined}
      nextId={previewIndex >= 0 && previewIndex < signalIds.length - 1 ? signalIds[previewIndex + 1] : undefined}
      position={previewIndex >= 0 ? previewIndex + 1 : undefined}
      queueSize={signalIds.length}
      onNavigate={setPreviewId}
      fullCardHref={contextHref(`/signals/${previewId}`, currentPatternHref, signalIds)}
      onClose={() => setPreviewId(null)}
      onUpdated={() => void signals.retry()}
    />}
  </div>;
}

function PatternSectionNav() {
  const [activeSection, setActiveSection] = useState<(typeof patternSections)[number]["id"]>("summary");

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
      const targetId = visible?.target?.id;
      if (targetId && patternSections.some((section) => section.id === targetId)) setActiveSection(targetId as (typeof patternSections)[number]["id"]);
    }, { rootMargin: "-20% 0px -65% 0px", threshold: [0, 0.1] });
    for (const section of patternSections) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const active = document.querySelector<HTMLElement>(`[data-pattern-section="${activeSection}"]`);
    if (active && typeof active.scrollIntoView === "function") {
      const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      active.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduced ? "auto" : "smooth" });
    }
  }, [activeSection]);

  return <nav aria-label="Разделы карточки модели" className="sticky top-16 z-20 -mx-4 mb-5 overflow-x-auto border-y border-v2-border bg-v2-canvas/95 px-4 backdrop-blur md:-mx-6 md:px-6 lg:top-0 lg:mx-0 lg:rounded-v2-control lg:border">
    <div className="flex min-w-max items-center gap-1 py-2">
      {patternSections.map((section) => <a
        key={section.id}
        href={`#${section.id}`}
        data-pattern-section={section.id}
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

function SummaryFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-v2-control bg-v2-surface-soft p-4"><dt className="text-xs font-semibold text-v2-text-secondary">{label}</dt><dd className="v2-tabular mt-1 text-sm font-bold leading-6 text-v2-text">{value}</dd></div>;
}

function FactorCard({ factor }: { factor: PatternDetail["factors"][number] }) {
  return <article className="rounded-v2-card bg-v2-surface-soft p-4">
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0"><p className="text-xs font-semibold text-v2-primary">{factor.factor_group}</p><h3 className="mt-1 font-semibold leading-5 text-v2-text">{factor.name}</h3></div>
      <strong className="v2-tabular shrink-0 text-lg text-v2-primary">+{number(factor.contribution)}</strong>
    </div>
    <dl className="mt-3 grid gap-2 border-t border-v2-border pt-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
      <div><dt className="text-xs font-semibold text-v2-text-secondary">Наблюдаемое значение</dt><dd className="mt-1 text-sm font-semibold text-v2-text">{factor.actual_value}</dd></div>
      <div><dt className="text-xs font-semibold text-v2-text-secondary">Сопоставимое значение</dt><dd className="mt-1 text-sm font-semibold text-v2-text">{factor.typical_value}</dd></div>
    </dl>
    <p className="mt-3 text-sm leading-6 text-v2-text-secondary">{factor.explanation}</p>
  </article>;
}

function ParticipantSummary({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return <div className="flex min-w-0 items-start gap-3 rounded-v2-card bg-v2-surface-soft p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-v2-control bg-v2-primary-soft text-v2-primary"><Icon className="h-5 w-5" aria-hidden="true" /></span><div className="min-w-0"><p className="text-xs font-semibold text-v2-text-secondary">{label}</p><p className="mt-1 break-words text-sm font-bold leading-5 text-v2-text">{value}</p></div></div>;
}

function ParticipantList({ title, items, type }: { title: string; items: PatternParticipant[]; type: "organization" | "doctor" | "patient" | "service" }) {
  const visible = items.slice(0, 4);
  const rest = items.slice(4);
  const itemContent = (item: PatternParticipant) => type === "organization"
    ? <Link href={`/organizations/${item.id}`} className="min-w-0 line-clamp-2 font-semibold text-v2-text hover:text-v2-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary">{item.label}</Link>
    : <span className="min-w-0 line-clamp-2 text-v2-text">{item.label}</span>;
  return <section className="overflow-hidden rounded-v2-card border border-v2-border bg-v2-surface">
    <div className="flex items-center justify-between gap-3 border-b border-v2-border px-4 py-3"><h3 className="font-semibold text-v2-text">{title}</h3><span className="v2-tabular text-xs font-semibold text-v2-text-secondary">{number(items.length)}</span></div>
    {visible.length ? <ul className="divide-y divide-v2-border">{visible.map((item) => <li key={item.id} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-sm">{itemContent(item)}<strong className="v2-tabular shrink-0 text-v2-text">{number(item.signal_count)}</strong></li>)}</ul> : <p className="px-4 py-5 text-sm text-v2-text-secondary">Нет данных</p>}
    {rest.length > 0 && <details className="group border-t border-v2-border"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-sm font-semibold text-v2-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-v2-primary">Показать ещё {rest.length}<ChevronDown className="h-4 w-4 transition-transform duration-100 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" /></summary><ul className="divide-y divide-v2-border border-t border-v2-border">{rest.map((item) => <li key={item.id} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-sm">{itemContent(item)}<strong className="v2-tabular shrink-0 text-v2-text">{number(item.signal_count)}</strong></li>)}</ul></details>}
  </section>;
}

function PatternSignals({ signals, allSignalIds, currentPatternHref, onPreview }: { signals: Signal[]; allSignalIds: number[]; currentPatternHref: string; onPreview: (id: number) => void }) {
  const columns = [
    { id: "priority", label: "Приоритет", className: "w-40" },
    { id: "signal", label: "Сигнал и услуга", className: "w-[30%]" },
    { id: "organization", label: "Организация", className: "w-[24%]" },
    { id: "financial", label: "Финансовая значимость", align: "right" as const, className: "w-44" },
    { id: "status", label: "Статус", className: "w-44" },
    { id: "actions", label: "Действия", header: <span className="sr-only">Действия</span>, align: "right" as const, className: "w-14" },
  ];
  const fullHref = (signal: Signal) => contextHref(`/signals/${signal.id}`, currentPatternHref, allSignalIds);
  return <DataTableShell
    columns={columns}
    caption="Входящие сигналы модели"
    tableClassName="min-w-[58rem] table-fixed"
    mobileContent={<div data-testid="pattern-signals-mobile-list" className="space-y-3">{signals.map((signal) => <MobileObjectCard
      key={signal.id}
      title={signal.service_name}
      context={signal.organization_name}
      indicator={<DomainIndicator kind="priority" level={signal.priority_level ?? signal.level} value={signal.priority_score ?? signal.score} compact />}
      financial={<FinancialValue value={signal.financial_significance ?? signal.amount} compact />}
      status={<DomainIndicator kind="reviewStatus" level={signal.status} />}
      reason={signal.primary_reason}
      onClick={() => onPreview(signal.id)}
    />)}</div>}
  >
    {signals.map((signal) => <DataTableRow key={signal.id} tabIndex={0} aria-label={`Открыть быстрый просмотр сигнала «${signal.service_name}»`} onClick={() => onPreview(signal.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onPreview(signal.id); } }} className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-v2-primary">
      <DataTableCell><div className="flex items-center gap-2"><strong className="v2-tabular text-lg text-v2-text">{signal.priority_score ?? signal.score}</strong><DomainIndicator kind="priority" level={signal.priority_level ?? signal.level} compact /></div></DataTableCell>
      <DataTableCell clamp><p className="line-clamp-2 font-semibold text-v2-text">{signal.service_name}</p><p className="mt-1 text-xs text-v2-text-secondary">Сигнал № {signal.id}</p></DataTableCell>
      <DataTableCell clamp><p className="line-clamp-2 text-v2-text-secondary">{signal.organization_name}</p></DataTableCell>
      <DataTableCell className="text-right"><FinancialValue value={signal.financial_significance ?? signal.amount} compact className="justify-end" /></DataTableCell>
      <DataTableCell><DomainIndicator kind="reviewStatus" level={signal.status} /></DataTableCell>
      <DataTableCell className="px-1 text-right"><span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><OverflowActions iconOnly label={`Действия сигнала № ${signal.id}`} items={[{ id: "preview", label: "Быстрый просмотр", onSelect: () => onPreview(signal.id) }, { id: "open", label: "Открыть полную карточку", icon: <ExternalLink className="h-4 w-4" />, onSelect: () => document.getElementById(`pattern-signal-link-${signal.id}`)?.click() }]} /><Link id={`pattern-signal-link-${signal.id}`} href={fullHref(signal)} className="sr-only">Открыть сигнал № {signal.id}</Link></span></DataTableCell>
    </DataTableRow>)}
  </DataTableShell>;
}

function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
  return <details className="group mt-4 overflow-hidden rounded-v2-card border border-v2-border bg-v2-surface"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-v2-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-v2-primary"><span>{title}</span><ChevronDown className="h-4 w-4 text-v2-primary transition-transform duration-100 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" /></summary><div className="border-t border-v2-border p-4">{children}</div></details>;
}
