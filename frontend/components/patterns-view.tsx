"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarRange, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import type { RecurringPattern } from "@/lib/types";
import { money, number } from "@/lib/utils";
import { useApi } from "@/hooks/use-api";
import { EmptyState, ErrorState, PageLoading } from "./data-state";
import { ImportanceBadge as PriorityBadge, PatternTypeBadge, StabilityBadge } from "./pattern-badges";
import { Button, Card, Input, Select } from "./ui";
import { contextHref } from "@/lib/work-context";

export function PatternsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const state = useApi(() => api.patterns(query), query);
  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    if (key !== "page") params.delete("page");
    router.replace(`/patterns?${params.toString()}`, { scroll: false });
  };

  if (state.loading) return <PageLoading/>;
  if (state.error || !state.data) return <ErrorState message={state.error ?? "Ответ сервиса неполон"} retry={() => void state.retry()}/>;

  const data = state.data;
  const totalPages = Math.max(1, Math.ceil(data.total / data.page_size));
  const returnTo = query ? `/patterns?${query}` : "/patterns";
  const orderedIds = data.items.map((pattern) => pattern.id);
  const patternHref = (id: number) => contextHref(`/patterns/${id}`, returnTo, orderedIds);
  return <>
    <Card className="mb-4 p-4"><div className="grid gap-3 md:grid-cols-3"><Filter label="Уровень важности" value={searchParams.get("importance") ?? ""} options={["Низкий", "Средний", "Высокий", "Критический"]} onChange={(value) => setParam("importance", value)}/><Filter label="Уровень устойчивости" value={searchParams.get("stability") ?? ""} options={["Низкая", "Средняя", "Высокая", "Очень высокая"]} onChange={(value) => setParam("stability", value)}/><Select aria-label="Сортировка моделей" value={searchParams.get("sort") ?? "importance"} onChange={(event) => setParam("sort", event.target.value)}><option value="importance">По важности</option><option value="stability">По устойчивости</option><option value="financial">По финансовой значимости</option><option value="signals">По числу сигналов</option><option value="last_seen">По последнему появлению</option></Select></div><details className="mt-3 rounded-md bg-muted px-3 py-2"><summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring"><SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden="true"/>Дополнительные фильтры</summary><div className="grid gap-3 border-t pt-3 md:grid-cols-2 xl:grid-cols-4"><Filter label="Тип модели" value={searchParams.get("pattern_type") ?? ""} options={data.pattern_types} onChange={(value) => setParam("pattern_type", value)}/><Filter label="Медицинская организация" value={searchParams.get("organization_id") ?? ""} options={data.organizations.map((item) => `${item.id}|${item.label}`)} valuesWithLabels onChange={(value) => setParam("organization_id", value)}/><Filter label="Статус оценки" value={searchParams.get("status") ?? ""} options={["Не оценено", "Значимость подтверждена", "Отмечено как несущественное", "Направлено на углублённую проверку"]} onChange={(value) => setParam("status", value)}/><label className="space-y-1 text-xs font-semibold text-muted-foreground"><span className="flex items-center gap-1"><CalendarRange className="h-3.5 w-3.5" aria-hidden="true"/>Период</span><Input type="month" value={searchParams.get("period") ?? ""} onChange={(event) => setParam("period", event.target.value)}/></label><label className="space-y-1 text-xs font-semibold text-muted-foreground"><span>Финансовая значимость от</span><Input type="text" inputMode="numeric" value={searchParams.get("financial_min") ?? ""} onChange={(event) => setParam("financial_min", event.target.value.replace(/\D/g, ""))} placeholder="Например, 500000"/></label><label className="space-y-1 text-xs font-semibold text-muted-foreground"><span>Финансовая значимость до</span><Input type="text" inputMode="numeric" value={searchParams.get("financial_max") ?? ""} onChange={(event) => setParam("financial_max", event.target.value.replace(/\D/g, ""))} placeholder="Без ограничения"/></label></div></details></Card>

    {data.items.length === 0 ? <Card><EmptyState title="Повторяющиеся модели пока не сформированы" description="Для анализа требуется несколько периодов наблюдений." action={<Button variant="secondary" onClick={() => router.replace("/patterns")}>Сбросить фильтры</Button>}/></Card> : <>
      <div className="space-y-3 lg:hidden" data-testid="patterns-mobile-list">{data.items.map((pattern) => <MobilePatternCard key={pattern.id} pattern={pattern} href={patternHref(pattern.id)}/>)}</div>
      <Card className="hidden overflow-hidden lg:block"><div className="overflow-x-auto"><table className="w-full min-w-[1050px]"><thead className="bg-slate-950 text-white"><tr><th className="table-cell">Важность</th><th className="table-cell">Название модели</th><th className="table-cell">Тип</th><th className="table-cell">Организация</th><th className="table-cell">Финансовая значимость</th><th className="table-cell">Устойчивость</th><th className="table-cell">Статус</th></tr></thead><tbody className="divide-y divide-border">{data.items.map((pattern) => <tr key={pattern.id} className="hover:bg-violet-50/60"><td className="table-cell"><div className="space-y-1"><strong className="font-mono text-lg tabular-nums">{pattern.importance_score}</strong><PriorityBadge level={pattern.importance_level}/></div></td><td className="table-cell max-w-72"><Link href={patternHref(pattern.id)} className="font-semibold text-foreground hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring">{pattern.name}</Link></td><td className="table-cell"><PatternTypeBadge label={pattern.pattern_type_label}/></td><td className="table-cell max-w-56 text-sm text-muted-foreground">{pattern.main_organization ?? "Несколько организаций"}</td><td className="table-cell whitespace-nowrap font-mono font-semibold tabular-nums">{money(pattern.financial_significance)}</td><td className="table-cell"><StabilityBadge level={pattern.stability_level} score={pattern.stability_score}/></td><td className="table-cell text-sm">{pattern.review_status}</td></tr>)}</tbody></table></div></Card>
    </>}

    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">Страница {data.page} из {totalPages} · моделей: {number(data.total)}</p><div className="flex gap-2"><Button variant="secondary" disabled={data.page <= 1} onClick={() => setParam("page", String(data.page - 1))}><ArrowLeft className="h-4 w-4" aria-hidden="true"/>Назад</Button><Button variant="secondary" disabled={data.page >= totalPages} onClick={() => setParam("page", String(data.page + 1))}>Далее<ArrowRight className="h-4 w-4" aria-hidden="true"/></Button></div></div>
  </>;
}

function MobilePatternCard({pattern, href}: {pattern: RecurringPattern; href: string}) { return <Link href={href} className="block focus-visible:ring-2 focus-visible:ring-ring"><Card className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-2xl font-bold tabular-nums">{pattern.importance_score}<span className="ml-1 text-xs font-normal text-muted-foreground">из 100</span></p><div className="mt-1"><PriorityBadge level={pattern.importance_level}/></div></div><span className="text-sm font-semibold">{pattern.review_status}</span></div><h2 className="mt-4 font-bold">{pattern.name}</h2><p className="mt-1 text-sm text-muted-foreground">{pattern.main_organization ?? "Несколько организаций"}</p><div className="mt-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs text-muted-foreground">Финансовая значимость</p><p className="mt-1 font-mono font-bold tabular-nums">{money(pattern.financial_significance)}</p></div><StabilityBadge level={pattern.stability_level} score={pattern.stability_score}/></div></Card></Link>; }

function Filter({label, value, options, onChange, valuesWithLabels = false}: {label: string; value: string; options: string[]; onChange: (value: string) => void; valuesWithLabels?: boolean}) { return <label className="space-y-1 text-xs font-semibold text-muted-foreground"><span>{label}</span><Select className="w-full" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Все</option>{options.map((option) => { const [optionValue, optionLabel] = valuesWithLabels ? option.split("|", 2) : [option, option]; return <option key={option} value={optionValue}>{optionLabel}</option>; })}</Select></label>; }
