"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api";
import type { RecurringPattern } from "@/lib/types";
import { number as numberText } from "@/lib/utils";
import { useApi } from "@/hooks/use-api";
import { contextHref } from "@/lib/work-context";
import {
  Button,
  DataTableCell,
  DataTableRow,
  DataTableShell,
  DomainIndicator,
  EmptyState,
  FilterBar,
  FinancialValue,
  Input,
  MobileObjectCard,
  OverflowActions,
  PageSkeleton,
  Select,
} from "./foundation";
import { PatternTypeBadge } from "./pattern-badges";

const FILTER_LABELS: Record<string, string> = {
  importance: "Важность",
  stability: "Устойчивость",
  pattern_type: "Тип модели",
  organization_id: "Медицинская организация",
  status: "Статус оценки",
  period: "Период",
  financial_min: "Финансовая значимость от",
  financial_max: "Финансовая значимость до",
};

export function PatternsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const state = useApi(() => api.patterns(query), query);

  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const next = new URLSearchParams(query);
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in updates)) next.delete("page");
    const serialized = next.toString();
    router.replace(`/patterns${serialized ? `?${serialized}` : ""}`, { scroll: false });
  }, [query, router]);

  const activeFilters = useMemo(() => Object.keys(FILTER_LABELS).flatMap((key) => {
    const value = searchParams.get(key);
    return value ? [{ key, value, label: FILTER_LABELS[key] }] : [];
  }), [searchParams]);

  if (state.loading) return <PageSkeleton variant="list"/>;
  if (state.error || !state.data) return <EmptyState variant="error" title="Не удалось загрузить модели" description="Проверьте соединение и повторите попытку." action={<Button variant="secondary" onClick={() => void state.retry()}>Повторить</Button>}/>;

  const data = state.data;
  const totalPages = Math.max(1, Math.ceil(data.total / data.page_size));
  const returnTo = query ? `/patterns?${query}` : "/patterns";
  const orderedIds = data.items.map((pattern) => pattern.id);
  const patternHref = (id: number) => contextHref(`/patterns/${id}`, returnTo, orderedIds);

  const organizationLabel = (value: string) => data.organizations.find((item) => String(item.id) === value)?.label ?? value;
  const displayFilter = (filter: { key: string; value: string; label: string }) => `${filter.label}: ${filter.key === "organization_id" ? organizationLabel(filter.value) : filter.value}`;
  const sort = searchParams.get("sort") ?? "importance";
  const sortDirection = (key: string) => sort === key ? "descending" as const : undefined;
  const openPattern = (id: number) => router.push(patternHref(id));
  const columns = [
    { id: "importance", label: "Важность", sortable: true, sortDirection: sortDirection("importance"), onSort: () => updateParams({ sort: "importance" }), className: "w-[9.5rem]" },
    { id: "name", label: "Название модели", className: "w-[24%]" },
    { id: "type", label: "Тип", className: "hidden w-40 min-[1360px]:table-cell" },
    { id: "organization", label: "Организация", className: "w-[18%]" },
    { id: "financial", label: "Финансовая значимость", align: "right" as const, sortable: true, sortDirection: sortDirection("financial"), onSort: () => updateParams({ sort: "financial" }), className: "w-[10rem]" },
    { id: "stability", label: "Устойчивость", sortable: true, sortDirection: sortDirection("stability"), onSort: () => updateParams({ sort: "stability" }), className: "w-[11rem]" },
    { id: "status", label: "Статус", className: "w-[10rem]" },
    { id: "actions", label: "Действия", header: <span className="sr-only">Действия</span>, align: "right" as const, className: "hidden w-14 min-[1360px]:table-cell" },
  ];

  return <div className="min-w-0">
    <FilterBar
      className="mb-4"
      activeCount={activeFilters.length}
      activeFilters={activeFilters.map((filter) => ({ id: filter.key, label: displayFilter(filter), onRemove: () => updateParams({ [filter.key]: null }) }))}
      onResetAll={() => router.replace("/patterns", { scroll: false })}
      defaultAdvancedOpen={Boolean(searchParams.get("status") || searchParams.get("period") || searchParams.get("financial_min") || searchParams.get("financial_max"))}
      primary={<>
        <Filter label="Важность" value={searchParams.get("importance") ?? ""} options={["Низкий", "Средний", "Высокий", "Критический"]} onChange={(value) => updateParams({ importance: value || null })}/>
        <Filter label="Устойчивость" value={searchParams.get("stability") ?? ""} options={["Низкая", "Средняя", "Высокая", "Очень высокая"]} onChange={(value) => updateParams({ stability: value || null })}/>
        <Filter label="Тип модели" value={searchParams.get("pattern_type") ?? ""} options={data.pattern_types} onChange={(value) => updateParams({ pattern_type: value || null })}/>
        <Filter label="Медицинская организация" value={searchParams.get("organization_id") ?? ""} options={data.organizations.map((item) => ({ value: String(item.id), label: item.label }))} onChange={(value) => updateParams({ organization_id: value || null })}/>
      </>}
      advanced={<>
        <Filter label="Статус оценки" value={searchParams.get("status") ?? ""} options={["Не оценено", "Значимость подтверждена", "Отмечено как несущественное", "Требуются дополнительные сведения", "Направлено на углублённую проверку", "Оценка завершена"]} onChange={(value) => updateParams({ status: value || null })}/>
        <label><span className="sr-only">Период наблюдения</span><Input aria-label="Период наблюдения" type="month" value={searchParams.get("period") ?? ""} onChange={(event) => updateParams({ period: event.target.value || null })}/></label>
        <label><span className="sr-only">Финансовая значимость от</span><Input aria-label="Финансовая значимость от" type="text" inputMode="numeric" value={searchParams.get("financial_min") ?? ""} onChange={(event) => updateParams({ financial_min: event.target.value.replace(/\D/g, "") || null })} placeholder="Финансовая значимость от"/></label>
        <label><span className="sr-only">Финансовая значимость до</span><Input aria-label="Финансовая значимость до" type="text" inputMode="numeric" value={searchParams.get("financial_max") ?? ""} onChange={(event) => updateParams({ financial_max: event.target.value.replace(/\D/g, "") || null })} placeholder="Финансовая значимость до"/></label>
        <label><span className="sr-only">Сортировка моделей</span><Select aria-label="Сортировка моделей" value={sort} onChange={(event) => updateParams({ sort: event.target.value })}><option value="importance">По важности</option><option value="stability">По устойчивости</option><option value="financial">По финансовой значимости</option><option value="signals">По числу сигналов</option><option value="last_seen">По последнему появлению</option></Select></label>
      </>}
    />

    {data.items.length === 0 ? <EmptyState title="По выбранным условиям моделей нет" description={activeFilters.length ? "Измените фильтры или сбросьте их, чтобы вернуться ко всему списку." : "Для устойчивого вывода требуется несколько периодов наблюдений."} action={activeFilters.length ? <Button variant="secondary" onClick={() => router.replace("/patterns")}>Сбросить все</Button> : undefined}/> : <DataTableShell
      columns={columns}
      caption="Повторяющиеся модели"
      tableClassName="min-w-[58rem] table-fixed min-[1360px]:min-w-[66rem]"
      mobileContent={<div data-testid="patterns-mobile-list" className="space-y-3">{data.items.map((pattern) => <MobilePatternCard key={pattern.id} pattern={pattern} onOpen={() => openPattern(pattern.id)}/>)}</div>}
    >
      {data.items.map((pattern) => <PatternRow key={pattern.id} pattern={pattern} onOpen={() => openPattern(pattern.id)}/>)}
    </DataTableShell>}

    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-v2-text-secondary">Показано {numberText(data.items.length)} из {numberText(data.total)}</p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="icon" disabled={data.page <= 1} onClick={() => updateParams({ page: String(data.page - 1) })} aria-label="Предыдущая страница"><ChevronLeft className="h-4 w-4" aria-hidden="true"/></Button>
        <span className="v2-tabular min-w-16 text-center text-sm font-semibold">{data.page} / {totalPages}</span>
        <Button variant="secondary" size="icon" disabled={data.page >= totalPages} onClick={() => updateParams({ page: String(data.page + 1) })} aria-label="Следующая страница"><ChevronRight className="h-4 w-4" aria-hidden="true"/></Button>
      </div>
    </div>
  </div>;
}

function PatternRow({ pattern, onOpen }: { pattern: RecurringPattern; onOpen: () => void }) {
  const activate = (event: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };
  return <DataTableRow tabIndex={0} aria-label={`Открыть модель «${pattern.name}»`} onClick={onOpen} onKeyDown={activate} className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-v2-primary">
    <DataTableCell className="px-2"><DomainIndicator kind="importance" level={pattern.importance_level} value={pattern.importance_score} label={pattern.importance_level} compact/></DataTableCell>
    <DataTableCell clamp><p className="line-clamp-2 font-semibold leading-5 text-v2-text" title={pattern.name}>{pattern.name}</p><p className="mt-1 text-xs text-v2-text-secondary">{numberText(pattern.signal_count)} сигналов · {numberText(pattern.period_count)} периодов</p></DataTableCell>
    <DataTableCell className="hidden px-2 min-[1360px]:table-cell"><PatternTypeBadge label={pattern.pattern_type_label}/></DataTableCell>
    <DataTableCell clamp><p className="line-clamp-2 text-v2-text-secondary">{pattern.main_organization ?? "Несколько организаций"}</p></DataTableCell>
    <DataTableCell className="text-right"><FinancialValue value={pattern.financial_significance} compact className="justify-end"/></DataTableCell>
    <DataTableCell><DomainIndicator kind="stability" level={pattern.stability_level} value={pattern.stability_score}/></DataTableCell>
    <DataTableCell className="px-2"><DomainIndicator kind="reviewStatus" level={pattern.review_status}/></DataTableCell>
    <DataTableCell className="hidden px-1 text-right min-[1360px]:table-cell"><span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><OverflowActions iconOnly label={`Действия модели «${pattern.name}»`} items={[{ id: "open-pattern", label: "Открыть модель", icon: <ExternalLink className="h-4 w-4"/>, onSelect: onOpen }]}/></span></DataTableCell>
  </DataTableRow>;
}

function MobilePatternCard({ pattern, onOpen }: { pattern: RecurringPattern; onOpen: () => void }) {
  return <MobileObjectCard
    title={pattern.name}
    context={`${pattern.pattern_type_label} · ${pattern.main_organization ?? "Несколько организаций"}`}
    indicator={<DomainIndicator kind="importance" level={pattern.importance_level} value={pattern.importance_score} label={pattern.importance_level} compact/>}
    financial={<FinancialValue value={pattern.financial_significance} compact/>}
    status={<DomainIndicator kind="reviewStatus" level={pattern.review_status}/>}
    reason={`${numberText(pattern.signal_count)} сигналов · устойчивость ${pattern.stability_level.toLocaleLowerCase("ru-RU")} (${pattern.stability_score} из 100)`}
    onClick={onOpen}
  />;
}

type FilterOption = string | { value: string; label: string };

function Filter({ label, value, options, onChange }: { label: string; value: string; options: FilterOption[]; onChange: (value: string) => void }) {
  return <label><span className="sr-only">{label}</span><Select className="w-full" value={value} onChange={(event) => onChange(event.target.value)}><option value="">{label}: все</option>{options.map((option) => {
    const item = typeof option === "string" ? { value: option, label: option } : option;
    return <option key={item.value} value={item.value}>{item.label}</option>;
  })}</Select></label>;
}
