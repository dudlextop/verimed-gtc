"use client";

import Link from "next/link";
import { CheckCircle2, History, Search, ShieldAlert, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { DecisionEvent } from "@/lib/types";
import { useApi } from "@/hooks/use-api";
import { dateTimeText } from "@/lib/utils";
import { Button, Card, Input, Select } from "@/components/ui";
import { EmptyState, ErrorState, PageLoading } from "@/components/data-state";
import { PageHeader } from "@/components/page-header";

export default function DecisionJournalPage() {
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [decision, setDecision] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [organization, setOrganization] = useState("");
  const [objectType, setObjectType] = useState("");
  const [analysisRun, setAnalysisRun] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<DecisionEvent | null>(null);
  const params = useMemo(() => {
    const value = new URLSearchParams({ page_size: "50" });
    if (search) value.set("search", search);
    if (entityType) value.set("entity_type", entityType);
    if (action) value.set("action_type", action);
    if (decision) value.set("decision_status", decision);
    if (reviewer) value.set("reviewer", reviewer);
    if (organization) value.set("organization_id", organization);
    if (objectType) value.set("object_type", objectType);
    if (analysisRun) value.set("analysis_run_id", analysisRun);
    if (dateFrom) value.set("date_from", dateFrom);
    if (dateTo) value.set("date_to", dateTo);
    return value.toString();
  }, [search, entityType, action, decision, reviewer, organization, objectType, analysisRun, dateFrom, dateTo]);
  const journal = useApi(() => api.decisionJournal(params), [params]);
  const integrity = useApi(api.journalIntegrity);
  if (journal.loading || integrity.loading) return <div className="page-shell"><PageLoading/></div>;
  const error = journal.error || integrity.error;
  if (error || !journal.data || !integrity.data) return <div className="page-shell"><ErrorState message={error ?? "История решений недоступна"} retry={() => { void journal.retry(); void integrity.retry(); }}/></div>;
  const data = journal.data;

  return <div className="page-shell"><PageHeader eyebrow="Экспертный контур" title="Журнал решений" description="Последовательная история экспертных действий. Записи доступны только для просмотра." action={<span className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold ${integrity.data.is_valid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{integrity.data.is_valid ? <CheckCircle2 className="h-4 w-4" aria-hidden="true"/> : <ShieldAlert className="h-4 w-4" aria-hidden="true"/>}{integrity.data.message}</span>}/>
    <Card className="p-4"><div className="grid gap-3 md:grid-cols-3"><label className="relative"><span className="sr-only">Поиск по журналу</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true"/><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по журналу"/></label><Select value={entityType} onChange={(event) => setEntityType(event.target.value)} aria-label="Тип объекта"><option value="">Все объекты</option><option value="signal">Сигналы</option><option value="pattern">Повторяющиеся модели</option></Select><Select value={decision} onChange={(event) => setDecision(event.target.value)} aria-label="Решение"><option value="">Все решения</option>{data.decision_statuses.map((item) => <option key={item}>{item}</option>)}</Select></div><details className="mt-3 rounded-md bg-muted px-3 py-2"><summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring"><SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden="true"/>Дополнительные фильтры</summary><div className="grid gap-3 border-t pt-3 md:grid-cols-2 xl:grid-cols-4"><Select value={objectType} onChange={(event) => setObjectType(event.target.value)} aria-label="Тип сигнала или модели"><option value="">Все типы сигналов и моделей</option>{data.object_types.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select><Select value={action} onChange={(event) => setAction(event.target.value)} aria-label="Действие"><option value="">Все действия</option>{data.actions.map((item) => <option key={item}>{item}</option>)}</Select><Select value={reviewer} onChange={(event) => setReviewer(event.target.value)} aria-label="Специалист"><option value="">Все специалисты</option>{data.reviewers.map((item) => <option key={item}>{item}</option>)}</Select><Select value={organization} onChange={(event) => setOrganization(event.target.value)} aria-label="Медицинская организация"><option value="">Все организации</option>{data.organizations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select><Select value={analysisRun} onChange={(event) => setAnalysisRun(event.target.value)} aria-label="Запуск анализа"><option value="">Все запуски</option>{data.analysis_runs.map((item) => <option key={item} value={item}>Запуск № {item}</option>)}</Select><label className="text-xs text-muted-foreground">Период с<Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="mt-1"/></label><label className="text-xs text-muted-foreground">Период по<Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="mt-1"/></label></div></details></Card>

    {data.items.length ? <><div className="mt-5 space-y-3 lg:hidden" data-testid="decision-journal-mobile-list">{data.items.map((event) => <button key={event.id} type="button" onClick={() => setSelected(event)} className="block w-full rounded-lg bg-card p-4 text-left shadow-card focus-visible:ring-2 focus-visible:ring-ring"><div className="flex items-start justify-between gap-3"><p className="font-semibold">{objectName(event)}</p><span className="shrink-0 text-xs text-muted-foreground">{dateTimeText(event.created_at)}</span></div><p className="mt-2 text-sm">{event.action_type}</p><p className="mt-1 text-sm font-semibold text-primary">{event.decision_status}</p><p className="mt-2 text-xs text-muted-foreground">{event.reviewer_display_name} · {organizationName(event)}</p></button>)}</div><Card className="mt-5 hidden overflow-hidden lg:block"><table className="w-full"><thead className="bg-slate-950 text-white"><tr><th className="table-cell text-left">Дата</th><th className="table-cell text-left">Объект</th><th className="table-cell text-left">Действие</th><th className="table-cell text-left">Решение</th><th className="table-cell text-left">Специалист</th><th className="table-cell text-left">Организация</th></tr></thead><tbody className="divide-y">{data.items.map((event) => <tr key={event.id} tabIndex={0} role="button" aria-label={`Открыть событие ${event.id}`} onClick={() => setSelected(event)} onKeyDown={(keyEvent) => { if (keyEvent.key === "Enter" || keyEvent.key === " ") { keyEvent.preventDefault(); setSelected(event); } }} className="cursor-pointer align-top hover:bg-violet-50/60 focus-visible:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><td className="table-cell whitespace-nowrap text-sm">{dateTimeText(event.created_at)}</td><td className="table-cell max-w-64 font-semibold">{objectName(event)}</td><td className="table-cell text-sm">{event.action_type}</td><td className="table-cell text-sm font-semibold">{event.decision_status}</td><td className="table-cell text-sm">{event.reviewer_display_name}</td><td className="table-cell max-w-56 text-sm text-muted-foreground">{organizationName(event)}</td></tr>)}</tbody></table></Card></> : <Card className="mt-5"><EmptyState title="Экспертные решения пока не зафиксированы" action={<Link href="/signals" className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-white">Перейти к проверке</Link>}/></Card>}
    <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><History className="h-4 w-4" aria-hidden="true"/>Проверено событий: {integrity.data.checked_events}. Целостность истории проверена.</p>
    {selected && <DecisionEventPanel event={selected} onClose={() => setSelected(null)}/>} 
  </div>;
}

function objectName(event: DecisionEvent) { return String(event.metadata.object_name ?? (event.entity_type === "signal" ? "Сигнал" : "Повторяющаяся модель")); }
function organizationName(event: DecisionEvent) { return String(event.metadata.organization_name ?? "Организация не указана"); }

function DecisionEventPanel({event, onClose}: {event: DecisionEvent; onClose: () => void}) {
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.querySelector<HTMLElement>("[aria-labelledby='event-title'] button")?.focus();
    const close = (keyEvent: KeyboardEvent) => { if (keyEvent.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("keydown", close); previousFocus?.focus(); };
  }, [onClose]);
  const href = event.current_entity_id ? `/${event.entity_type === "signal" ? "signals" : "patterns"}/${event.current_entity_id}` : null;
  return <div className="fixed inset-0 z-[70]"><button type="button" className="absolute inset-0 bg-slate-950/45" onClick={onClose} aria-label="Закрыть просмотр события"/><aside role="dialog" aria-modal="true" aria-labelledby="event-title" className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto bg-background p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Событие журнала</p><h2 id="event-title" className="mt-2 text-xl font-bold">{objectName(event)}</h2></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть"><X className="h-5 w-5" aria-hidden="true"/></Button></div><dl className="mt-6 grid gap-4 sm:grid-cols-2"><EventFact label="Решение" value={event.decision_status}/><EventFact label="Действие" value={event.action_type}/><EventFact label="Причина" value={event.reason_code}/><EventFact label="Специалист" value={event.reviewer_display_name}/><EventFact label="Дата" value={dateTimeText(event.created_at)}/><EventFact label="Запуск анализа" value={event.analysis_run_id ? `№ ${event.analysis_run_id}` : "Не указан"}/></dl>{event.comment && <div className="mt-5 rounded-lg bg-muted p-4"><p className="text-xs text-muted-foreground">Комментарий</p><p className="mt-2 text-sm leading-6">{event.comment}</p></div>}{event.supersedes_event_id && <p className="mt-4 text-sm text-violet-800">Уточняет предыдущее решение № {event.supersedes_event_id}.</p>}{href ? <Button asChild className="mt-6"><Link href={href}>Перейти к объекту</Link></Button> : <p className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-950">Объект отсутствует в текущем запуске, его история сохранена.</p>}</aside></div>;
}

function EventFact({label, value}: {label: string; value: string}) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-semibold">{value}</dd></div>; }
