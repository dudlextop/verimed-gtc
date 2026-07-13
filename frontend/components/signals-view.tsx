"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, RotateCcw, ShieldAlert, SlidersHorizontal, X } from "lucide-react";
import { api } from "@/lib/api";
import type { Signal } from "@/lib/types";
import { useApi } from "@/hooks/use-api";
import { dateText, money } from "@/lib/utils";
import { adjacentIds, contextHref, queueScrollKey } from "@/lib/work-context";
import { Button, Card, Select } from "./ui";
import { EmptyState, ErrorState, PageLoading } from "./data-state";
import { StatusBadge } from "./status-badge";
import { SignalPreviewPanel } from "./signal-preview-panel";
import { PriorityBadge } from "./priority-badge";
import { PRIORITY_QUEUE_URL } from "./command-center";

const CHECK_VIEWS = [
  {key: "all", label: "Все сигналы", href: "/signals"},
  {key: "priority", label: "Приоритетные", href: PRIORITY_QUEUE_URL},
  {key: "without_decision", label: "Без решения", href: "/signals?has_decision=false&sort=priority"},
  {key: "in_progress", label: "На рассмотрении", href: "/signals?status=На%20рассмотрении&sort=priority"},
  {key: "completed", label: "Завершённые", href: "/signals?status=Проверка%20завершена&sort=date"},
] as const;

const FILTER_LABELS: Record<string, string> = {
  priority_level: "Приоритет", status: "Статус", period_months: "Период", level: "Риск",
  levels: "Риск", anomaly_type: "Тип отклонения", region: "Регион",
  financial_min: "Финансовая значимость", has_decision: "Решение", organization_id: "Организация",
};

export function SignalsView() {
  const router = useRouter();
  const params = useSearchParams();
  const dataParams = new URLSearchParams(params.toString());
  dataParams.delete("signal");
  const query = dataParams.toString();
  const queueUrl = `/signals${query ? `?${query}` : ""}`;
  const state = useApi(() => api.signals(query), query);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    next.delete("signal");
    if (value) next.set(key, value); else next.delete(key);
    if (key === "level") next.delete("levels");
    next.delete("page");
    router.replace(`/signals?${next}`, {scroll: false});
  };
  const openPreview = useCallback((signalId: number) => {
    const next = new URLSearchParams(params.toString());
    next.set("signal", String(signalId));
    router.replace(`/signals?${next}`, {scroll: false});
  }, [params, router]);
  const closePreview = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    next.delete("signal");
    router.replace(`/signals?${next}`, {scroll: false});
  }, [params, router]);

  useEffect(() => {
    if (!state.data) return;
    const stored = sessionStorage.getItem(queueScrollKey(queueUrl));
    if (!stored) return;
    sessionStorage.removeItem(queueScrollKey(queueUrl));
    window.requestAnimationFrame(() => window.scrollTo({top: Number(stored), behavior: "auto"}));
  }, [queueUrl, state.data]);

  const activeView = useMemo(() => {
    if (params.getAll("levels").length > 0) return "priority";
    if (params.get("status") === "На рассмотрении") return "in_progress";
    if (params.get("status") === "Проверка завершена") return "completed";
    if (params.get("has_decision") === "false") return "without_decision";
    return "all";
  }, [params]);

  const activeFilters = useMemo(() => {
    const result: {key: string; label: string; value: string}[] = [];
    for (const key of Object.keys(FILTER_LABELS)) {
      const values = params.getAll(key);
      if (!values.length) continue;
      const raw = values.join(", ");
      const display = key === "period_months" ? `${raw} мес.` : key === "has_decision" ? (raw === "false" ? "Без решения" : "Есть решение") : raw;
      result.push({key, label: FILTER_LABELS[key], value: display});
    }
    return result;
  }, [params]);

  if (state.loading) return <PageLoading/>;
  if (state.error || !state.data) return <ErrorState message={state.error ?? "Ответ сервиса неполон"} retry={() => void state.retry()}/>;

  const page = Number(params.get("page") ?? 1);
  const pages = Math.ceil(state.data.total / state.data.page_size);
  const previewId = Number(params.get("signal") ?? 0) || null;
  const pageIds = state.data.items.map((item) => item.id);
  const adjacent = previewId ? adjacentIds(pageIds, previewId) : {previousId: null, nextId: null};
  const fullCardHref = previewId ? contextHref(`/signals/${previewId}`, queueUrl, pageIds) : "/signals";
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const toggleSelection = (id: number) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const togglePage = () => setSelectedIds((current) => allPageSelected ? current.filter((id) => !pageIds.includes(id)) : [...new Set([...current, ...pageIds])]);
  const selectedSignals = state.data.items.filter((item) => selectedIds.includes(item.id));
  const exportSelected = () => {
    if (!selectedSignals.length) return;
    const header = "Дата;Организация;Код пациента;Услуга;Сумма;Оценка риска;Приоритет;Финансовая значимость;Причина;Статус\n";
    const content = selectedSignals.map((signal) => [signal.date, signal.organization_name, signal.patient_code, signal.service_name, signal.amount, signal.score, signal.priority_score ?? "", signal.financial_significance ?? "", signal.primary_reason, signal.status].map((value) => `\"${String(value).replaceAll("\"", "\"\"")}\"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", header, content], {type: "text/csv;charset=utf-8"}));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "verimed-signals.csv"; anchor.click(); URL.revokeObjectURL(url);
  };

  return <>
    <nav aria-label="Представления раздела Проверка" className="mb-4 flex gap-2 overflow-x-auto pb-1">{CHECK_VIEWS.map((view) => <Link key={view.key} href={view.href} aria-current={activeView === view.key ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center rounded-md px-4 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring ${activeView === view.key ? "bg-slate-950 text-white" : "bg-card text-muted-foreground shadow-card hover:text-foreground"}`}>{view.label}</Link>)}</nav>

    {activeView === "priority" && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-violet-100 px-4 py-3 text-sm text-violet-900"><span className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4" aria-hidden="true"/>Высокий и критический риск без решения</span><button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 font-semibold hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-ring" onClick={() => router.replace("/signals", {scroll: false})}><X className="h-4 w-4" aria-hidden="true"/>Сбросить</button></div>}

    <Card className="mb-4 p-4">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_auto]">
        <Filter label="Уровень приоритета" value={params.get("priority_level") ?? ""} options={["Низкий", "Средний", "Высокий", "Критический"]} onChange={(value) => setParam("priority_level", value)}/>
        <Filter label="Статус" value={params.get("status") ?? ""} options={["Не проверено", "На рассмотрении", "Подтверждён сигнал", "Сигнал не подтверждён", "Требуются дополнительные сведения", "Направлено на углублённую проверку", "Проверка завершена"]} onChange={(value) => setParam("status", value)}/>
        <Select aria-label="Период" value={params.get("period_months") ?? ""} onChange={(event) => setParam("period_months", event.target.value)}><option value="">Весь период</option><option value="1">Последний месяц</option><option value="3">Последние 3 месяца</option><option value="6">Последние 6 месяцев</option></Select>
        <Button variant="secondary" onClick={() => router.replace("/signals", {scroll: false})} disabled={!activeFilters.length}><RotateCcw className="h-4 w-4" aria-hidden="true"/>Сбросить все</Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-muted-foreground">Применено фильтров: {activeFilters.length}</span>{activeFilters.map((filter) => <button key={filter.key} type="button" onClick={() => setParam(filter.key, "")} className="inline-flex min-h-9 items-center gap-1 rounded-md bg-violet-50 px-3 text-xs font-semibold text-violet-800 focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Сбросить фильтр ${filter.label}`}><span>{filter.label}: {filter.value}</span><X className="h-3.5 w-3.5" aria-hidden="true"/></button>)}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3"><Select aria-label="Сортировка очереди" value={params.get("sort") ?? "priority"} onChange={(event) => setParam("sort", event.target.value)}><option value="priority">По приоритету</option><option value="risk">По оценке риска</option><option value="financial">По финансовой значимости</option><option value="date">По дате</option><option value="organization">По организации</option></Select><Button variant="secondary" disabled={!selectedSignals.length} onClick={exportSelected}><Download className="h-4 w-4" aria-hidden="true"/>Экспортировать ({selectedSignals.length})</Button></div>
      <details className="group mt-3 rounded-md bg-muted px-3 py-2"><summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring"><SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden="true"/>Дополнительные фильтры</summary><div className="grid gap-3 border-t pt-3 md:grid-cols-2 xl:grid-cols-5"><Filter label="Уровень риска" value={params.get("level") ?? ""} options={["Низкий", "Средний", "Высокий", "Критический"]} onChange={(value) => setParam("level", value)}/><Filter label="Тип отклонения" value={params.get("anomaly_type") ?? ""} options={state.data.anomaly_types} onChange={(value) => setParam("anomaly_type", value)}/><Filter label="Регион" value={params.get("region") ?? ""} options={["Астана", "Алматы", "Восточно-Казахстанская область", "Карагандинская область", "Шымкент"]} onChange={(value) => setParam("region", value)}/><Select aria-label="Финансовая значимость" value={params.get("financial_min") ?? ""} onChange={(event) => setParam("financial_min", event.target.value)}><option value="">Любая сумма</option><option value="100000">от 100 000 ₸</option><option value="500000">от 500 000 ₸</option><option value="1000000">от 1 000 000 ₸</option></Select><Select aria-label="Наличие экспертного решения" value={params.get("has_decision") ?? ""} onChange={(event) => setParam("has_decision", event.target.value)}><option value="">Любое решение</option><option value="false">Без решения</option><option value="true">Есть решение</option></Select></div></details>
    </Card>

    {state.data.items.length === 0 ? <Card><EmptyState title="По выбранным условиям сигналов нет" description="Измените фильтры или сбросьте их, чтобы вернуться ко всей очереди." action={<Button variant="secondary" onClick={() => router.replace("/signals")}>Сбросить все</Button>}/></Card> : <>
      <div className="space-y-3 lg:hidden" data-testid="signals-mobile-list">{state.data.items.map((signal) => <MobileSignalCard key={signal.id} signal={signal} selected={signal.id === previewId} onOpen={() => openPreview(signal.id)}/>)}</div>
      <Card className="hidden max-h-[70vh] overflow-hidden lg:block"><div className="h-full overflow-auto"><table className="w-full min-w-[1050px]"><thead className="sticky top-0 z-10 bg-slate-950 text-white"><tr><th className="table-cell"><label className="inline-flex h-10 w-10 items-center justify-center"><span className="sr-only">Выбрать все записи</span><input type="checkbox" className="h-4 w-4 accent-violet-600" checked={allPageSelected} onChange={togglePage}/></label></th><th className="table-cell">Приоритет</th><th className="table-cell">Медицинская организация</th><th className="table-cell">Медицинская услуга</th><th className="table-cell">Основная причина</th><th className="table-cell">Финансовая значимость</th><th className="table-cell">Статус</th><th className="table-cell">Дата</th></tr></thead><tbody className="divide-y">{state.data.items.map((signal) => <SignalRow key={signal.id} signal={signal} selected={signal.id === previewId} checked={selectedIds.includes(signal.id)} onToggle={() => toggleSelection(signal.id)} onOpen={() => openPreview(signal.id)}/>)}</tbody></table></div></Card>
    </>}

    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">{state.data.total} сигналов · выбрано {selectedSignals.length}</p><div className="flex items-center gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => setParam("page", String(page - 1))} aria-label="Предыдущая страница"><ChevronLeft className="h-4 w-4" aria-hidden="true"/></Button><span className="text-sm font-semibold">{page} / {Math.max(1, pages)}</span><Button variant="secondary" disabled={page >= pages} onClick={() => setParam("page", String(page + 1))} aria-label="Следующая страница"><ChevronRight className="h-4 w-4" aria-hidden="true"/></Button></div></div>

    {previewId && <SignalPreviewPanel signalId={previewId} previousId={adjacent.previousId} nextId={adjacent.nextId} onNavigate={openPreview} fullCardHref={fullCardHref} onOpenFull={() => sessionStorage.setItem(queueScrollKey(queueUrl), String(window.scrollY))} onClose={closePreview} onUpdated={(updated) => state.setData({...state.data!, items: state.data!.items.map((item) => item.id === updated.id ? {...item, status: updated.status} : item)})}/>} 
  </>;
}

function SignalRow({signal, selected, checked, onToggle, onOpen}: {signal: Signal; selected: boolean; checked: boolean; onToggle: () => void; onOpen: () => void}) {
  const activate = (event: React.KeyboardEvent<HTMLTableRowElement>) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(); } };
  return <tr role="button" tabIndex={0} aria-label={`Открыть быстрый просмотр сигнала ${signal.id}`} aria-pressed={selected} onClick={onOpen} onKeyDown={activate} className={`${selected ? "bg-violet-100 ring-1 ring-inset ring-violet-300" : "hover:bg-slate-50"} cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring`}><td className="table-cell"><label className="inline-flex h-10 w-10 items-center justify-center" onClick={(event) => event.stopPropagation()}><span className="sr-only">Выбрать сигнал {signal.id}</span><input type="checkbox" checked={checked} onChange={onToggle} className="h-4 w-4 accent-violet-600"/></label></td><td className="table-cell">{signal.priority_score != null && signal.priority_level ? <div><strong className="font-mono text-2xl tabular-nums">{signal.priority_score}</strong><div className="mt-1"><PriorityBadge level={signal.priority_level}/></div></div> : <span className="text-xs text-muted-foreground">Не рассчитан</span>}</td><td className="table-cell max-w-56"><Link href={`/organizations/${signal.organization_id}`} onClick={(event) => event.stopPropagation()} className="font-semibold text-foreground hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring">{signal.organization_name}</Link></td><td className="table-cell max-w-56 font-semibold text-foreground">{signal.service_name}</td><td className="table-cell max-w-64"><p className="line-clamp-2 text-sm leading-5 text-muted-foreground">{signal.primary_reason}</p></td><td className="table-cell whitespace-nowrap font-mono font-semibold tabular-nums">{money(signal.financial_significance)}</td><td className="table-cell"><StatusBadge status={signal.status}/></td><td className="table-cell whitespace-nowrap text-sm text-muted-foreground">{dateText(signal.date)}</td></tr>;
}

function MobileSignalCard({signal, selected, onOpen}: {signal: Signal; selected: boolean; onOpen: () => void}) {
  return <button type="button" onClick={onOpen} aria-pressed={selected} className={`block w-full rounded-lg text-left focus-visible:ring-2 focus-visible:ring-ring ${selected ? "ring-2 ring-violet-300" : ""}`}><Card className="p-4"><div className="flex items-start justify-between gap-3"><div>{signal.priority_score != null ? <p className="font-mono text-3xl font-bold tabular-nums">{signal.priority_score}<span className="ml-1 text-xs font-normal text-muted-foreground">из 100</span></p> : <p className="text-sm text-muted-foreground">Приоритет не рассчитан</p>}{signal.priority_level && <div className="mt-1"><PriorityBadge level={signal.priority_level}/></div>}</div><StatusBadge status={signal.status}/></div><p className="mt-3 font-semibold">{signal.service_name}</p><p className="mt-1 text-sm text-muted-foreground">{signal.organization_name}</p><div className="mt-3"><p className="text-xs text-muted-foreground">Финансовая значимость</p><p className="mt-1 font-mono font-bold tabular-nums">{money(signal.financial_significance)}</p></div><p className="mt-3 line-clamp-2 text-sm leading-5 text-muted-foreground">{signal.primary_reason}</p></Card></button>;
}

function Filter({label, value, options, onChange}: {label: string; value: string; options: string[]; onChange: (value: string) => void}) { return <label><span className="sr-only">{label}</span><Select className="w-full" value={value} onChange={(event) => onChange(event.target.value)}><option value="">{label}: все</option>{options.map((item) => <option key={item}>{item}</option>)}</Select></label>; }
