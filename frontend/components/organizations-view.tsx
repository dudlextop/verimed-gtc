"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileSearch,
  Landmark,
  SearchCheck,
  ShieldAlert,
  WalletCards,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Organization } from "@/lib/types";
import { useApi } from "@/hooks/use-api";
import { useFileDownload } from "@/hooks/use-file-download";
import { money, number as numberText } from "@/lib/utils";
import {
  Button,
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

const FILTER_LABELS: Record<string, string> = {
  search: "Поиск",
  region: "Регион",
  organization_type: "Тип организации",
  risk_level: "Уровень риска",
  status: "Статус проверки",
};

type Notice = { tone: "success" | "danger"; message: string } | null;

export function OrganizationsView() {
  const router = useRouter();
  const params = useSearchParams();
  const paramsString = params.toString();
  const state = useApi(() => api.organizations(paramsString), paramsString);
  const [notice, setNotice] = useState<Notice>(null);
  const currentSearch = params.get("search") ?? "";

  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const next = new URLSearchParams(paramsString);
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in updates)) next.delete("page");
    const serialized = next.toString();
    router.replace(`/organizations${serialized ? `?${serialized}` : ""}`, { scroll: false });
  }, [paramsString, router]);

  const activeFilters = useMemo(() => Object.keys(FILTER_LABELS).flatMap((key) => {
    const value = params.get(key);
    return value ? [{ key, value, label: FILTER_LABELS[key] }] : [];
  }), [params]);

  const exportParams = useMemo(() => {
    const next = new URLSearchParams(paramsString);
    next.delete("page");
    next.delete("page_size");
    return next.toString();
  }, [paramsString]);
  const notifyDownload = useCallback((notification: { tone: "success" | "error"; message: string }) => {
    setNotice({ tone: notification.tone === "error" ? "danger" : "success", message: notification.message });
  }, []);
  const exportDownload = useFileDownload(notifyDownload);
  const exportOrganizations = useCallback(async () => {
    const result = await exportDownload.run({
      path: `/exports/organizations.csv${exportParams ? `?${exportParams}` : ""}`,
      fallbackFilename: "verimed-organizations.csv",
    });
    if (!result) throw new Error(exportDownload.error ?? "Не удалось экспортировать текущую выборку");
  }, [exportDownload, exportParams]);

  const mobileActions = [{
    id: "export-organizations",
    label: "Экспортировать текущую выборку",
    icon: <Download className="h-4 w-4" />,
    onSelect: exportOrganizations,
  }];
  const header = <PageHeader
    eyebrow="Профиль риска"
    title="Медицинские организации"
    description="Сравнивайте объём, структуру услуг и объяснимые отклонения по сопоставимым организациям."
    secondaryActions={<>
      <div className="hidden sm:block">
        <ExportAction state={exportDownload.state} scopeLabel="Текущая выборка" onAction={exportOrganizations} message={exportDownload.error ?? undefined}/>
      </div>
      <div className="sm:hidden">
        <OverflowActions
          label="Действия со списком организаций"
          compactOnMobile
          disabled={exportDownload.state === "loading"}
          items={mobileActions}
          onActionError={(message) => setNotice({ tone: "danger", message })}
        />
      </div>
    </>}
  />;

  if (state.loading) return <div>{header}<PageSkeleton variant="list"/></div>;
  if (state.error || !state.data) return <div>{header}<EmptyState variant="error" title="Не удалось загрузить организации" description="Проверьте соединение и повторите попытку." action={<Button variant="secondary" onClick={() => void state.retry()}>Повторить</Button>}/></div>;

  const data = state.data;
  const page = Number(params.get("page") ?? data.page ?? 1);
  const pages = Math.ceil(data.total / data.page_size);
  const sort = params.get("sort") ?? "risk";
  const direction = params.get("direction") ?? (sort === "name" ? "asc" : "desc");
  const sortDirection = (key: string) => sort === key ? (direction === "asc" ? "ascending" as const : "descending" as const) : undefined;
  const changeSort = (key: string) => updateParams({ sort: key, direction: sort === key && direction === "desc" ? "asc" : "desc" });
  const highPriorityOnPage = data.items.filter((item) => item.priority_level === "Высокий" || item.priority_level === "Критический").length;
  const financialOnPage = data.items.reduce((sum, item) => sum + Number(item.financial_significance ?? 0), 0);
  const signalsOnPage = data.items.reduce((sum, item) => sum + item.signals_count, 0);
  const queueUrl = `/organizations${paramsString ? `?${paramsString}` : ""}`;
  const organizationHref = (id: number) => {
    const query = new URLSearchParams({ returnTo: queueUrl });
    return `/organizations/${id}?${query.toString()}`;
  };

  const columns = [
    { id: "priority", label: "Приоритет", sortable: true, sortDirection: sortDirection("priority"), onSort: () => changeSort("priority"), className: "w-[8.5rem]" },
    { id: "organization", label: "Медицинская организация", sortable: true, sortDirection: sortDirection("name"), onSort: () => changeSort("name"), className: "w-40" },
    { id: "context", label: "Регион и тип", className: "w-[8.5rem]" },
    { id: "signals", label: "Сигналы", align: "right" as const, className: "w-14" },
    { id: "financial", label: "Финансовая значимость", align: "right" as const, sortable: true, sortDirection: sortDirection("financial"), onSort: () => changeSort("financial"), className: "w-[7.5rem]" },
    { id: "risk", label: "Риск и отклонение", sortable: true, sortDirection: sortDirection("risk"), onSort: () => changeSort("risk"), className: "w-36" },
    { id: "status", label: "Статус", className: "w-[7.5rem]" },
    { id: "actions", label: "Действия", header: <span className="sr-only">Действия</span>, align: "right" as const, className: "w-14" },
  ];

  return <div className="min-w-0">
    {header}
    {notice && <InlineNotice className="mb-4" tone={notice.tone} title={notice.message} action={<Button variant="text" size="compact" onClick={() => setNotice(null)}>Закрыть</Button>}/>}

    <MetricStrip className="mb-4 max-sm:grid-cols-2 max-sm:[&>div]:p-3 max-sm:[&>div:nth-child(odd)]:border-r max-sm:[&>div:nth-last-child(-n+2)]:border-b-0" label="Показатели списка организаций">
      <MetricCard label="Найдено организаций" value={numberText(data.total)} icon={SearchCheck} prominent/>
      <MetricCard className="max-sm:[&>p:last-child]:hidden" label="Высокий и критический приоритет" value={numberText(highPriorityOnPage)} detail="на текущей странице" icon={ShieldAlert} tone="priority"/>
      <MetricCard className="max-sm:[&>div>span]:hidden max-sm:[&>p:last-child]:hidden" label="Финансовая значимость" value={money(financialOnPage, true)} detail="на текущей странице" icon={WalletCards} tone="finance"/>
      <MetricCard className="max-sm:[&>p:last-child]:hidden" label="Сигналы" value={numberText(signalsOnPage)} detail="на текущей странице" icon={Landmark}/>
    </MetricStrip>

    <FilterBar
      className="mb-4"
      primaryClassName="grid-cols-2"
      activeCount={activeFilters.length}
      activeFilters={activeFilters.map((filter) => ({ id: filter.key, label: `${filter.label}: ${filter.value}`, onRemove: () => updateParams({ [filter.key]: null }) }))}
      onResetAll={() => router.replace("/organizations", { scroll: false })}
      defaultAdvancedOpen={Boolean(params.get("status"))}
      primary={<>
        <DebouncedSearch key={currentSearch} value={currentSearch} onChange={(value) => updateParams({ search: value || null })}/>
        <Filter label="Регион" value={params.get("region") ?? ""} options={data.regions} onChange={(value) => updateParams({ region: value || null })}/>
        <Filter label="Тип организации" value={params.get("organization_type") ?? ""} options={data.organization_types} onChange={(value) => updateParams({ organization_type: value || null })}/>
        <Filter label="Уровень риска" value={params.get("risk_level") ?? ""} options={["Низкий", "Средний", "Высокий", "Критический"]} onChange={(value) => updateParams({ risk_level: value || null })}/>
      </>}
      advanced={<>
        <Filter label="Статус проверки" value={params.get("status") ?? ""} options={["Не проверено", "На рассмотрении", "Подтверждён сигнал", "Сигнал не подтверждён", "Требуются дополнительные сведения", "Направлено на углублённую проверку", "Проверка завершена"]} onChange={(value) => updateParams({ status: value || null })}/>
        <label><span className="sr-only">Сортировка организаций</span><Select aria-label="Сортировка организаций" value={sort} onChange={(event) => updateParams({ sort: event.target.value, direction: event.target.value === "name" ? "asc" : "desc" })}><option value="risk">По оценке риска</option><option value="priority">По приоритету</option><option value="financial">По финансовой значимости</option><option value="name">По названию</option></Select></label>
      </>}
    />

    {data.items.length === 0 ? <EmptyState title="По выбранным условиям организаций нет" description="Измените фильтры или сбросьте их, чтобы вернуться ко всему списку." action={activeFilters.length ? <Button variant="secondary" onClick={() => router.replace("/organizations")}>Сбросить все</Button> : undefined}/> : <DataTableShell
      columns={columns}
      caption="Медицинские организации"
      tableClassName="min-w-[58.5rem] table-fixed"
      mobileContent={<div data-testid="organizations-mobile-list" className="space-y-3">{data.items.map((organization) => <MobileOrganizationCard key={organization.id} organization={organization} onOpen={() => router.push(organizationHref(organization.id))}/>)}</div>}
    >
      {data.items.map((organization) => <OrganizationRow key={organization.id} organization={organization} onOpen={() => router.push(organizationHref(organization.id))} onOpenSignals={() => router.push(`/signals?organization_id=${organization.id}&sort=priority`)}/>) }
    </DataTableShell>}

    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-v2-text-secondary">Показано {numberText(data.items.length)} из {numberText(data.total)}</p>
      <div className="flex items-center gap-2"><Button variant="secondary" size="icon" disabled={page <= 1} onClick={() => updateParams({ page: String(page - 1) })} aria-label="Предыдущая страница"><ChevronLeft className="h-4 w-4" aria-hidden="true"/></Button><span className="v2-tabular min-w-16 text-center text-sm font-semibold">{page} / {Math.max(1, pages)}</span><Button variant="secondary" size="icon" disabled={page >= pages} onClick={() => updateParams({ page: String(page + 1) })} aria-label="Следующая страница"><ChevronRight className="h-4 w-4" aria-hidden="true"/></Button></div>
    </div>
  </div>;
}

function OrganizationRow({ organization, onOpen, onOpenSignals }: { organization: Organization; onOpen: () => void; onOpenSignals: () => void }) {
  const activate = (event: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };
  return <DataTableRow tabIndex={0} aria-label={`Открыть карточку организации «${organization.name}»`} onClick={onOpen} onKeyDown={activate} className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-v2-primary">
    <DataTableCell className="px-2">{organization.priority_score != null && organization.priority_level ? <DomainIndicator className="[&>span:last-child]:text-[10px]" kind="priority" level={organization.priority_level} value={organization.priority_score} compact/> : <span className="text-xs text-v2-text-muted">Не рассчитан</span>}</DataTableCell>
    <DataTableCell clamp><p className="line-clamp-2 font-semibold leading-5 text-v2-text" title={organization.name}>{organization.name}</p><p className="mt-1 text-xs text-v2-text-secondary">{numberText(organization.services_count)} услуг</p></DataTableCell>
    <DataTableCell clamp><p className="font-medium text-v2-text">{organization.region}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-v2-text-secondary">{organization.organization_type}</p></DataTableCell>
    <DataTableCell className="text-right"><strong className="v2-tabular text-v2-text">{numberText(organization.signals_count)}</strong></DataTableCell>
    <DataTableCell className="text-right"><FinancialValue value={organization.financial_significance ?? "—"} compact className="justify-end"/></DataTableCell>
    <DataTableCell clamp><DomainIndicator kind="risk" level={organization.risk_level} value={organization.risk_score}/><p className="mt-1 line-clamp-2 text-xs leading-5 text-v2-text-secondary">{organization.primary_reason}</p></DataTableCell>
    <DataTableCell className="px-2"><DomainIndicator className="text-[10px]" kind="reviewStatus" level={organization.review_status}/></DataTableCell>
    <DataTableCell className="px-1 text-right"><span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><OverflowActions iconOnly label={`Действия организации «${organization.name}»`} items={[{ id: "open-card", label: "Открыть карточку", icon: <ExternalLink className="h-4 w-4"/>, onSelect: onOpen }, { id: "open-signals", label: "Открыть сигналы организации", icon: <FileSearch className="h-4 w-4"/>, onSelect: onOpenSignals }]}/></span></DataTableCell>
  </DataTableRow>;
}

function MobileOrganizationCard({ organization, onOpen }: { organization: Organization; onOpen: () => void }) {
  const reason = `${numberText(organization.signals_count)} сигналов · риск ${organization.risk_score} из 100. ${organization.primary_reason}`;
  return <MobileObjectCard
    title={organization.name}
    context={`${organization.region} · ${organization.organization_type}`}
    indicator={organization.priority_score != null && organization.priority_level ? <DomainIndicator kind="priority" level={organization.priority_level} value={organization.priority_score} compact/> : undefined}
    financial={<FinancialValue value={organization.financial_significance ?? "—"} compact/>}
    status={<DomainIndicator kind="reviewStatus" level={organization.review_status}/>}
    reason={reason}
    onClick={onOpen}
  />;
}

function Filter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label><span className="sr-only">{label}</span><Select className="w-full" value={value} onChange={(event) => onChange(event.target.value)}><option value="">{label}: все</option>{options.map((option) => <option key={option}>{option}</option>)}</Select></label>;
}

function DebouncedSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    const normalized = draft.trim();
    if (normalized === value) return;
    const timer = window.setTimeout(() => onChange(normalized), 320);
    return () => window.clearTimeout(timer);
  }, [draft, onChange, value]);
  return <label className="col-span-2 xl:col-span-1"><span className="sr-only">Поиск организаций</span><Search value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Название или регион" aria-label="Поиск организаций"/></label>;
}
