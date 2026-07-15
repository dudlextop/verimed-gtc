"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, FileText, Network, Scale, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { dateText, money } from "@/lib/utils";
import {
  Button,
  DataPanel,
  DomainIndicator,
  EmptyState,
  FinancialValue,
  InlineNotice,
  MetricCard,
  MetricStrip,
  PageHeader,
  PageSkeleton,
  SectionHeader,
  StickyActionBar,
  Textarea,
} from "@/components/foundation";
import { ReviewActions, ReviewDialog, type ReviewChoice } from "@/components/signal-review-controls";
import { FinancialDisclaimer } from "@/components/financial-disclaimer";
import { PatternTypeBadge, StabilityBadge } from "@/components/pattern-badges";
import { DecisionTimeline, RecurrenceHistoryCard } from "@/components/decision-timeline";
import { ExpertFeedbackForm } from "@/components/expert-feedback-form";
import { adjacentIds, contextHref, parseOrderedIds } from "@/lib/work-context";

const STEPS = [
  { id: "summary", short: "Сводка", title: "Сводка" },
  { id: "rationale", short: "Обоснование", title: "Обоснование" },
  { id: "related", short: "Связи", title: "Связанные записи" },
  { id: "decision", short: "Решение", title: "Решение специалиста" },
] as const;

type ExplanationFactor = {
  name: string;
  contribution: number;
  actual_value: string;
  typical_value: string;
  explanation: string;
};

export default function SignalPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const state = useApi(() => api.signal(params.id), [params.id]);
  const detailsReady = state.data !== null;
  const patternLinks = useApi(() => api.signalPatterns(params.id), [params.id], detailsReady);
  const history = useApi(() => api.signalDecisionHistory(params.id), [params.id], detailsReady);
  const recurrence = useApi(() => api.signalRecurrenceHistory(params.id), [params.id], detailsReady);
  const [choice, setChoice] = useState<ReviewChoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [refineEventId, setRefineEventId] = useState<number | null>(null);
  const [showAllRelated, setShowAllRelated] = useState(false);
  const [showAllFactors, setShowAllFactors] = useState(false);
  const [activeStep, setActiveStep] = useState("summary");
  const [decisionSaved, setDecisionSaved] = useState(false);
  const stageNavRef = useRef<HTMLElement>(null);
  const returnTo = searchParams.get("returnTo") || "/signals";
  const orderedIds = parseOrderedIds(searchParams.get("queueIds"));
  const { previousId, nextId } = adjacentIds(orderedIds, Number(params.id));
  const signalHref = (id: number) => contextHref(`/signals/${id}`, returnTo, orderedIds);

  useEffect(() => {
    if (!detailsReady) return;
    const sections = STEPS.map(({ id }) => document.getElementById(id)).filter((item): item is HTMLElement => Boolean(item));
    if (!sections.length || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id) setActiveStep(visible.target.id);
    }, { rootMargin: "-24% 0px -62%", threshold: [0, 0.2, 0.55] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [detailsReady]);

  useEffect(() => {
    const active = stageNavRef.current?.querySelector<HTMLElement>(`[data-stage="${activeStep}"]`);
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    active?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest", inline: "center" });
  }, [activeStep]);

  const save = async (comment: string, reasonCode: string) => {
    if (!choice || !state.data) return;
    setSaving(true);
    setNotice(null);
    try {
      let updated;
      if (refineEventId !== null) {
        await api.signalDecisionEvent(state.data.id, { action_type: "Решение уточнено", decision_status: choice.status, reason_code: reasonCode, comment, supersedes_event_id: refineEventId });
        updated = await api.signal(params.id);
      } else {
        updated = await api.review(state.data.id, choice.status, comment, reasonCode);
      }
      state.setData(updated);
      setChoice(null);
      setCommentDraft("");
      setRefineEventId(null);
      void history.retry();
      void recurrence.retry();
      setDecisionSaved(true);
      setNotice(choice.commentOnly ? "Комментарий добавлен" : choice.status === "Направлено на углублённую проверку" ? "Сигнал направлен на проверку" : "Решение сохранено");
    } catch {
      setNotice("Не удалось сохранить решение. Повторите попытку.");
    } finally {
      setSaving(false);
    }
  };

  const addComment = async () => {
    if (!state.data || !commentDraft.trim()) return;
    setSaving(true);
    setNotice(null);
    try {
      await api.signalDecisionEvent(state.data.id, { action_type: "Добавлен комментарий", decision_status: state.data.status, reason_code: "иная причина", comment: commentDraft.trim() });
      setCommentDraft("");
      void history.retry();
      setNotice("Комментарий добавлен");
    } catch {
      setNotice("Не удалось добавить комментарий. Повторите попытку.");
    } finally {
      setSaving(false);
    }
  };

  const saveFeedback = async (feedback: Parameters<typeof api.signalDecisionEvent>[1]["feedback"]) => {
    if (!state.data) return;
    setSaving(true);
    setNotice(null);
    try {
      await api.signalDecisionEvent(state.data.id, { action_type: "Добавлен комментарий", decision_status: state.data.status, reason_code: "иная причина", comment: "Сохранена экспертная оценка качества анализа.", feedback });
      void history.retry();
      setNotice("Оценка качества анализа сохранена");
    } catch {
      setNotice("Не удалось сохранить оценку. Повторите попытку.");
    } finally {
      setSaving(false);
    }
  };

  if (state.loading) return <div className="page-shell"><PageSkeleton variant="detail"/></div>;
  if (state.error || !state.data) return <div className="page-shell"><EmptyState variant="error" title="Сигнал недоступен" description={state.error ?? "Не удалось получить данные сигнала."} action={<Button variant="secondary" onClick={() => void state.retry()}>Повторить</Button>}/></div>;

  const signal = state.data;
  const relatedServices = showAllRelated ? signal.related_services : signal.related_services.slice(0, 4);
  const recentHistory = history.data ? { ...history.data, events: history.data.events.slice(-3) } : null;
  const explanationFactors = [
    ...signal.factors.map((factor) => ({ factor, source: "Фактор риска" })),
    ...signal.priority_factors.map((factor) => ({ factor, source: "Фактор приоритета" })),
  ];
  const visibleFactors = showAllFactors ? explanationFactors : explanationFactors.slice(0, 3);

  return <div className="page-shell min-w-0 pb-28">
    <Link href={returnTo} className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-v2-control px-2 text-sm font-semibold text-v2-text-secondary hover:bg-v2-surface-soft hover:text-v2-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary"><ArrowLeft className="h-4 w-4" aria-hidden="true"/>К разделу «Проверка»</Link>

    <PageHeader
      eyebrow={`Сигнал № ${signal.id}`}
      title={signal.service_name}
      description={`${signal.organization_name} · ${signal.primary_reason}`}
      meta={<><DomainIndicator kind="priority" level={signal.priority_level ?? "Не рассчитан"} value={signal.priority_score ?? undefined}/><DomainIndicator kind="reviewStatus" level={signal.status}/><FinancialValue value={signal.financial_significance ?? "—"} label="Финансовая значимость"/></>}
      secondaryActions={<div className="flex items-center gap-1">{previousId && <Button asChild variant="ghost" size="compact"><Link href={signalHref(previousId)} aria-label="Предыдущий сигнал"><ArrowLeft className="h-4 w-4" aria-hidden="true"/><span className="hidden sm:inline">Предыдущий</span></Link></Button>}{nextId && <Button asChild variant="ghost" size="compact"><Link href={signalHref(nextId)}><span className="hidden sm:inline">Следующий</span><ArrowRight className="h-4 w-4" aria-hidden="true"/></Link></Button>}</div>}
    />

    <nav ref={stageNavRef} aria-label="Этапы проверки" className="sticky top-16 z-20 -mx-4 mb-5 overflow-x-auto border-y border-v2-border bg-v2-canvas/95 px-4 py-2 backdrop-blur md:-mx-6 md:px-6 xl:top-0 xl:mx-0 xl:rounded-v2-section xl:border xl:bg-v2-surface xl:px-2">
      <div className="flex min-w-max gap-1 xl:min-w-0 xl:justify-center">{STEPS.map((step, index) => <a
        key={step.id}
        data-stage={step.id}
        href={`#${step.id}`}
        aria-current={activeStep === step.id ? "step" : undefined}
        onClick={() => setActiveStep(step.id)}
        onKeyDown={(event) => navigateStages(event, step.id)}
        className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-v2-control px-3 text-sm font-semibold transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary motion-reduce:transition-none ${activeStep === step.id ? "bg-v2-selected text-v2-primary" : "text-v2-text-secondary hover:bg-v2-surface-soft hover:text-v2-text"}`}
      ><span className={`v2-tabular grid h-6 w-6 place-items-center rounded-full text-xs ${activeStep === step.id ? "bg-v2-primary text-white" : "bg-v2-surface-soft text-v2-text-secondary"}`}>{index + 1}</span><span>{step.short}</span></a>)}</div>
    </nav>

    <main className="mx-auto min-w-0 max-w-[72rem] space-y-5">
      <Step id="summary" number="1" title="Сводка" description="Основные сведения, необходимые для начала проверки.">
        <MetricStrip className="xl:grid-cols-4" label="Сводка сигнала">
          <MetricCard label="Оценка риска" value={`${signal.score} из 100`} detail={signal.level} icon={Scale} tone="risk"/>
          <MetricCard label="Дата услуги" value={dateText(signal.date)} icon={CalendarDays}/>
          <MetricCard label="Код пациента" value={signal.patient_code} icon={UserRound}/>
          <MetricCard label="Тип сигнала" value={signal.anomaly_type} icon={FileText}/>
        </MetricStrip>
        <div className="mt-4 rounded-v2-control bg-v2-surface-soft p-4"><p className="text-xs font-semibold text-v2-text-secondary">Почему сигнал требует внимания</p><p className="mt-1 text-sm font-semibold leading-6 text-v2-text">{signal.priority_explanation ?? signal.primary_reason}</p></div>
        <div className="mt-4"><FinancialDisclaimer/></div>
      </Step>

      <Step id="rationale" number="2" title="Обоснование" description="Факторы расположены от наиболее значимого вклада к дополнительному контексту.">
        <div className="space-y-3">{visibleFactors.map(({ factor, source }, index) => <FactorRow key={`${source}-${factor.name}-${index}`} factor={factor} source={source}/>)}</div>
        {explanationFactors.length > 3 && <Button variant="text" className="mt-4" onClick={() => setShowAllFactors((value) => !value)}>{showAllFactors ? "Показать основные факторы" : `Показать все факторы (${explanationFactors.length})`}</Button>}
        <Disclosure className="mt-5" title="Ограничения анализа" tone="warning" icon={<AlertTriangle className="h-5 w-5" aria-hidden="true"/>}><ul className="space-y-2">{signal.limitations.map((item) => <li key={item} className="text-sm leading-6 text-v2-text-secondary">• {item}</li>)}</ul></Disclosure>
      </Step>

      <Step id="related" number="3" title="Связанные записи" description="Наиболее значимые записи показаны в хронологическом порядке.">
        {relatedServices.length ? <ol className="relative border-l-2 border-v2-cyan/40 pl-6">{relatedServices.map((item) => <li key={item.record_id} className="relative pb-5 last:pb-0"><span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-v2-primary ring-4 ring-v2-primary-soft" aria-hidden="true"/><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-v2-text">{item.name}</p><p className="mt-1 text-sm text-v2-text-secondary">{dateText(item.date)} · {item.time} · {item.organization_name}</p><p className="mt-2 text-sm leading-6 text-v2-text-secondary">{item.relationship_explanation}</p></div><strong className="v2-tabular text-v2-teal-text">{money(item.amount)}</strong></div></li>)}</ol> : <EmptyState className="min-h-36" title="Связанные записи не найдены" description="Для текущего сигнала нет дополнительных услуг в доступном периоде."/>}
        {signal.related_services.length > 4 && <Button variant="text" className="mt-4" onClick={() => setShowAllRelated((value) => !value)}>{showAllRelated ? "Показать основные записи" : `Показать все связанные записи (${signal.related_services.length})`}</Button>}
        <div className="mt-6 border-t border-v2-border pt-5"><div className="flex items-center gap-2"><Network className="h-5 w-5 text-v2-primary" aria-hidden="true"/><h3 className="font-bold text-v2-text">Повторяющиеся модели</h3></div>{patternLinks.loading ? <p className="mt-3 text-sm text-v2-text-secondary">Загрузка связанных моделей…</p> : patternLinks.error ? <div className="mt-3"><EmptyState className="min-h-36" variant="error" title="Не удалось загрузить связанные модели" action={<Button variant="secondary" onClick={() => void patternLinks.retry()}>Повторить</Button>}/></div> : patternLinks.data?.length ? <div className="mt-3 grid gap-3 md:grid-cols-2">{patternLinks.data.slice(0, 4).map((pattern) => <Link key={pattern.id} href={`/patterns/${pattern.id}`} className="rounded-v2-card border border-v2-border bg-v2-surface-soft p-4 transition-colors duration-100 hover:border-v2-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary motion-reduce:transition-none"><div className="flex flex-wrap gap-2"><PatternTypeBadge label={pattern.pattern_type_label}/><StabilityBadge level={pattern.stability_level} score={pattern.stability_score}/></div><p className="mt-3 font-semibold text-v2-text">{pattern.name}</p><p className="mt-1 text-xs text-v2-text-secondary">{pattern.signal_count} связанных сигналов</p><span className="mt-3 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-v2-primary">Открыть модель<ArrowRight className="h-4 w-4" aria-hidden="true"/></span></Link>)}</div> : <p className="mt-3 text-sm text-v2-text-secondary">Сигнал не входит в сформированную повторяющуюся модель.</p>}</div>
      </Step>

      <Step id="decision" number="4" title="Решение специалиста" description="Зафиксируйте решение, комментарий и при необходимости дополнительный контекст.">
        <div className="flex flex-wrap items-center gap-3"><span className="text-sm text-v2-text-secondary">Текущий статус:</span><DomainIndicator kind="reviewStatus" level={signal.status}/></div>
        <div className="mt-5"><label htmlFor="decision-comment" className="text-sm font-semibold">Комментарий</label><Textarea id="decision-comment" rows={3} value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} maxLength={2000} className="mt-2" placeholder="Добавьте медицинский или организационный контекст"/><div className="mt-2 flex justify-end"><Button variant="text" disabled={saving || !commentDraft.trim()} onClick={() => void addComment()}>Добавить комментарий</Button></div></div>
        {decisionSaved && (
          <InlineNotice
            className="mt-5"
            tone="success"
            title="Решение сохранено"
            description="Можно перейти к следующему сигналу или вернуться в очередь с сохранёнными фильтрами."
            action={<Link href={returnTo} className="inline-flex min-h-10 items-center rounded-v2-control px-2 text-sm font-semibold text-v2-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary">Вернуться в Проверку</Link>}
          />
        )}
        <h3 className="mt-6 font-bold text-v2-text">Последние действия</h3><div className="mt-4">{history.loading ? <p className="text-sm text-v2-text-secondary">Загрузка последних действий…</p> : recentHistory ? <DecisionTimeline history={recentHistory} onRefine={(eventId) => { setRefineEventId(eventId); setCommentDraft(""); setNotice("Выберите уточнённое решение и добавьте комментарий."); }}/> : <EmptyState className="min-h-36" variant={history.error ? "error" : "history"} title={history.error ?? "История решений пока пуста"} action={history.error ? <Button variant="secondary" onClick={() => void history.retry()}>Повторить</Button> : undefined}/>}</div>
        {history.data && history.data.events.length > 3 && <Disclosure className="mt-4" title="Открыть полную историю решений"><DecisionTimeline history={history.data} onRefine={(eventId) => { setRefineEventId(eventId); setNotice("Выберите уточнённое решение и добавьте комментарий."); }}/></Disclosure>}
        <Disclosure className="mt-4" title="История повторного появления">{recurrence.loading ? <p className="text-sm text-v2-text-secondary">Загрузка истории появлений…</p> : recurrence.error || !recurrence.data ? <EmptyState className="min-h-32" variant="error" title={recurrence.error ?? "История появлений недоступна"} action={<Button variant="secondary" onClick={() => void recurrence.retry()}>Повторить</Button>}/> : <RecurrenceHistoryCard data={recurrence.data} kind="signal"/>}</Disclosure>
        <Disclosure className="mt-4" title="Оценить качество анализа"><ExpertFeedbackForm saving={saving} onSave={saveFeedback}/></Disclosure>
      </Step>
    </main>

    <StickyActionBar>
      {decisionSaved && nextId
        ? <div className="flex justify-end"><Button asChild><Link href={signalHref(nextId)}>Перейти к следующему сигналу<ArrowRight className="h-4 w-4" aria-hidden="true"/></Link></Button></div>
        : <ReviewActions currentStatus={signal.status} onChoose={setChoice}/>
      }
    </StickyActionBar>
    {notice && <div role="status" aria-live="polite" className="fixed bottom-24 left-4 right-4 z-50 rounded-v2-control bg-v2-text px-5 py-4 text-sm text-white shadow-v2-dropdown sm:left-auto sm:right-5 sm:max-w-sm">{notice}</div>}
    {choice && <ReviewDialog choice={choice} saving={saving} initialComment={commentDraft} onCancel={() => setChoice(null)} onSave={(comment, reasonCode) => void save(comment, reasonCode)}/>} 
  </div>;
}

function navigateStages(event: React.KeyboardEvent<HTMLAnchorElement>, currentId: string) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const currentIndex = STEPS.findIndex((step) => step.id === currentId);
  const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? STEPS.length - 1 : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + STEPS.length) % STEPS.length;
  const target = event.currentTarget.parentElement?.querySelector<HTMLAnchorElement>(`[data-stage="${STEPS[nextIndex].id}"]`);
  target?.focus();
}

function Step({ id, number, title, description, children }: { id: string; number: string; title: string; description: string; children: React.ReactNode }) {
  return <div id={id} className="min-w-0 scroll-mt-36"><DataPanel><SectionHeader eyebrow={`Этап ${number}`} title={title} description={description}/><div className="mt-5 min-w-0">{children}</div></DataPanel></div>;
}

function Value({ label, value }: { label: string; value: string }) {
  return <div className="rounded-v2-control bg-v2-surface-soft p-3"><p className="text-xs text-v2-text-secondary">{label}</p><p className="mt-1 break-words text-sm font-semibold text-v2-text">{value}</p></div>;
}

function FactorRow({ factor, source }: { factor: ExplanationFactor; source: string }) {
  return <article className="rounded-v2-card border border-v2-border bg-v2-surface p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-v2-primary">{source}</p><h3 className="mt-1 font-bold text-v2-text">{factor.name}</h3></div><span className="v2-tabular text-sm font-semibold text-v2-primary">Вклад +{factor.contribution}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Value label="Фактическое значение" value={factor.actual_value}/><Value label="Значение для сравнения" value={factor.typical_value}/></div><p className="mt-3 text-sm leading-6 text-v2-text-secondary">{factor.explanation}</p></article>;
}

function Disclosure({ title, children, className = "", tone = "neutral", icon }: { title: string; children: React.ReactNode; className?: string; tone?: "neutral" | "warning"; icon?: React.ReactNode }) {
  return <details className={`group rounded-v2-card border ${tone === "warning" ? "border-v2-warning/30 bg-v2-warning-soft" : "border-v2-border bg-v2-surface-soft"} ${className}`}><summary className={`flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-v2-card px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary ${tone === "warning" ? "text-v2-warning-text" : "text-v2-text"}`}>{icon}{title}<ArrowRight className="ml-auto h-4 w-4 text-v2-primary transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true"/></summary><div className="border-t border-v2-border p-4">{children}</div></details>;
}
