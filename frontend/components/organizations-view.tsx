"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Building2, ChevronLeft, ChevronRight, Grid2X2, List, Search } from "lucide-react";
import { api } from "@/lib/api";
import type { Organization } from "@/lib/types";
import { useApi } from "@/hooks/use-api";
import { money, number } from "@/lib/utils";
import { Button, Card, Input, Select } from "./ui";
import { EmptyState, ErrorState, PageLoading } from "./data-state";
import { RiskBadge } from "./risk-badge";
import { StatusBadge } from "./status-badge";
import { PriorityBadge } from "./priority-badge";
import { PrioritySparkline } from "./priority-sparkline";

export function OrganizationsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [view, setView] = useState<"table" | "cards">("table");
  const query = searchParams.toString();
  const state = useApi(() => api.organizations(query), query);
  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    params.delete("page");
    router.replace(`/organizations?${params.toString()}`);
  };
  const columns = useMemo<ColumnDef<Organization>[]>(() => [
    { accessorKey: "name", header: "Медицинская организация", cell: ({row}) => <Link href={`/organizations/${row.original.id}`} className="font-semibold text-foreground hover:text-primary hover:underline">{row.original.name}</Link> },
    { accessorKey: "region", header: "Регион" },
    { accessorKey: "organization_type", header: "Тип организации" },
    { accessorKey: "services_count", header: "Услуги", cell: ({getValue}) => number(getValue<number>()) },
    { accessorKey: "total_amount", header: "Общая сумма", cell: ({getValue}) => money(getValue<string>()) },
    { accessorKey: "signals_count", header: "Сигналы", cell: ({getValue}) => number(getValue<number>()) },
    { accessorKey: "risk_score", header: "Оценка риска", cell: ({row}) => <div className="space-y-1"><strong>{row.original.risk_score}</strong><RiskBadge level={row.original.risk_level}/></div> },
    { accessorKey: "priority_score", header: "Приоритет проверки", cell: ({row}) => row.original.priority_score != null && row.original.priority_level ? <div className="space-y-1"><strong className="font-mono tabular-nums">{row.original.priority_score}</strong><PriorityBadge level={row.original.priority_level}/></div> : <span className="text-xs">Не рассчитан</span> },
    { accessorKey: "financial_significance", header: "Финансовая значимость", cell: ({row}) => <span className="font-mono font-semibold tabular-nums text-foreground">{money(row.original.financial_significance)}</span> },
    { id: "priority_history", header: "Динамика приоритета", cell: ({row}) => <PrioritySparkline history={row.original.priority_history}/> },
    { accessorKey: "primary_reason", header: "Основная причина" },
    { accessorKey: "review_status", header: "Статус проверки", cell: ({row}) => <StatusBadge status={row.original.review_status}/> },
  ], []);
  // TanStack Table returns mutable callbacks that the React Compiler intentionally skips.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({data: state.data?.items ?? [], columns, state: {sorting}, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel()});

  if (state.loading) return <PageLoading/>;
  if (state.error || !state.data) return <ErrorState message={state.error ?? "Ответ сервиса неполон"} retry={() => void state.retry()}/>;
  const page = Number(searchParams.get("page") ?? 1);
  const pages = Math.ceil(state.data.total / state.data.page_size);

  return <>
    <Card className="mb-4 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_repeat(4,1fr)_auto]">
        <label className="relative"><span className="sr-only">Поиск организации</span><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true"/><Input className="pl-9" type="search" placeholder="Название или регион" defaultValue={searchParams.get("search") ?? ""} onKeyDown={(event) => { if (event.key === "Enter") setParam("search", event.currentTarget.value); }}/></label>
        <Filter label="Регион" value={searchParams.get("region") ?? ""} options={state.data.regions} onChange={(value) => setParam("region", value)}/>
        <Filter label="Тип организации" value={searchParams.get("organization_type") ?? ""} options={state.data.organization_types} onChange={(value) => setParam("organization_type", value)}/>
        <Filter label="Уровень риска" value={searchParams.get("risk_level") ?? ""} options={["Низкий", "Средний", "Высокий", "Критический"]} onChange={(value) => setParam("risk_level", value)}/>
        <Filter label="Статус проверки" value={searchParams.get("status") ?? ""} options={["Не проверено", "На рассмотрении", "Подтверждён сигнал", "Сигнал не подтверждён", "Направлено на углублённую проверку", "Проверка завершена"]} onChange={(value) => setParam("status", value)}/>
        <div className="hidden gap-1 rounded-md bg-muted p-1 lg:flex"><button type="button" onClick={() => setView("table")} className={`grid h-10 w-10 place-items-center rounded-md ${view === "table" ? "bg-card shadow-sm" : ""}`} aria-label="Показать таблицей"><List className="h-4 w-4"/></button><button type="button" onClick={() => setView("cards")} className={`grid h-10 w-10 place-items-center rounded-md ${view === "cards" ? "bg-card shadow-sm" : ""}`} aria-label="Показать карточками"><Grid2X2 className="h-4 w-4"/></button></div>
      </div>
    </Card>

    {state.data.items.length === 0 ? <Card><EmptyState action={<Button variant="secondary" onClick={() => router.replace("/organizations")}>Сбросить фильтры</Button>}/></Card> : <>
      <div className={view === "cards" ? "block" : "lg:hidden"}><OrganizationCards organizations={state.data.items}/></div>
      {view === "table" && <Card className="hidden overflow-hidden lg:block"><div className="overflow-x-auto"><table className="w-full min-w-[1380px]"><thead className="bg-slate-950 text-white"><tr>{table.getFlatHeaders().map((header) => <th key={header.id} className="table-cell text-xs font-semibold"><button type="button" onClick={header.column.getToggleSortingHandler()} className="flex min-h-10 items-center gap-1.5 text-left focus-visible:ring-2 focus-visible:ring-white">{flexRender(header.column.columnDef.header, header.getContext())}<ArrowUpDown className="h-3.5 w-3.5 text-slate-400"/></button></th>)}</tr></thead><tbody className="divide-y divide-border">{table.getRowModel().rows.map((row) => <tr key={row.id} className="hover:bg-violet-50/60">{row.getVisibleCells().map((cell) => <td key={cell.id} className="table-cell max-w-56 text-muted-foreground">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></table></div></Card>}
    </>}

    <div className="mt-4 flex items-center justify-between"><p className="text-sm text-muted-foreground">Показано {state.data.items.length} из {state.data.total}</p><div className="flex items-center gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => setParam("page", String(page - 1))} aria-label="Предыдущая страница"><ChevronLeft className="h-4 w-4"/></Button><span className="text-sm font-semibold">{page} / {Math.max(1, pages)}</span><Button variant="secondary" disabled={page >= pages} onClick={() => setParam("page", String(page + 1))} aria-label="Следующая страница"><ChevronRight className="h-4 w-4"/></Button></div></div>
  </>;
}

function OrganizationCards({organizations}: {organizations: Organization[]}) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="organizations-mobile-list">{organizations.map((organization) => <Link key={organization.id} href={`/organizations/${organization.id}`} className="rounded-lg focus-visible:ring-2 focus-visible:ring-ring"><Card className="h-full p-5 transition-transform hover:-translate-y-0.5"><div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-md bg-violet-100 text-primary"><Building2 className="h-5 w-5"/></span>{organization.priority_level ? <PriorityBadge level={organization.priority_level}/> : <span className="text-xs text-muted-foreground">Не рассчитан</span>}</div><p className="mt-4 text-xs font-semibold text-primary">Приоритет проверки</p><p className="mt-1 font-mono text-3xl font-bold tabular-nums">{organization.priority_score ?? "—"}<span className="ml-1 text-xs font-normal text-muted-foreground">из 100</span></p><h2 className="mt-4 font-bold">{organization.name}</h2><p className="mt-1 text-sm text-muted-foreground">{organization.region} · {organization.organization_type}</p><div className="mt-5 grid grid-cols-3 gap-3 border-t pt-4"><Stat label="Риск" value={String(organization.risk_score)}/><Stat label="Финансовая значимость" value={money(organization.financial_significance)}/><Stat label="Сигналы" value={number(organization.signals_count)}/></div><p className="mt-4 text-sm"><span className="text-muted-foreground">Причина: </span>{organization.primary_reason}</p></Card></Link>)}</div>;
}

function Filter({label, value, options, onChange}: {label: string; value: string; options: string[]; onChange: (value: string) => void}) {
  return <label><span className="sr-only">{label}</span><Select className="w-full" value={value} onChange={(event) => onChange(event.target.value)}><option value="">{label}: все</option>{options.map((option) => <option key={option}>{option}</option>)}</Select></label>;
}

function Stat({label, value}: {label: string; value: string}) {
  return <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-bold">{value}</p></div>;
}
