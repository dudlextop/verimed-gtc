"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  ListChecks,
  SearchCheck,
  ShieldAlert,
  WalletCards,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Signal } from "@/lib/types";
import { useApi } from "@/hooks/use-api";
import { useFileDownload } from "@/hooks/use-file-download";
import { selectionFilterSignature, useScopedSelection } from "@/hooks/use-scoped-selection";
import { dateText, money, number as numberText } from "@/lib/utils";
import { adjacentIds, contextHref, queueScrollKey } from "@/lib/work-context";
import {
  Button,
  Checkbox,
  DataTableCell,
  DataTableRow,
  DataTableShell,
  DomainIndicator,
  EmptyState,
  ExportAction,
  FilterBar,
  FinancialValue,
  InlineNotice,
  MetricCard,
  MetricStrip,
  MobileObjectCard,
  OverflowActions,
  PageHeader,
  PageSkeleton,
  Search,
  Select,
} from "./foundation";
import { SignalPreviewPanel } from "./signal-preview-panel";
import { PRIORITY_QUEUE_URL } from "./command-center";

const CHECK_VIEWS = [
  { key: "all", label: "Все сигналы", href: "/signals" },
  { key: "priority", label: "Приоритетные", href: PRIORITY_QUEUE_URL },
  { key: "without_decision", label: "Без решения", href: "/signals?has_decision=false&sort=priority" },
  { key: "in_progress", label: "На рассмотрении", href: "/signals?status=На%20рассмотрении&sort=priority" },
  { key: "completed", label: "Завершённые", href: "/signals?status=Проверка%20завершена&sort=date" },
] as const;

const FILTER_LABELS: Record<string, string> = {
  search: "Поиск",
  priority_level: "Приоритет",
  status: "Статус",
  period_months: "Период",
  level: "Риск",
  levels: "Риск",
  anomaly_type: "Тип отклонения",
  region: "Регион",
  financial_min: "Финансовая значимость",
  has_decision: "Решение",
  organization_id: "Организация",
};

type Notice = { tone: "info" | "success" | "danger"; message: string } | null;

export function SignalsView() {
  const router = useRouter();
  const params = useSearchParams();
  const paramsString = params.toString();
  const dataParams = useMemo(() => {
    const next = new URLSearchParams(paramsString);
    next.delete("signal");
    return next;
  }, [paramsString]);
  const query = dataParams.toString();
  const queueUrl = `/signals${query ? `?${query}` : ""}`;
  const state = useApi(() => api.signals(query), query);
  const [notice, setNotice] = useState<Notice>(null);
  const currentSearch = params.get("search") ?? "";

  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const next = new URLSearchParams(paramsString);
    next.delete("signal");
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
      if (key === "level") next.delete("levels");
    }
    if (!("page" in updates)) next.delete("page");
    const serialized = next.toString();
    router.replace(`/signals${serialized ? `?${serialized}` : ""}`, { scroll: false });
  }, [paramsString, router]);

  const notifySelectionCleared = useCallback((message: string) => {
    setNotice({ tone: "info", message });
  }, []);
  const selection = useScopedSelection(selectionFilterSignature(dataParams), notifySelectionCleared);
  const notifyDownload = useCallback((notification: { tone: "success" | "error"; message: string }) => {
    setNotice({ tone: notification.tone === "error" ? "danger" : "success", message: notification.message });
  }, []);
  const currentExport = useFileDownload(notifyDownload);
  const selectedExport = useFileDownload(notifyDownload);

  useEffect(() => {
    if (!state.data) return;
    const stored = sessionStorage.getItem(queueScrollKey(queueUrl));
    if (!stored) return;
    sessionStorage.removeItem(queueScrollKey(queueUrl));
    window.requestAnimationFrame(() => window.scrollTo({ top: Number(stored), behavior: "auto" }));
  }, [queueUrl, state.data]);

  const activeView = useMemo(() => {
    if (params.getAll("levels").length > 0) return "priority";
    if (params.get("status") === "На рассмотрении") return "in_progress";
    if (params.get("status") === "Проверка завершена") return "completed";
    if (params.get("has_decision") === "false") return "without_decision";
    return "all";
  }, [params]);

  const activeFilters = useMemo(() => {
    const result: { key: string; label: string; value: string }[] = [];
    for (const key of Object.keys(FILTER_LABELS)) {
      const values = params.getAll(key);
      if (!values.length) continue;
      const raw = values.join(", ");
      const display = key === "period_months"
        ? `${raw} мес.`
        : key === "has_decision"
          ? (raw === "false" ? "Без решения" : "Есть решение")
          : raw;
      result.push({ key, label: FILTER_LABELS[key], value: display });
    }
    return result;
  }, [params]);

  const exportParams = useMemo(() => {
    const next = new URLSearchParams(dataParams);
    next.delete("page");
    next.delete("page_size");
    return next.toString();
  }, [dataParams]);
  const exportCurrentSelection = useCallback(async () => {
    const result = await currentExport.run({
      path: `/exports/signals.csv${exportParams ? `?${exportParams}` : ""}`,
      fallbackFilename: "verimed-signals.csv",
    });
    if (!result) throw new Error(currentExport.error ?? "Не удалось экспортировать текущую выборку");
  }, [currentExport, exportParams]);
  const exportSelectedSignals = useCallback(async () => {
    const result = await selectedExport.run({
      path: "/exports/signals.csv",
      method: "POST",
      body: { signal_ids: selection.selectedIds },
      fallbackFilename: "verimed-selected-signals.csv",
    });
    if (!result) throw new Error(selectedExport.error ?? "Не удалось экспортировать выбранные сигналы");
  }, [selectedExport, selection.selectedIds]);

  const openPreview = useCallback((signalId: number) => {
    const next = new URLSearchParams(paramsString);
    next.set("signal", String(signalId));
    router.replace(`/signals?${next}`, { scroll: false });
  }, [paramsString, router]);
  const closePreview = useCallback(() => {
    const next = new URLSearchParams(paramsString);
    next.delete("signal");
    const serialized = next.toString();
    router.replace(`/signals${serialized ? `?${serialized}` : ""}`, { scroll: false });
  }, [paramsString, router]);
  const rememberQueuePosition = useCallback(() => {
    sessionStorage.setItem(queueScrollKey(queueUrl), String(window.scrollY));
  }, [queueUrl]);

  const mobilePageActions = [
    { id: "export-current", label: "Экспортировать текущую выборку", icon: <Download className="h-4 w-4" />, onSelect: exportCurrentSelection },
  ];

  const header = (
    <PageHeader
      eyebrow="Экспертная работа"
      title="Проверка"
      description="Приоритетная очередь медицинских услуг с объяснимыми причинами и контекстом для экспертного решения."
      secondaryActions={
        <>
          <div className="hidden sm:block">
            <ExportAction
              state={currentExport.state}
              scopeLabel="Текущая выборка"
              onAction={exportCurrentSelection}
            />
          </div>
          <div className="sm:hidden">
            <OverflowActions
              label="Действия очереди"
              compactOnMobile
              disabled={currentExport.state === "loading"}
              items={mobilePageActions}
              onActionError={(message) => setNotice({ tone: "danger", message })}
            />
          </div>
        </>
      }
    />
  );

  if (state.loading) return <div>{header}<QueueViews activeView={activeView}/><PageSkeleton variant="list"/></div>;
  if (state.error || !state.data) return <div>{header}<QueueViews activeView={activeView}/><EmptyState variant="error" title="Не удалось загрузить очередь" description="Проверьте соединение и повторите попытку." action={<Button variant="secondary" onClick={() => void state.retry()}>Повторить</Button>}/></div>;

  const page = Number(params.get("page") ?? state.data.page ?? 1);
  const pages = Math.ceil(state.data.total / state.data.page_size);
  const previewId = Number(params.get("signal") ?? 0) || null;
  const pageIds = state.data.items.map((item) => item.id);
  const adjacent = previewId ? adjacentIds(pageIds, previewId) : { previousId: null, nextId: null };
  const previewPosition = previewId ? pageIds.indexOf(previewId) + 1 : 0;
  const fullCardHref = previewId ? contextHref(`/signals/${previewId}`, queueUrl, pageIds) : "/signals";
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selection.selectedIds.includes(id));
  const somePageSelected = pageIds.some((id) => selection.selectedIds.includes(id)) && !allPageSelected;
  const highPriorityOnPage = state.data.items.filter((item) => item.priority_level === "Высокий" || item.priority_level === "Критический").length;
  const unreviewedOnPage = state.data.items.filter((item) => item.status === "Не проверено").length;
  const pageFinancial = state.data.items.reduce((sum, item) => sum + Number(item.financial_significance ?? 0), 0);
  const sort = params.get("sort") ?? "priority";
  const direction = params.get("direction") ?? (sort === "organization" ? "asc" : "desc");
  const sortDirection = (key: string) => sort === key ? (direction === "asc" ? "ascending" as const : "descending" as const) : undefined;
  const changeSort = (key: string) => updateParams({ sort: key, direction: sort === key && direction === "desc" ? "asc" : "desc" });

  const selectAllRef = (node: HTMLInputElement | null) => {
    if (node) node.indeterminate = somePageSelected;
  };
  const columns = [
    {
      id: "selection",
      label: "Выбор",
      header: <Checkbox ref={selectAllRef} aria-label="Выбрать сигналы на текущей странице" checked={allPageSelected} onChange={() => selection.setPageSelection(pageIds, !allPageSelected)}/>,
      className: "w-12",
    },
    { id: "priority", label: "Приоритет", sortable: true, sortDirection: sortDirection("priority"), onSort: () => changeSort("priority"), className: "w-40" },
    { id: "signal", label: "Сигнал / услуга", className: "min-w-36" },
    { id: "organization", label: "Медицинская организация", sortable: true, sortDirection: sortDirection("organization"), onSort: () => changeSort("organization"), className: "min-w-36" },
    { id: "reason", label: "Основная причина", className: "min-w-36" },
    { id: "financial", label: "Финансовая значимость", align: "right" as const, sortable: true, sortDirection: sortDirection("financial"), onSort: () => changeSort("financial"), className: "min-w-32" },
    { id: "status", label: "Статус", className: "min-w-32" },
    { id: "actions", label: "Действия", align: "right" as const, className: "w-20" },
  ];

  return <div className="min-w-0">
    {header}
    <QueueViews activeView={activeView}/>

    {activeView === "priority" && (
      <InlineNotice
        className="mb-4"
        tone="info"
        title="Приоритетная очередь"
        description="Показаны сигналы высокого и критического риска без экспертного решения."
        action={<Button variant="text" size="compact" onClick={() => router.replace("/signals", { scroll: false })}>Сбросить</Button>}
      />
    )}

    {notice && (
      <InlineNotice
        className="mb-4"
        tone={notice.tone}
        title={notice.message}
        action={<Button variant="text" size="compact" onClick={() => setNotice(null)}>Закрыть</Button>}
      />
    )}

    <MetricStrip className="mb-4 max-sm:grid-cols-2 max-sm:[&>div]:p-3 max-sm:[&>div:nth-child(odd)]:border-r max-sm:[&>div:nth-last-child(-n+2)]:border-b-0" label="Показатели текущей очереди">
      <MetricCard label="Найдено сигналов" value={numberText(state.data.total)} icon={SearchCheck} prominent/>
      <MetricCard label="Высокий и критический приоритет" value={numberText(highPriorityOnPage)} detail="на текущей странице" icon={ShieldAlert} tone="priority"/>
      <MetricCard className="max-sm:[&>div>span]:hidden" label="Финансовая значимость" value={money(pageFinancial, true)} detail="на текущей странице" icon={WalletCards} tone="finance"/>
      <MetricCard label="Без решения" value={numberText(unreviewedOnPage)} detail="на текущей странице" icon={ListChecks}/>
    </MetricStrip>

    <FilterBar
      className="mb-4"
      activeCount={activeFilters.length}
      activeFilters={activeFilters.map((filter) => ({ id: filter.key, label: `${filter.label}: ${filter.value}`, onRemove: () => updateParams({ [filter.key]: null }) }))}
      onResetAll={() => router.replace("/signals", { scroll: false })}
      primary={
        <>
          <DebouncedSearch key={currentSearch} value={currentSearch} onChange={(value) => updateParams({ search: value || null })}/>
          <Filter label="Уровень приоритета" value={params.get("priority_level") ?? ""} options={["Низкий", "Средний", "Высокий", "Критический"]} onChange={(value) => updateParams({ priority_level: value || null })}/>
          <Filter label="Статус" value={params.get("status") ?? ""} options={["Не проверено", "На рассмотрении", "Подтверждён сигнал", "Сигнал не подтверждён", "Требуются дополнительные сведения", "Направлено на углублённую проверку", "Проверка завершена"]} onChange={(value) => updateParams({ status: value || null })}/>
          <label><span className="sr-only">Период</span><Select aria-label="Период" value={params.get("period_months") ?? ""} onChange={(event) => updateParams({ period_months: event.target.value || null })}><option value="">Весь период</option><option value="1">Последний месяц</option><option value="3">Последние 3 месяца</option><option value="6">Последние 6 месяцев</option></Select></label>
        </>
      }
      advanced={
        <>
          <Filter label="Уровень риска" value={params.get("level") ?? ""} options={["Низкий", "Средний", "Высокий", "Критический"]} onChange={(value) => updateParams({ level: value || null })}/>
          <Filter label="Тип отклонения" value={params.get("anomaly_type") ?? ""} options={state.data.anomaly_types} onChange={(value) => updateParams({ anomaly_type: value || null })}/>
          <Filter label="Регион" value={params.get("region") ?? ""} options={["Астана", "Алматы", "Восточно-Казахстанская область", "Карагандинская область", "Шымкент"]} onChange={(value) => updateParams({ region: value || null })}/>
          <label><span className="sr-only">Финансовая значимость</span><Select aria-label="Финансовая значимость" value={params.get("financial_min") ?? ""} onChange={(event) => updateParams({ financial_min: event.target.value || null })}><option value="">Любая сумма</option><option value="100000">от 100 000 ₸</option><option value="500000">от 500 000 ₸</option><option value="1000000">от 1 000 000 ₸</option></Select></label>
          <label><span className="sr-only">Наличие экспертного решения</span><Select aria-label="Наличие экспертного решения" value={params.get("has_decision") ?? ""} onChange={(event) => updateParams({ has_decision: event.target.value || null })}><option value="">Любое решение</option><option value="false">Без решения</option><option value="true">Есть решение</option></Select></label>
        </>
      }
    />

    <div className="mb-4 flex items-center justify-end gap-2"><span className="text-xs font-semibold text-v2-text-secondary">Сортировка</span><label><span className="sr-only">Сортировка очереди</span><Select aria-label="Сортировка очереди" className="w-full sm:w-auto" value={sort} onChange={(event) => updateParams({ sort: event.target.value, direction: event.target.value === "organization" ? "asc" : "desc" })}><option value="priority">По приоритету</option><option value="risk">По оценке риска</option><option value="financial">По финансовой значимости</option><option value="date">По дате</option><option value="organization">По организации</option></Select></label></div>

    {selection.selectedIds.length > 0 && <section aria-label="Действия с выбранными сигналами" className="mb-4 flex flex-col gap-3 rounded-v2-section border border-v2-primary/25 bg-v2-selected p-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-v2-control bg-v2-surface text-v2-primary"><ListChecks className="h-5 w-5" aria-hidden="true"/></span><div><p className="text-sm font-bold text-v2-text">Выбрано: {selection.selectedIds.length}</p><p className="text-xs text-v2-text-secondary">Выбор сохраняется при переходе между страницами этой выборки.</p></div></div><div className="flex flex-wrap items-start gap-2"><ExportAction state={selectedExport.state} scopeLabel={`Выбрано: ${selection.selectedIds.length}`} onAction={exportSelectedSignals}/><Button variant="text" size="compact" onClick={selection.clear}>Снять выбор</Button></div></section>}

    {state.data.items.length === 0 ? <EmptyState title="По выбранным условиям сигналов нет" description="Измените фильтры или сбросьте их, чтобы вернуться ко всей очереди." action={activeFilters.length ? <Button variant="secondary" onClick={() => router.replace("/signals")}>Сбросить все</Button> : undefined}/> : <DataTableShell
      columns={columns}
      caption="Сигналы для экспертной проверки"
      tableClassName="min-w-[57rem] table-fixed"
      mobileContent={<div data-testid="signals-mobile-list" className="space-y-3">{state.data.items.map((signal) => <MobileSignalCard key={signal.id} signal={signal} previewSelected={signal.id === previewId} checked={selection.selectedIds.includes(signal.id)} onToggle={() => selection.toggle(signal.id)} onOpen={() => openPreview(signal.id)}/>)}</div>}
    >
      {state.data.items.map((signal) => {
        const checked = selection.selectedIds.includes(signal.id);
        const rowCardHref = contextHref(`/signals/${signal.id}`, queueUrl, pageIds);
        return <SignalRow
          key={signal.id}
          signal={signal}
          selected={signal.id === previewId || checked}
          checked={checked}
          onToggle={() => selection.toggle(signal.id)}
          onOpen={() => openPreview(signal.id)}
          onOpenCard={() => { rememberQueuePosition(); router.push(rowCardHref); }}
          onOpenOrganization={() => router.push(`/organizations/${signal.organization_id}`)}
        />;
      })}
    </DataTableShell>}

    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-v2-text-secondary">{numberText(state.data.total)} сигналов · выбрано {selection.selectedIds.length}</p><div className="flex items-center gap-2"><Button variant="secondary" size="icon" disabled={page <= 1} onClick={() => updateParams({ page: String(page - 1) })} aria-label="Предыдущая страница"><ChevronLeft className="h-4 w-4" aria-hidden="true"/></Button><span className="v2-tabular min-w-16 text-center text-sm font-semibold">{page} / {Math.max(1, pages)}</span><Button variant="secondary" size="icon" disabled={page >= pages} onClick={() => updateParams({ page: String(page + 1) })} aria-label="Следующая страница"><ChevronRight className="h-4 w-4" aria-hidden="true"/></Button></div></div>

    {previewId && <SignalPreviewPanel
      signalId={previewId}
      previousId={adjacent.previousId}
      nextId={adjacent.nextId}
      position={previewPosition > 0 ? previewPosition : undefined}
      queueSize={pageIds.length}
      onNavigate={openPreview}
      fullCardHref={fullCardHref}
      onOpenFull={rememberQueuePosition}
      onClose={closePreview}
      onUpdated={(updated) => state.setData({ ...state.data!, items: state.data!.items.map((item) => item.id === updated.id ? { ...item, status: updated.status } : item) })}
    />}
  </div>;
}

function QueueViews({ activeView }: { activeView: string }) {
  return <nav aria-label="Представления раздела Проверка" className="mb-4 overflow-x-auto border-b border-v2-border"><div className="flex min-w-max gap-1">{CHECK_VIEWS.map((view) => <Link key={view.key} href={view.href} aria-current={activeView === view.key ? "page" : undefined} className={`relative inline-flex min-h-11 items-center rounded-t-v2-control px-4 text-sm font-semibold transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary motion-reduce:transition-none ${activeView === view.key ? "bg-v2-selected text-v2-primary after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-v2-primary" : "text-v2-text-secondary hover:bg-v2-surface-soft hover:text-v2-text"}`}>{view.label}</Link>)}</div></nav>;
}

function SignalRow({ signal, selected, checked, onToggle, onOpen, onOpenCard, onOpenOrganization }: { signal: Signal; selected: boolean; checked: boolean; onToggle: () => void; onOpen: () => void; onOpenCard: () => void; onOpenOrganization: () => void }) {
  const activate = (event: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };
  return <DataTableRow tabIndex={0} selected={selected} aria-label={`Открыть быстрый просмотр сигнала ${signal.id}`} onClick={onOpen} onKeyDown={activate} className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-v2-primary">
    <DataTableCell><span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><Checkbox aria-label={`Выбрать сигнал ${signal.id}`} checked={checked} onChange={onToggle}/></span></DataTableCell>
    <DataTableCell className="px-2">{signal.priority_score != null && signal.priority_level ? <DomainIndicator kind="priority" level={signal.priority_level} value={signal.priority_score} compact/> : <span className="text-xs text-v2-text-muted">Не рассчитан</span>}</DataTableCell>
    <DataTableCell clamp><p className="font-semibold text-v2-text">{signal.service_name}</p><p className="mt-1 text-xs text-v2-text-secondary">Сигнал № {signal.id} · {dateText(signal.date)}</p></DataTableCell>
    <DataTableCell clamp><p className="font-medium text-v2-text">{signal.organization_name}</p><p className="mt-1 text-xs text-v2-text-secondary">{signal.region}</p></DataTableCell>
    <DataTableCell clamp><span className="leading-5 text-v2-text-secondary">{signal.primary_reason}</span></DataTableCell>
    <DataTableCell className="text-right"><FinancialValue value={signal.financial_significance ?? "—"} compact className="justify-end"/></DataTableCell>
    <DataTableCell><DomainIndicator kind="reviewStatus" level={signal.status}/></DataTableCell>
    <DataTableCell className="text-right"><span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><OverflowActions iconOnly label={`Действия сигнала ${signal.id}`} items={[{ id: "open-card", label: "Открыть полную карточку", icon: <ExternalLink className="h-4 w-4"/>, onSelect: onOpenCard }, { id: "open-organization", label: "Открыть организацию", icon: <ArrowRight className="h-4 w-4"/>, onSelect: onOpenOrganization }]}/></span></DataTableCell>
  </DataTableRow>;
}

function MobileSignalCard({ signal, previewSelected, checked, onToggle, onOpen }: { signal: Signal; previewSelected: boolean; checked: boolean; onToggle: () => void; onOpen: () => void }) {
  return <div className="relative min-w-0"><MobileObjectCard
    title={signal.service_name}
    context={signal.organization_name}
    indicator={signal.priority_score != null && signal.priority_level ? <DomainIndicator kind="priority" level={signal.priority_level} value={signal.priority_score} compact/> : undefined}
    financial={<FinancialValue value={signal.financial_significance ?? "—"} compact/>}
    status={<DomainIndicator kind="reviewStatus" level={signal.status}/>} reason={signal.primary_reason}
    selected={previewSelected || checked}
    onClick={onOpen}
    className="pr-14"
  /><span className="absolute right-2.5 top-2.5 z-10 rounded-v2-control bg-v2-surface"><Checkbox aria-label={`Выбрать сигнал ${signal.id} в мобильном списке`} checked={checked} onChange={onToggle}/></span></div>;
}

function Filter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label><span className="sr-only">{label}</span><Select className="w-full" value={value} onChange={(event) => onChange(event.target.value)}><option value="">{label}: все</option>{options.map((item) => <option key={item}>{item}</option>)}</Select></label>;
}

function DebouncedSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    const normalized = draft.trim();
    if (normalized === value) return;
    const timer = window.setTimeout(() => onChange(normalized), 320);
    return () => window.clearTimeout(timer);
  }, [draft, onChange, value]);
  return <label className="sm:col-span-2 xl:col-span-1"><span className="sr-only">Поиск по очереди</span><Search value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Организация, услуга или причина" aria-label="Поиск по очереди"/></label>;
}
