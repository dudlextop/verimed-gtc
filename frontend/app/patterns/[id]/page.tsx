"use client";
/* eslint-disable react-hooks/refs -- callback refs come from useNearViewport state, not useRef values. */

import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarRange, CircleDollarSign, Network, Waves } from "lucide-react";
import { api } from "@/lib/api";
import type { PatternDetail } from "@/lib/types";
import { dateText, money, number } from "@/lib/utils";
import { useApi } from "@/hooks/use-api";
import { useNearViewport } from "@/hooks/use-near-viewport";
import { ErrorState, PageLoading } from "@/components/data-state";
import { ImportanceBadge, PatternTypeBadge, StabilityBadge } from "@/components/pattern-badges";
import { PatternReviewActions, PatternReviewDialog, type PatternChoice } from "@/components/pattern-review-controls";
import { PriorityBadge } from "@/components/priority-badge";
import { SignalPreviewPanel } from "@/components/signal-preview-panel";
import { Button, Card, Skeleton } from "@/components/ui";
import { DecisionTimeline, RecurrenceHistoryCard } from "@/components/decision-timeline";
import { ExpertFeedbackForm } from "@/components/expert-feedback-form";
import { adjacentIds, contextHref, parseOrderedIds } from "@/lib/work-context";

const PatternTimelineChart = dynamic(() => import("@/components/pattern-timeline-chart").then(module => module.PatternTimelineChart), {loading: () => <Skeleton className="h-64"/>});
const RelationshipGraph = dynamic(() => import("@/components/relationship-graph").then(module => module.RelationshipGraph), {loading: () => <Skeleton className="h-96"/>});

export default function PatternPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const detail = useApi(() => api.pattern(params.id), [params.id]);
  const relationsSection = useNearViewport();
  const signalsSection = useNearViewport();
  const reviewSection = useNearViewport();
  const [timelineOpen, setTimelineOpen] = useState(false);
  const detailsReady = detail.data !== null;
  const graph = useApi(() => api.patternGraph(params.id), [params.id], detailsReady && relationsSection.near);
  const timeline = useApi(() => api.patternTimeline(params.id), [params.id], detailsReady && timelineOpen);
  const signals = useApi(() => api.patternSignals(params.id), [params.id], detailsReady && signalsSection.near);
  const history = useApi(() => api.patternDecisionHistory(params.id), [params.id], detailsReady && reviewSection.near);
  const recurrence = useApi(() => api.patternRecurrenceHistory(params.id), [params.id], detailsReady && reviewSection.near);
  const [choice, setChoice] = useState<PatternChoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [refineEventId, setRefineEventId] = useState<number | null>(null);
  const [showAllFactors, setShowAllFactors] = useState(false);
  const returnTo = searchParams.get("returnTo") || "/patterns";
  const orderedIds = parseOrderedIds(searchParams.get("queueIds"));
  const { previousId, nextId } = adjacentIds(orderedIds, Number(params.id));
  const patternHref = (id: number) => contextHref(`/patterns/${id}`, returnTo, orderedIds);

  const save = async (comment: string, reasonCode: string) => {
    if (!choice || !detail.data) return;
    setSaving(true); setNotice(null);
    try {
      let updated;
      if (refineEventId !== null) {
        await api.patternDecisionEvent(detail.data.id, { action_type: "Решение уточнено", decision_status: choice.status, reason_code: reasonCode, comment, supersedes_event_id: refineEventId });
        updated = await api.pattern(params.id);
      } else {
        updated = await api.reviewPattern(detail.data.id, choice.status, comment, reasonCode);
      }
      detail.setData(updated); setChoice(null); setRefineEventId(null);
      void history.retry(); void recurrence.retry();
      setNotice(choice.commentOnly ? "Комментарий добавлен" : "Оценка модели сохранена");
    } catch { setNotice("Не удалось сохранить экспертную оценку. Повторите попытку."); }
    finally { setSaving(false); }
  };
  const saveFeedback = async (feedback: Parameters<typeof api.patternDecisionEvent>[1]["feedback"]) => {
    if (!detail.data) return;
    setSaving(true); setNotice(null);
    try { await api.patternDecisionEvent(detail.data.id, { action_type: "Добавлен комментарий", decision_status: detail.data.review_status, reason_code: "иная причина", comment: "Сохранена экспертная оценка качества анализа.", feedback }); void history.retry(); setNotice("Обратная связь сохранена и добавлена в историю."); }
    catch { setNotice("Не удалось сохранить обратную связь. Повторите попытку."); }
    finally { setSaving(false); }
  };

  if (detail.loading) return <div className="page-shell"><PageLoading/></div>;
  if (detail.error || !detail.data) return <div className="page-shell"><ErrorState message={detail.error ?? "Ответ сервиса неполон"} retry={() => void detail.retry()}/></div>;

  const pattern = detail.data;
  const recentHistory = history.data ? {...history.data, events: history.data.events.slice(-3)} : null;
  const visibleFactors = showAllFactors ? pattern.factors : pattern.factors.slice(0, 3);
  const signalIds = signals.data?.map((signal) => signal.id) ?? [];
  const previewIndex = previewId === null ? -1 : signalIds.indexOf(previewId);
  const currentPatternHref = contextHref(`/patterns/${pattern.id}`, returnTo, orderedIds);

  return <div className="page-shell min-w-0 pb-24 sm:pb-28">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><Link href={returnTo} className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="h-4 w-4" aria-hidden="true"/>К повторяющимся моделям</Link><div className="flex gap-2">{previousId && <Button asChild variant="ghost"><Link href={patternHref(previousId)}><ArrowLeft className="h-4 w-4" aria-hidden="true"/>Предыдущая</Link></Button>}{nextId && <Button asChild variant="ghost"><Link href={patternHref(nextId)}>Следующая<ArrowRight className="h-4 w-4" aria-hidden="true"/></Link></Button>}</div></div>
    <header className="min-w-0 border-b border-border/70 pb-6"><div className="flex min-w-0 flex-wrap gap-2"><PatternTypeBadge label={pattern.pattern_type_label}/><span className="inline-flex min-h-7 max-w-full items-center rounded-full border border-border/70 bg-muted px-2.5 text-xs font-semibold leading-5">{pattern.review_status}</span></div><h1 className="mt-4 max-w-4xl break-words text-[clamp(1.75rem,3vw,2.5rem)] font-bold leading-[1.08] tracking-[-0.035em]">{pattern.name}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{pattern.description}</p></header>

    <section id="summary" className="mt-7 scroll-mt-6"><Card className="p-5 md:p-6"><SectionTitle number="1" title="Сводка"/><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><div className="rounded-lg border border-importance/15 bg-gradient-to-br from-importance-soft via-card to-card p-5 sm:col-span-2 xl:col-span-1"><p className="text-sm font-semibold text-importance">Важность модели</p><div className="mt-2 flex items-baseline gap-2"><span className="font-mono text-5xl font-bold tracking-tight text-importance tabular-nums">{pattern.importance_score}</span><span className="text-muted-foreground">из 100</span></div><div className="mt-3"><ImportanceBadge level={pattern.importance_level}/></div></div><SummaryFact icon={Waves} label="Устойчивость" value={`${pattern.stability_score} из 100`} detail={<StabilityBadge level={pattern.stability_level} score={pattern.stability_score}/>}/><SummaryFact icon={CircleDollarSign} label="Финансовая значимость" value={money(pattern.financial_significance)}/><SummaryFact icon={CalendarRange} label="Период" value={`${dateText(pattern.first_seen)} — ${dateText(pattern.last_seen)}`}/><SummaryFact icon={Network} label="Статус экспертной оценки" value={pattern.review_status}/></div><p className="mt-5 max-w-4xl text-sm leading-7 text-muted-foreground">{pattern.explanation}</p></Card></section>

    <section id="importance" className="mt-5 scroll-mt-6"><Card className="p-5 md:p-6"><SectionTitle number="2" title="Почему модель важна"/><div className="mt-5 grid gap-3 lg:grid-cols-2">{visibleFactors.map((factor) => <FactorCard key={`${factor.factor_group}-${factor.name}`} factor={factor}/>)}</div>{pattern.factors.length > 3 && <Button className="mt-4" variant="ghost" onClick={() => setShowAllFactors((value) => !value)}>{showAllFactors ? "Показать основные факторы" : `Показать все факторы (${pattern.factors.length})`}</Button>}<details className="mt-6 rounded-lg bg-muted p-4" onToggle={(event) => setTimelineOpen(event.currentTarget.open)}><summary className="min-h-10 cursor-pointer list-none py-2 font-semibold focus-visible:ring-2 focus-visible:ring-ring">Краткая динамика</summary><p className="mt-1 text-sm text-muted-foreground">Количество связанных сигналов по периодам наблюдения.</p>{timelineOpen && <div className="mt-3">{timeline.loading ? <Skeleton className="h-64"/> : timeline.error || !timeline.data ? <ErrorState message={timeline.error ?? "Динамика недоступна"} retry={() => void timeline.retry()}/> : <PatternTimelineChart data={timeline.data}/>}</div>}</details><details className="mt-5 rounded-lg bg-amber-50 p-4"><summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 font-semibold text-amber-950 focus-visible:ring-2 focus-visible:ring-ring"><AlertTriangle className="h-5 w-5" aria-hidden="true"/>Ограничения анализа</summary><div className="mt-3 border-t border-amber-200 pt-3"><p className="text-sm leading-6 text-amber-950">{pattern.disclaimer}</p><ul className="mt-3 space-y-2">{pattern.limitations.map((item) => <li key={item} className="text-sm leading-6 text-slate-700">• {item}</li>)}</ul></div></details></Card></section>

    <section ref={relationsSection.ref} id="relations" className="mt-5 scroll-mt-6"><Card className="p-5 md:p-6"><SectionTitle number="3" title="Связи"/><h3 className="mt-5 font-bold">Что формирует модель</h3><ul className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-3"><li className="rounded-md bg-muted p-3">Основная организация: <strong className="text-foreground">{pattern.organizations[0]?.label ?? "несколько организаций"}</strong></li><li className="rounded-md bg-muted p-3">Основная услуга: <strong className="text-foreground">{pattern.services[0]?.label ?? "несколько услуг"}</strong></li><li className="rounded-md bg-muted p-3">Связано сигналов: <strong className="text-foreground">{number(pattern.signal_count)}</strong></li></ul><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><ParticipantList title="Организации" items={pattern.organizations} type="organization"/><ParticipantList title="Врачи" items={pattern.doctors} type="doctor"/><ParticipantList title="Услуги" items={pattern.services} type="service"/><ParticipantList title="Обезличенные пациенты" items={pattern.patients} type="patient"/></div><div className="mt-5">{graph.loading || !relationsSection.near ? <Skeleton className="h-96"/> : graph.error || !graph.data ? <ErrorState message={graph.error ?? "Граф связей недоступен"} retry={() => void graph.retry()}/> : <RelationshipGraph data={graph.data}/>}</div></Card></section>

    <section ref={signalsSection.ref} id="signals" className="mt-5 scroll-mt-6"><Card className="overflow-hidden"><div className="p-5 md:p-6"><SectionTitle number="4" title="Сигналы"/><p className="mt-2 text-sm text-muted-foreground">Откройте быстрый просмотр, чтобы изучить конкретный сигнал без потери контекста модели.</p></div>{signals.loading || !signalsSection.near ? <div className="px-6 pb-6"><Skeleton className="h-40"/></div> : signals.error ? <div className="px-6 pb-6"><ErrorState message={signals.error} retry={() => void signals.retry()}/></div> : signals.data?.length ? <><div className="space-y-3 px-4 pb-4 lg:hidden" data-testid="pattern-signals-mobile-list">{signals.data.map((signal) => <div key={signal.id} className="rounded-lg bg-muted p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-2xl font-bold tabular-nums">{signal.priority_score ?? "—"}<span className="ml-1 text-xs font-normal text-muted-foreground">приоритет</span></p>{signal.priority_level && <div className="mt-1"><PriorityBadge level={signal.priority_level}/></div>}</div><p className="font-mono text-sm font-bold tabular-nums">{money(signal.financial_significance)}</p></div><p className="mt-3 font-semibold">{signal.service_name}</p><p className="mt-1 text-sm text-muted-foreground">{signal.organization_name}</p><Button variant="secondary" className="mt-3 w-full" onClick={() => setPreviewId(signal.id)}>Быстрый просмотр</Button></div>)}</div><div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[780px]"><thead className="bg-slate-950 text-white"><tr><th className="table-cell">Приоритет</th><th className="table-cell">Сигнал и услуга</th><th className="table-cell">Организация</th><th className="table-cell">Финансовая значимость</th><th className="table-cell"><span className="sr-only">Действия</span></th></tr></thead><tbody className="divide-y">{signals.data.map((signal) => <tr key={signal.id} className="hover:bg-violet-50/60"><td className="table-cell"><strong className="font-mono text-lg tabular-nums">{signal.priority_score ?? "—"}</strong>{signal.priority_level && <div className="mt-1"><PriorityBadge level={signal.priority_level}/></div>}</td><td className="table-cell"><p className="font-semibold">{signal.service_name}</p><p className="mt-1 text-xs text-muted-foreground">Сигнал № {signal.id}</p></td><td className="table-cell max-w-56 text-sm text-muted-foreground"><Link href={`/organizations/${signal.organization_id}`} className="hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring">{signal.organization_name}</Link></td><td className="table-cell font-mono font-semibold tabular-nums">{money(signal.financial_significance)}</td><td className="table-cell"><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setPreviewId(signal.id)}>Быстрый просмотр</Button><Link href={`/signals/${signal.id}`} className="inline-flex min-h-10 items-center gap-1 rounded-md px-3 text-sm font-semibold text-primary focus-visible:ring-2 focus-visible:ring-ring">Открыть<ArrowRight className="h-4 w-4" aria-hidden="true"/></Link></div></td></tr>)}</tbody></table></div></> : <div className="px-6 pb-6 text-sm text-muted-foreground">Связанные сигналы недоступны в текущем запуске анализа.</div>}</Card></section>

    <section ref={reviewSection.ref} id="review" className="mt-5 scroll-mt-6"><Card className="p-5 md:p-6"><SectionTitle number="5" title="Экспертная оценка"/><p className="mt-3 text-sm">Текущий статус: <strong>{pattern.review_status}</strong></p><h3 className="mt-6 font-bold">Последние действия</h3><div className="mt-4">{history.loading || !reviewSection.near ? <p className="text-sm text-muted-foreground">Загрузка последних действий…</p> : recentHistory ? <DecisionTimeline history={recentHistory} onRefine={(eventId) => { setRefineEventId(eventId); setNotice("Выберите уточнённое решение и добавьте комментарий."); }}/> : <ErrorState message={history.error ?? "История недоступна"} retry={() => void history.retry()}/>}</div>{history.data && history.data.events.length > 3 && <details className="mt-4 rounded-lg bg-muted p-4"><summary className="min-h-10 cursor-pointer list-none py-2 font-semibold text-primary focus-visible:ring-2 focus-visible:ring-ring">Открыть полную историю решений</summary><div className="mt-4 border-t pt-4"><DecisionTimeline history={history.data} onRefine={(eventId) => { setRefineEventId(eventId); setNotice("Выберите уточнённое решение и добавьте комментарий."); }}/></div></details>}<details className="mt-4 rounded-lg bg-muted p-4"><summary className="min-h-10 cursor-pointer list-none py-2 font-semibold focus-visible:ring-2 focus-visible:ring-ring">Что изменилось с предыдущего появления</summary><div className="mt-4 border-t pt-4">{recurrence.loading || !reviewSection.near ? <p className="text-sm text-muted-foreground">Загрузка истории появлений…</p> : recurrence.error || !recurrence.data ? <ErrorState message={recurrence.error ?? "История появлений недоступна"} retry={() => void recurrence.retry()}/> : <RecurrenceHistoryCard data={recurrence.data} kind="pattern"/>}</div></details><details className="mt-4 rounded-lg bg-muted p-4"><summary className="min-h-10 cursor-pointer list-none py-2 font-semibold focus-visible:ring-2 focus-visible:ring-ring">Оценить качество анализа</summary><div className="mt-4 border-t pt-4"><ExpertFeedbackForm pattern saving={saving} onSave={saveFeedback}/></div></details></Card></section>

    <div className="sticky-workbar sticky bottom-0 z-30 mt-6 rounded-lg p-3 sm:bottom-4 sm:p-4"><PatternReviewActions currentStatus={pattern.review_status} onChoose={setChoice}/></div>
    {notice && <div role="status" className="fixed bottom-24 left-4 right-4 z-50 rounded-lg bg-slate-950 px-5 py-4 text-sm text-white shadow-xl sm:left-auto sm:right-5 sm:max-w-sm">{notice}</div>}
    {choice && <PatternReviewDialog choice={choice} saving={saving} onCancel={() => setChoice(null)} onSave={(comment, reasonCode) => void save(comment, reasonCode)}/>} 
    {previewId !== null && <SignalPreviewPanel signalId={previewId} previousId={previewIndex > 0 ? Number(signalIds[previewIndex - 1]) : undefined} nextId={previewIndex >= 0 && previewIndex < signalIds.length - 1 ? Number(signalIds[previewIndex + 1]) : undefined} onNavigate={(id) => setPreviewId(id)} fullCardHref={contextHref(`/signals/${previewId}`, currentPatternHref, signalIds)} onClose={() => setPreviewId(null)} onUpdated={() => void signals.retry()}/>} 
  </div>;
}

function SectionTitle({number: value, title}: {number: string; title: string}) { return <div className="flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-importance-soft text-sm font-bold text-importance">{value}</span><h2 className="text-xl font-bold tracking-[-0.02em]">{title}</h2></div>; }
function SummaryFact({icon: Icon, label, value, detail}: {icon: typeof Network; label: string; value: string; detail?: React.ReactNode}) { return <div className="min-w-0 rounded-lg border border-border/70 bg-surface-soft p-4"><Icon className="h-4 w-4 text-importance" aria-hidden="true"/><p className="mt-2 text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-1 break-words font-mono text-lg font-bold tabular-nums">{value}</p>{detail && <div className="mt-2">{detail}</div>}</div>; }
function FactorCard({factor}: {factor: PatternDetail["factors"][number]}) { return <div className="rounded-lg border border-border/75 bg-surface-raised p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-semibold text-importance">{factor.factor_group}</p><p className="mt-1 font-semibold">{factor.name}</p></div><strong className="font-mono text-importance">+{factor.contribution}</strong></div><p className="mt-3 text-sm text-muted-foreground">{factor.actual_value} · сравнение: {factor.typical_value}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{factor.explanation}</p></div>; }
function ParticipantList({title, items, type}: {title: string; items: PatternDetail["organizations"]; type: "organization" | "doctor" | "patient" | "service"}) { return <div className="rounded-lg bg-muted p-4"><h3 className="font-bold">{title}</h3><ul className="mt-3 space-y-2">{items.slice(0, 4).map((item) => <li key={item.id} className="flex justify-between gap-3 text-sm">{type === "organization" ? <Link href={`/organizations/${item.id}`} className="min-w-0 truncate font-semibold hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring">{item.label}</Link> : <span className="min-w-0 truncate">{item.label}</span>}<strong>{item.signal_count}</strong></li>)}</ul>{items.length > 4 && <p className="mt-3 text-xs text-muted-foreground">Ещё участников: {items.length - 4}</p>}</div>; }
