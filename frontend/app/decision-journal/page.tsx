"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  History,
  X,
} from "lucide-react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { DecisionEvent } from "@/lib/types";
import { useApi } from "@/hooks/use-api";
import { dateTimeText, number } from "@/lib/utils";
import {
  Button,
  DataPanel,
  DataTableCell,
  DataTableRow,
  DataTableShell,
  DomainIndicator,
  EmptyState,
  FilterBar,
  InlineNotice,
  Input,
  PageHeader,
  PageSkeleton,
  Search,
  Select,
} from "@/components/foundation";

const FILTER_LABELS: Record<string, string> = {
  search: "Поиск",
  entity_type: "Тип объекта",
  decision_status: "Решение",
  object_type: "Тип сигнала или модели",
  action_type: "Действие",
  reviewer: "Специалист",
  organization_id: "Медицинская организация",
  analysis_run_id: "Запуск анализа",
  date_from: "Период с",
  date_to: "Период по",
};

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export default function DecisionJournalPage() {
  return (
    <Suspense fallback={<div className="page-shell"><PageSkeleton variant="journal" /></div>}>
      <DecisionJournalContent />
    </Suspense>
  );
}

function DecisionJournalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const apiQuery = withJournalPageSize(query);
  const journal = useApi(() => api.decisionJournal(apiQuery), apiQuery);
  const integrity = useApi(api.journalIntegrity);
  const [selected, setSelected] = useState<DecisionEvent | null>(null);

  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const next = new URLSearchParams(query);
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in updates)) next.delete("page");
    if (!next.has("page_size")) next.set("page_size", "50");
    const serialized = next.toString();
    router.replace(`/decision-journal${serialized ? `?${serialized}` : ""}`, { scroll: false });
  }, [query, router]);

  const header = (
    <PageHeader
      eyebrow="Экспертный контур"
      title="Журнал решений"
      description="Последовательная история экспертных действий. Записи доступны только для просмотра."
    />
  );

  if (journal.loading || integrity.loading) {
    return <div className="page-shell">{header}<PageSkeleton variant="journal" /></div>;
  }
  const error = journal.error || integrity.error;
  if (error || !journal.data || !integrity.data) {
    return (
      <div className="page-shell">
        {header}
        <EmptyState
          variant="error"
          title="Не удалось загрузить журнал решений"
          description="Проверьте соединение и повторите попытку."
          action={<Button variant="secondary" onClick={() => { void journal.retry(); void integrity.retry(); }}>Повторить</Button>}
        />
      </div>
    );
  }

  const data = journal.data;
  const pageCount = Math.max(1, Math.ceil(data.total / data.page_size));
  const activeFilters = Object.keys(FILTER_LABELS).flatMap((key) => {
    const value = searchParams.get(key);
    if (!value) return [];
    const display = key === "organization_id"
      ? data.organizations.find((item) => String(item.id) === value)?.label ?? value
      : key === "object_type"
        ? data.object_types.find((item) => item.value === value)?.label ?? value
        : value;
    return [{ id: key, label: `${FILTER_LABELS[key]}: ${display}`, onRemove: () => updateParams({ [key]: null }) }];
  });

  return (
    <div className="page-shell" data-testid="decision-journal">
      {header}
      <InlineNotice
        className="mb-4"
        tone={integrity.data.is_valid ? "success" : "warning"}
        title={integrity.data.is_valid ? "Целостность истории проверена" : "История требует дополнительной проверки"}
        description={integrity.data.is_valid
          ? `Проверено событий: ${number(integrity.data.checked_events)}. Записи хранятся последовательно и доступны только для просмотра.`
          : integrity.data.message}
      />

      <FilterBar
        className="mb-5"
        primaryClassName="sm:grid-cols-3 xl:grid-cols-3"
        activeFilters={activeFilters}
        activeCount={activeFilters.length}
        onResetAll={() => router.replace("/decision-journal?page_size=50", { scroll: false })}
        defaultAdvancedOpen={Boolean(searchParams.get("action_type") || searchParams.get("reviewer") || searchParams.get("organization_id") || searchParams.get("object_type") || searchParams.get("analysis_run_id") || searchParams.get("date_from") || searchParams.get("date_to"))}
        primary={<>
          <JournalSearch value={searchParams.get("search") ?? ""} onChange={(value) => updateParams({ search: value || null })} />
          <label>
            <span className="sr-only">Тип объекта</span>
            <Select aria-label="Тип объекта" value={searchParams.get("entity_type") ?? ""} onChange={(event) => updateParams({ entity_type: event.target.value || null })}>
              <option value="">Все объекты</option>
              <option value="signal">Сигналы</option>
              <option value="pattern">Повторяющиеся модели</option>
            </Select>
          </label>
          <label>
            <span className="sr-only">Решение</span>
            <Select aria-label="Решение" value={searchParams.get("decision_status") ?? ""} onChange={(event) => updateParams({ decision_status: event.target.value || null })}>
              <option value="">Все решения</option>
              {data.decision_statuses.map((item) => <option key={item}>{item}</option>)}
            </Select>
          </label>
        </>}
        advanced={<>
          <JournalSelect label="Тип сигнала или модели" value={searchParams.get("object_type") ?? ""} onChange={(value) => updateParams({ object_type: value || null })} options={data.object_types} />
          <JournalSelect label="Действие" value={searchParams.get("action_type") ?? ""} onChange={(value) => updateParams({ action_type: value || null })} options={data.actions.map((item) => ({ value: item, label: item }))} />
          <JournalSelect label="Специалист" value={searchParams.get("reviewer") ?? ""} onChange={(value) => updateParams({ reviewer: value || null })} options={data.reviewers.map((item) => ({ value: item, label: item }))} />
          <JournalSelect label="Медицинская организация" value={searchParams.get("organization_id") ?? ""} onChange={(value) => updateParams({ organization_id: value || null })} options={data.organizations.map((item) => ({ value: String(item.id), label: item.label }))} />
          <JournalSelect label="Запуск анализа" value={searchParams.get("analysis_run_id") ?? ""} onChange={(value) => updateParams({ analysis_run_id: value || null })} options={data.analysis_runs.map((item) => ({ value: String(item), label: `Запуск № ${item}` }))} />
          <label className="text-xs font-semibold text-v2-text-secondary">Период с<Input aria-label="Период с" type="date" className="mt-1" value={searchParams.get("date_from") ?? ""} onChange={(event) => updateParams({ date_from: event.target.value || null })} /></label>
          <label className="text-xs font-semibold text-v2-text-secondary">Период по<Input aria-label="Период по" type="date" className="mt-1" value={searchParams.get("date_to") ?? ""} onChange={(event) => updateParams({ date_to: event.target.value || null })} /></label>
        </>}
      />

      {data.items.length ? (
        <>
          <DataTableShell
            columns={[
              { id: "event", label: "Событие", className: "w-[18%]" },
              { id: "object", label: "Объект", className: "w-[24%]" },
              { id: "reviewer", label: "Специалист", className: "w-[16%]" },
              { id: "decision", label: "Решение", className: "w-[19%]" },
              { id: "date", label: "Дата", className: "w-[14%]" },
              { id: "status", label: "Статус", className: "w-[9%]" },
            ]}
            caption="Журнал экспертных решений"
            tableClassName="min-w-[58rem] table-fixed"
            mobileContent={<div data-testid="decision-journal-mobile-list" className="space-y-3">{data.items.map((event) => <JournalEventCard key={event.id} event={event} onOpen={() => setSelected(event)} />)}</div>}
          >
            {data.items.map((event) => <JournalEventRow key={event.id} event={event} onOpen={() => setSelected(event)} />)}
          </DataTableShell>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-v2-text-secondary">Показано {number(data.items.length)} из {number(data.total)}</p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="icon" disabled={data.page <= 1} onClick={() => updateParams({ page: String(data.page - 1) })} aria-label="Предыдущая страница"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></Button>
              <span className="v2-tabular min-w-16 text-center text-sm font-semibold">{data.page} / {pageCount}</span>
              <Button variant="secondary" size="icon" disabled={data.page >= pageCount} onClick={() => updateParams({ page: String(data.page + 1) })} aria-label="Следующая страница"><ChevronRight className="h-4 w-4" aria-hidden="true" /></Button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          variant="history"
          title="Экспертные решения пока не зафиксированы"
          description={activeFilters.length ? "Измените или сбросьте фильтры, чтобы проверить другие события." : "История появится после первого экспертного решения."}
          action={activeFilters.length
            ? <Button variant="secondary" onClick={() => router.replace("/decision-journal?page_size=50")}>Сбросить фильтры</Button>
            : <Button asChild><Link href="/signals">Перейти к проверке</Link></Button>}
        />
      )}

      {selected && <DecisionEventPanel event={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function withJournalPageSize(query: string) {
  const value = new URLSearchParams(query);
  if (!value.has("page_size")) value.set("page_size", "50");
  return value.toString();
}

function JournalSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setDraft(value));
    return () => window.cancelAnimationFrame(frame);
  }, [value]);
  useEffect(() => {
    if (draft.trim() === value) return;
    const timer = window.setTimeout(() => onChange(draft.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [draft, onChange, value]);
  return <label><span className="sr-only">Поиск по журналу</span><Search aria-label="Поиск по журналу" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Поиск по комментариям" /></label>;
}

function JournalSelect({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <label><span className="sr-only">{label}</span><Select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}><option value="">{label}: все</option>{options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></label>;
}

function objectName(event: DecisionEvent) {
  return String(event.metadata.object_name ?? (event.entity_type === "signal" ? "Сигнал" : "Повторяющаяся модель"));
}

function organizationName(event: DecisionEvent) {
  return String(event.metadata.organization_name ?? "Организация не указана");
}

function JournalEventRow({ event, onOpen }: { event: DecisionEvent; onOpen: () => void }) {
  const activate = (keyboardEvent: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
      keyboardEvent.preventDefault();
      onOpen();
    }
  };
  return (
    <DataTableRow
      tabIndex={0}
      role="button"
      aria-label={`Открыть событие ${event.id}`}
      onClick={onOpen}
      onKeyDown={activate}
      className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-v2-primary"
    >
      <DataTableCell clamp><p className="font-semibold text-v2-text">{event.action_type}</p><p className="mt-1 text-xs text-v2-text-secondary">{event.entity_type === "signal" ? "Сигнал" : "Повторяющаяся модель"}</p></DataTableCell>
      <DataTableCell clamp><p className="font-semibold text-v2-text">{objectName(event)}</p><p className="mt-1 line-clamp-1 text-xs text-v2-text-secondary">{organizationName(event)}</p></DataTableCell>
      <DataTableCell clamp>{event.reviewer_display_name}</DataTableCell>
      <DataTableCell><DomainIndicator kind="reviewStatus" level={event.decision_status} /></DataTableCell>
      <DataTableCell className="v2-tabular whitespace-nowrap text-v2-text-secondary">{dateTimeText(event.created_at)}</DataTableCell>
      <DataTableCell><span className="inline-flex items-center gap-1.5 text-xs font-semibold text-v2-text-secondary">{event.object_present ? <CheckCircle2 className="h-4 w-4 text-v2-success-text" aria-hidden="true" /> : <History className="h-4 w-4 text-v2-warning-text" aria-hidden="true" />}{event.object_present ? "Доступен" : "История"}</span></DataTableCell>
    </DataTableRow>
  );
}

function JournalEventCard({ event, onOpen }: { event: DecisionEvent; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Открыть событие ${event.id}`}
      className="block min-h-11 w-full rounded-v2-card border border-v2-border bg-v2-surface p-4 text-left transition-[background-color,border-color] duration-100 hover:border-v2-primary hover:bg-v2-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary motion-reduce:transition-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 font-semibold text-v2-text">{objectName(event)}</p>
          <p className="mt-1 line-clamp-1 text-sm text-v2-text-secondary">{event.action_type}</p>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-v2-primary" aria-hidden="true" />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-v2-border pt-3">
        <DomainIndicator kind="reviewStatus" level={event.decision_status} />
        <span className="v2-tabular text-xs text-v2-text-secondary">{dateTimeText(event.created_at)}</span>
      </div>
      <p className="mt-3 text-xs text-v2-text-secondary">{event.reviewer_display_name} · {organizationName(event)}</p>
    </button>
  );
}

function DecisionEventPanel({ event, onClose }: { event: DecisionEvent; onClose: () => void }) {
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("button")?.focus());
    const handleKeyboard = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") {
        keyboardEvent.preventDefault();
        onClose();
        return;
      }
      if (keyboardEvent.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (keyboardEvent.shiftKey && document.activeElement === first) {
        keyboardEvent.preventDefault();
        last?.focus();
      } else if (!keyboardEvent.shiftKey && document.activeElement === last) {
        keyboardEvent.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyboard);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyboard);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  const href = event.current_entity_id ? `/${event.entity_type === "signal" ? "signals" : "patterns"}/${event.current_entity_id}` : null;
  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-[var(--v2-overlay-scrim)]" aria-hidden="true" onMouseDown={onClose} />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-title"
        className="absolute inset-y-0 right-0 w-full max-w-[32rem] overflow-y-auto border-l border-v2-border bg-v2-surface p-5 shadow-v2-panel sm:p-6"
      >
        <div className="flex items-start justify-between gap-4 border-b border-v2-border pb-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-v2-primary">Событие журнала</p>
            <h2 id="event-title" className="mt-2 text-xl font-bold tracking-[-0.02em] text-v2-text">{objectName(event)}</h2>
            <p className="mt-2 text-sm text-v2-text-secondary">{organizationName(event)}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть"><X className="h-5 w-5" aria-hidden="true" /></Button>
        </div>

        <DataPanel className="mt-5" nested>
          <dl className="grid gap-4 sm:grid-cols-2">
            <EventFact label="Что произошло" value={event.action_type} />
            <EventFact label="Решение" value={event.decision_status} />
            <EventFact label="Специалист" value={event.reviewer_display_name} />
            <EventFact label="Дата" value={dateTimeText(event.created_at)} />
          </dl>
        </DataPanel>

        {event.reason_code && <div className="mt-5"><p className="text-xs font-semibold text-v2-text-secondary">Основание решения</p><p className="mt-2 text-sm leading-6 text-v2-text">{event.reason_code}</p></div>}
        {event.comment && <div className="mt-5 rounded-v2-card bg-v2-surface-soft p-4"><p className="text-xs font-semibold text-v2-text-secondary">Комментарий</p><p className="mt-2 text-sm leading-6 text-v2-text">{event.comment}</p></div>}
        {event.supersedes_event_id && <InlineNotice className="mt-5" title="Решение уточняет предыдущую запись" description="История сохранена последовательно без изменения ранее зафиксированного события." />}
        {!event.object_present && <InlineNotice className="mt-5" tone="warning" title="Объект отсутствует в текущем расчёте" description="Его экспертная история сохранена в журнале." />}

        {href && <Button asChild className="mt-6 w-full"><Link href={href}>Перейти к объекту<ExternalLink className="h-4 w-4" aria-hidden="true" /></Link></Button>}
      </aside>
    </div>
  );
}

function EventFact({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold text-v2-text-secondary">{label}</dt><dd className="mt-1 text-sm font-semibold leading-5 text-v2-text">{value}</dd></div>;
}
