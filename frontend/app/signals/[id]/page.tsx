"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Building2, CalendarDays, CircleDollarSign, FileText, Network, Scale, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { dateText, money } from "@/lib/utils";
import { Badge, Button, Card } from "@/components/ui";
import { ErrorState, PageLoading } from "@/components/data-state";
import { StatusBadge } from "@/components/status-badge";
import { ReviewActions, ReviewDialog, type ReviewChoice } from "@/components/signal-review-controls";
import { PriorityBadge } from "@/components/priority-badge";
import { FinancialDisclaimer } from "@/components/financial-disclaimer";
import { PatternTypeBadge, StabilityBadge } from "@/components/pattern-badges";
import { DecisionTimeline, RecurrenceHistoryCard } from "@/components/decision-timeline";
import { ExpertFeedbackForm } from "@/components/expert-feedback-form";
import { adjacentIds, contextHref, parseOrderedIds } from "@/lib/work-context";

const STEPS = [
  ["summary", "1. Сводка"],
  ["rationale", "2. Обоснование"],
  ["related", "3. Связанные записи"],
  ["decision", "4. Решение специалиста"],
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
  const returnTo = searchParams.get("returnTo") || "/signals";
  const orderedIds = parseOrderedIds(searchParams.get("queueIds"));
  const { previousId, nextId } = adjacentIds(orderedIds, Number(params.id));
  const signalHref = (id: number) => contextHref(`/signals/${id}`, returnTo, orderedIds);

  useEffect(() => {
    const sections = STEPS.map(([id]) => document.getElementById(id)).filter((item): item is HTMLElement => Boolean(item));
    if (!sections.length || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id) setActiveStep(visible.target.id);
    }, { rootMargin: "-20% 0px -65%", threshold: [0, 0.25, 0.6] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const save = async (comment: string, reasonCode: string) => {
    if (!choice || !state.data) return;
    setSaving(true); setNotice(null);
    try {
      let updated;
      if (refineEventId !== null) {
        await api.signalDecisionEvent(state.data.id, { action_type: "Решение уточнено", decision_status: choice.status, reason_code: reasonCode, comment, supersedes_event_id: refineEventId });
        updated = await api.signal(params.id);
      } else {
        updated = await api.review(state.data.id, choice.status, comment, reasonCode);
      }
      state.setData(updated); setChoice(null); setCommentDraft(""); setRefineEventId(null);
      void history.retry(); void recurrence.retry();
      setDecisionSaved(true);
      setNotice(choice.commentOnly ? "Комментарий добавлен" : choice.status === "Направлено на углублённую проверку" ? "Сигнал направлен на проверку" : "Решение сохранено");
    } catch { setNotice("Не удалось сохранить решение. Повторите попытку."); }
    finally { setSaving(false); }
  };
  const addComment = async () => {
    if (!state.data || !commentDraft.trim()) return;
    setSaving(true); setNotice(null);
    try {
      await api.signalDecisionEvent(state.data.id, { action_type: "Добавлен комментарий", decision_status: state.data.status, reason_code: "иная причина", comment: commentDraft.trim() });
      setCommentDraft(""); void history.retry(); setNotice("Комментарий добавлен");
    } catch { setNotice("Не удалось добавить комментарий. Повторите попытку."); }
    finally { setSaving(false); }
  };
  const saveFeedback = async (feedback: Parameters<typeof api.signalDecisionEvent>[1]["feedback"]) => {
    if (!state.data) return;
    setSaving(true); setNotice(null);
    try { await api.signalDecisionEvent(state.data.id, { action_type: "Добавлен комментарий", decision_status: state.data.status, reason_code: "иная причина", comment: "Сохранена экспертная оценка качества анализа.", feedback }); void history.retry(); setNotice("Обратная связь сохранена и добавлена в историю."); }
    catch { setNotice("Не удалось сохранить обратную связь. Повторите попытку."); }
    finally { setSaving(false); }
  };

  if (state.loading) return <div className="page-shell"><PageLoading/></div>;
  if (state.error || !state.data) return <div className="page-shell"><ErrorState message={state.error ?? "Сигнал недоступен"} retry={() => void state.retry()}/></div>;

  const signal = state.data;
  const relatedServices = showAllRelated ? signal.related_services : signal.related_services.slice(0, 4);
  const recentHistory = history.data ? {...history.data, events: history.data.events.slice(-3)} : null;
  const explanationFactors = [
    ...signal.factors.map((factor) => ({factor, source: "Фактор риска"})),
    ...signal.priority_factors.map((factor) => ({factor, source: "Фактор приоритета"})),
  ];
  const visibleFactors = showAllFactors ? explanationFactors : explanationFactors.slice(0, 3);

  return <div className="page-shell min-w-0 pb-24 sm:pb-28">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><Link href={returnTo} className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="h-4 w-4" aria-hidden="true"/>К разделу «Проверка»</Link><div className="flex items-center gap-2">{previousId && <Button asChild variant="ghost"><Link href={signalHref(previousId)} aria-label="Предыдущий сигнал"><ArrowLeft className="h-4 w-4" aria-hidden="true"/>Предыдущий</Link></Button>}{nextId && <Button asChild variant="ghost"><Link href={signalHref(nextId)}>Следующий<ArrowRight className="h-4 w-4" aria-hidden="true"/></Link></Button>}</div></div>
    <header className="grid min-w-0 gap-5 border-b border-border/70 pb-6 xl:grid-cols-[minmax(0,1fr)_auto]"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge>Сигнал № {signal.id}</Badge><StatusBadge status={signal.status}/></div><h1 className="mt-4 break-words text-[clamp(1.75rem,3vw,2.5rem)] font-bold leading-[1.08] tracking-[-0.035em]">{signal.service_name}</h1><p className="mt-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Building2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true"/>{signal.organization_name}</p></div><Card className="min-w-0 border-priority/15 bg-gradient-to-br from-priority-soft via-card to-card p-5 sm:min-w-64"><p className="text-sm font-semibold text-priority">Приоритет проверки</p><div className="mt-2 flex items-baseline gap-2"><span className="font-mono text-5xl font-bold tracking-tight text-priority tabular-nums">{signal.priority_score ?? "—"}</span><span className="text-muted-foreground">из 100</span></div>{signal.priority_level && <div className="mt-3"><PriorityBadge level={signal.priority_level}/></div>}</Card></header>

    <div className="mt-7 grid min-w-0 gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Этапы проверки" className="sticky top-0 z-20 min-w-0 self-start xl:top-6"><Card className="grid grid-cols-4 gap-1 overflow-x-auto p-2 xl:block xl:p-3"><p className="hidden px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground xl:block">Этапы проверки</p>{STEPS.map(([id, label]) => <a key={id} href={`#${id}`} aria-current={activeStep === id ? "step" : undefined} onClick={() => setActiveStep(id)} className={`flex min-h-10 min-w-max items-center justify-center rounded-md px-3 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-ring sm:text-sm xl:justify-start ${activeStep === id ? "bg-violet-100 text-violet-900" : "hover:bg-muted"}`}>{label}</a>)}</Card></nav>
      <main className="min-w-0 space-y-6">
        <Step id="summary" number="1" title="Сводка">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5"><Fact icon={Scale} label="Оценка риска" value={`${signal.score} из 100 · ${signal.level}`}/><Fact icon={CircleDollarSign} label="Финансовая значимость" value={money(signal.financial_significance)}/><Fact icon={CalendarDays} label="Дата" value={dateText(signal.date)}/><Fact icon={UserRound} label="Код пациента" value={signal.patient_code}/><Fact icon={FileText} label="Тип сигнала" value={signal.anomaly_type}/></div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">{signal.priority_explanation ?? "Приоритет ещё не рассчитан."}</p>
          <div className="mt-4"><FinancialDisclaimer/></div>
        </Step>

        <Step id="rationale" number="2" title="Обоснование">
          <p className="text-sm leading-6 text-muted-foreground">Факторы риска и приоритета собраны в одном порядке: от наиболее значимого вклада к дополнительному контексту.</p>
          <div className="mt-5 space-y-3">{visibleFactors.map(({factor, source}, index) => <FactorRow key={`${source}-${factor.name}-${index}`} factor={factor} source={source}/>)}</div>
          {explanationFactors.length > 3 && <Button variant="ghost" className="mt-4" onClick={() => setShowAllFactors((value) => !value)}>{showAllFactors ? "Показать основные факторы" : `Показать все факторы (${explanationFactors.length})`}</Button>}
          <details className="group mt-5 rounded-lg bg-amber-50 p-4"><summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 font-semibold text-amber-950 focus-visible:ring-2 focus-visible:ring-ring"><AlertTriangle className="h-5 w-5" aria-hidden="true"/>Ограничения анализа</summary><ul className="mt-3 space-y-2 border-t border-amber-200 pt-3">{signal.limitations.map((item) => <li key={item} className="text-sm leading-6 text-slate-700">• {item}</li>)}</ul></details>
        </Step>

        <Step id="related" number="3" title="Связанные записи">
          {relatedServices.length ? <ol className="relative border-l-2 border-violet-200 pl-6">{relatedServices.map((item) => <li key={item.record_id} className="relative pb-5 last:pb-0"><span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-violet-100" aria-hidden="true"/><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{item.name}</p><p className="mt-1 text-sm text-muted-foreground">{dateText(item.date)} · {item.time} · {item.organization_name}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.relationship_explanation}</p></div><strong className="font-mono tabular-nums">{money(item.amount)}</strong></div></li>)}</ol> : <div className="rounded-lg bg-muted p-4"><p className="font-semibold">Связанные записи не найдены</p><p className="mt-1 text-sm text-muted-foreground">Для текущего сигнала нет дополнительных услуг в доступном периоде.</p></div>}
          {signal.related_services.length > 4 && <Button variant="ghost" className="mt-4" onClick={() => setShowAllRelated((value) => !value)}>{showAllRelated ? "Показать основные записи" : `Показать все связанные записи (${signal.related_services.length})`}</Button>}
          <div className="mt-6 border-t pt-5"><div className="flex items-center gap-2"><Network className="h-5 w-5 text-primary" aria-hidden="true"/><h3 className="font-bold">Повторяющиеся модели</h3></div>{patternLinks.loading ? <p className="mt-3 text-sm text-muted-foreground">Загрузка связанных моделей…</p> : patternLinks.error ? <div className="mt-3"><ErrorState message="Не удалось загрузить связанные модели" retry={() => void patternLinks.retry()}/></div> : patternLinks.data?.length ? <div className="mt-3 grid gap-3 md:grid-cols-2">{patternLinks.data.slice(0, 4).map((pattern) => <Link key={pattern.id} href={`/patterns/${pattern.id}`} className="rounded-lg bg-violet-50 p-4 focus-visible:ring-2 focus-visible:ring-ring"><div className="flex flex-wrap gap-2"><PatternTypeBadge label={pattern.pattern_type_label}/><StabilityBadge level={pattern.stability_level} score={pattern.stability_score}/></div><p className="mt-3 font-semibold">{pattern.name}</p><p className="mt-1 text-xs text-muted-foreground">{pattern.signal_count} связанных сигналов</p><span className="mt-3 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-primary">Открыть модель<ArrowRight className="h-4 w-4" aria-hidden="true"/></span></Link>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Сигнал не входит в сформированную повторяющуюся модель.</p>}</div>
        </Step>

        <Step id="decision" number="4" title="Решение специалиста">
          <div className="flex flex-wrap items-center gap-3"><span className="text-sm text-muted-foreground">Текущий статус:</span><StatusBadge status={signal.status}/></div>
          <div className="mt-5"><label htmlFor="decision-comment" className="text-sm font-semibold">Комментарий</label><textarea id="decision-comment" rows={3} value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} maxLength={2000} className="mt-2 w-full rounded-md border bg-card p-3 text-sm focus-visible:ring-2 focus-visible:ring-ring" placeholder="Добавьте медицинский или организационный контекст"/><div className="mt-2 flex justify-end"><Button variant="ghost" disabled={saving || !commentDraft.trim()} onClick={() => void addComment()}>Добавить комментарий</Button></div></div>
          {decisionSaved && <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4" role="status"><p className="font-semibold text-emerald-950">Решение сохранено</p><p className="mt-1 text-sm text-emerald-900">Можно перейти к следующему объекту или вернуться в очередь с сохранёнными фильтрами.</p><div className="mt-3 flex flex-wrap gap-2">{nextId && <Button asChild><Link href={signalHref(nextId)}>Перейти к следующему сигналу<ArrowRight className="h-4 w-4" aria-hidden="true"/></Link></Button>}<Button asChild variant="ghost"><Link href={returnTo}>Вернуться в Проверку</Link></Button></div></div>}
          <h3 className="mt-6 font-bold">Последние действия</h3><div className="mt-4">{history.loading ? <p className="text-sm text-muted-foreground">Загрузка последних действий…</p> : recentHistory ? <DecisionTimeline history={recentHistory} onRefine={(eventId) => { setRefineEventId(eventId); setCommentDraft(""); setNotice("Выберите уточнённое решение и добавьте комментарий."); }}/> : <ErrorState message={history.error ?? "История недоступна"} retry={() => void history.retry()}/>}</div>
          {history.data && history.data.events.length > 3 && <details className="mt-4 rounded-lg bg-muted p-4"><summary className="min-h-10 cursor-pointer list-none py-2 font-semibold text-primary focus-visible:ring-2 focus-visible:ring-ring">Открыть полную историю решений</summary><div className="mt-4 border-t pt-4"><DecisionTimeline history={history.data} onRefine={(eventId) => { setRefineEventId(eventId); setNotice("Выберите уточнённое решение и добавьте комментарий."); }}/></div></details>}
          <details className="mt-4 rounded-lg bg-muted p-4"><summary className="min-h-10 cursor-pointer list-none py-2 font-semibold focus-visible:ring-2 focus-visible:ring-ring">История повторного появления</summary><div className="mt-4 border-t pt-4">{recurrence.loading ? <p className="text-sm text-muted-foreground">Загрузка истории появлений…</p> : recurrence.error || !recurrence.data ? <ErrorState message={recurrence.error ?? "История появлений недоступна"} retry={() => void recurrence.retry()}/> : <RecurrenceHistoryCard data={recurrence.data} kind="signal"/>}</div></details>
          <details className="mt-4 rounded-lg bg-muted p-4"><summary className="min-h-10 cursor-pointer list-none py-2 font-semibold focus-visible:ring-2 focus-visible:ring-ring">Оценить качество анализа</summary><div className="mt-4 border-t pt-4"><ExpertFeedbackForm saving={saving} onSave={saveFeedback}/></div></details>
        </Step>
      </main>
    </div>

    <div className="sticky-workbar sticky bottom-0 z-30 mt-6 rounded-lg p-3 sm:bottom-4 sm:p-4"><ReviewActions currentStatus={signal.status} onChoose={setChoice}/></div>
    {notice && <div role="status" className="fixed bottom-24 left-4 right-4 z-50 rounded-lg bg-slate-950 px-5 py-4 text-sm text-white shadow-xl sm:left-auto sm:right-5 sm:max-w-sm">{notice}</div>}
    {choice && <ReviewDialog choice={choice} saving={saving} initialComment={commentDraft} onCancel={() => setChoice(null)} onSave={(comment, reasonCode) => void save(comment, reasonCode)}/>} 
  </div>;
}

function Step({id, number, title, children}: {id: string; number: string; title: string; children: React.ReactNode}) { return <Card id={id} className="min-w-0 scroll-mt-6 p-5 md:p-6"><div className="flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-sm font-bold text-primary">{number}</span><h2 className="text-xl font-bold tracking-[-0.02em]">{title}</h2></div><div className="mt-5 min-w-0">{children}</div></Card>; }
function Fact({icon: Icon, label, value}: {icon: typeof Building2; label: string; value: string}) { return <div className="min-w-0 rounded-lg border border-border/70 bg-surface-soft p-4"><Icon className="h-4 w-4 text-primary" aria-hidden="true"/><p className="mt-2 text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-bold">{value}</p></div>; }
function Value({label, value}: {label: string; value: string}) { return <div className="rounded-md bg-card p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value}</p></div>; }
function FactorRow({factor, source}: {factor: ExplanationFactor; source: string}) { return <div className="rounded-lg border border-border/75 bg-surface-raised p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-primary">{source}</p><h3 className="mt-1 font-bold">{factor.name}</h3></div><Badge className="border-primary/15 bg-primary/5 text-primary">Вклад +{factor.contribution}</Badge></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Value label="Фактическое значение" value={factor.actual_value}/><Value label="Значение для сравнения" value={factor.typical_value}/></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{factor.explanation}</p></div>; }
