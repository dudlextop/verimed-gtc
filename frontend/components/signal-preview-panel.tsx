"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, ChevronRight, CircleDollarSign, RefreshCw, X } from "lucide-react";
import { api } from "@/lib/api";
import type { SignalDetail } from "@/lib/types";
import { useApi } from "@/hooks/use-api";
import { dateText, dateTimeText, money } from "@/lib/utils";
import { Badge, Button, Card, FinancialValue, InlineNotice, Skeleton } from "./ui";
import { StatusBadge } from "./status-badge";
import { PriorityBadge } from "./priority-badge";
import { FinancialDisclaimer } from "./financial-disclaimer";

type SignalPreviewPanelProps = {
  signalId: number;
  previousId?: number | null;
  nextId?: number | null;
  fullCardHref?: string;
  onNavigate?: (signalId: number) => void;
  onOpenFull?: () => void;
  onClose: () => void;
  onUpdated: (signal: SignalDetail) => void;
};

export function SignalPreviewPanel({signalId, previousId = null, nextId = null, fullCardHref, onNavigate, onOpenFull, onClose, onUpdated}: SignalPreviewPanelProps) {
  const state = useApi(() => api.signalPreview(signalId), [signalId]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { window.removeEventListener("keydown", closeOnEscape); previousFocus?.focus(); };
  }, [onClose]);

  const startReview = async () => {
    if (!state.data) return;
    setSaving(true); setNotice(null);
    try {
      const updated = await api.review(state.data.id, "На рассмотрении", "", "проверка начата");
      state.setData(updated); onUpdated(updated); setNotice("Проверка начата");
    } catch { setNotice("Не удалось начать проверку. Повторите попытку."); }
    finally { setSaving(false); }
  };

  const continueReview = state.data?.status !== "Не проверено";
  const cardHref = fullCardHref ?? `/signals/${signalId}`;

  return <div className="fixed inset-0 z-50">
    <button type="button" className="absolute inset-0 bg-navigation/35 backdrop-blur-[2px]" onClick={onClose} aria-label="Закрыть быстрый просмотр"/>
    <aside ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className="absolute inset-y-0 right-0 flex w-full max-w-[38rem] flex-col border-l border-border/70 bg-background shadow-overlay focus-visible:outline-none motion-safe:animate-[panel-in_200ms_ease-out] motion-reduce:animate-none">
      <div className="flex items-center gap-2 border-b border-border/75 bg-card/90 px-4 py-3 backdrop-blur-xl sm:px-5">
        <div className="min-w-0 flex-1"><p className="eyebrow">Быстрый просмотр</p><p className="mt-1 text-sm font-semibold text-foreground">Сигнал № {signalId}</p></div>
        <Button variant="ghost" size="icon" disabled={!previousId} onClick={() => previousId && onNavigate?.(previousId)} aria-label="Предыдущий сигнал"><ArrowLeft className="h-4 w-4" aria-hidden="true"/></Button>
        <Button variant="ghost" size="icon" disabled={!nextId} onClick={() => nextId && onNavigate?.(nextId)} aria-label="Следующий сигнал"><ArrowRight className="h-4 w-4" aria-hidden="true"/></Button>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть панель"><X className="h-5 w-5" aria-hidden="true"/></Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {state.loading && <PreviewLoading/>}
        {state.error && <InlineNotice tone="danger" title="Не удалось загрузить сигнал" description="Проверьте соединение и повторите попытку." action={<Button variant="outline" onClick={() => void state.retry()}><RefreshCw className="h-4 w-4" aria-hidden="true"/>Повторить</Button>}/>} 
        {!state.loading && !state.error && !state.data && <InlineNotice title="Сигнал недоступен" description="Список мог измениться после нового анализа."/>}
        {state.data && <PreviewContent signal={state.data} titleId={titleId}/>} 
      </div>
      {state.data && <div className="sticky-workbar p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"><div className="grid gap-2 sm:grid-cols-[1fr_auto]">{continueReview ? <Link href={cardHref} onClick={onOpenFull} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white shadow-[0_8px_24px_-14px_hsl(var(--primary)/.8)] transition-colors duration-100 hover:bg-[hsl(var(--primary-hover))] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Продолжить проверку<ArrowRight className="h-4 w-4" aria-hidden="true"/></Link> : <Button onClick={() => void startReview()} disabled={saving} aria-busy={saving}>{saving ? "Сохранение…" : "Начать проверку"}<ArrowRight className="h-4 w-4" aria-hidden="true"/></Button>}<Link href={cardHref} onClick={onOpenFull} className="inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring">Открыть карточку</Link></div></div>}
      {notice && <div role="status" className="absolute bottom-24 left-4 right-4 rounded-md bg-navigation px-4 py-3 text-sm text-white shadow-overlay">{notice}</div>}
    </aside>
  </div>;
}

function PreviewContent({signal: s, titleId}: {signal: SignalDetail; titleId: string}) {
  const factors = [...s.factors, ...s.priority_factors].slice(0, 3);
  const lastReview = s.reviews[0];
  return <div className="space-y-4">
    <Card className="border-priority/15 bg-gradient-to-br from-priority-soft via-card to-card p-5"><div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between"><div><p className="text-xs font-bold text-priority">Приоритет проверки</p><div className="mt-1 flex items-baseline gap-2"><span className="font-mono text-4xl font-bold tracking-tight text-priority tabular-nums">{s.priority_score ?? "—"}</span><span className="text-xs text-muted-foreground">из 100</span></div></div>{s.priority_level && <PriorityBadge level={s.priority_level} compact/>}</div></Card>
    <div className="flex flex-wrap items-center gap-2"><StatusBadge status={s.status}/><Badge className="border-border/70 bg-surface-soft text-muted-foreground">{s.anomaly_type}</Badge></div>
    <div className="min-w-0"><h2 id={titleId} className="break-words text-xl font-bold tracking-[-0.025em] [overflow-wrap:anywhere] sm:text-2xl">{s.service_name}</h2><p className="mt-2 flex min-w-0 items-start gap-2 break-words text-sm font-semibold text-muted-foreground [overflow-wrap:anywhere]"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true"/>{s.organization_name}</p></div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Fact label="Финансовая значимость" value={money(s.financial_significance)} finance/><Fact label="Основная причина" value={s.primary_reason}/></div>
    <FinancialDisclaimer/>
    <Disclosure title="Обоснование"><div className="space-y-3"><p className="text-sm text-muted-foreground">Оценка риска: <strong className="text-foreground">{s.score} из 100</strong></p>{factors.map((factor) => <div key={factor.name} className="rounded-md border border-border/70 bg-surface-soft p-3"><div className="flex justify-between gap-3"><p className="text-sm font-semibold">{factor.name}</p><strong className="font-mono text-sm text-primary">+{factor.contribution}</strong></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{factor.actual_value} · сравнение: {factor.typical_value}</p></div>)}</div></Disclosure>
    <Disclosure title="Связанные записи"><div className="space-y-3">{s.related_services.length ? s.related_services.slice(0, 3).map((item) => <div key={item.record_id} className="border-l-2 border-stability/35 pl-3"><p className="text-sm font-semibold">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{dateText(item.date)} · {item.time} · {money(item.amount)}</p></div>) : <p className="text-sm text-muted-foreground">Связанные записи не найдены.</p>}</div></Disclosure>
    <Disclosure title="Ограничения"><ul className="space-y-2">{s.limitations.map((item) => <li key={item} className="text-sm leading-6 text-muted-foreground">• {item}</li>)}</ul></Disclosure>
    <Disclosure title="Последнее экспертное решение">{lastReview ? <div><p className="font-semibold">{lastReview.status}</p><p className="mt-1 text-xs text-muted-foreground">{lastReview.reviewer_name} · {dateTimeText(lastReview.created_at)}</p>{lastReview.comment && <p className="mt-3 text-sm leading-6">{lastReview.comment}</p>}</div> : <p className="text-sm text-muted-foreground">Решения по сигналу пока не зафиксированы.</p>}</Disclosure>
  </div>;
}

function Disclosure({title, children}: {title: string; children: React.ReactNode}) { return <details className="disclosure group"><summary className="flex items-center justify-between gap-3"><span>{title}</span><ChevronRight className="h-4 w-4 text-primary transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true"/></summary><div className="border-t border-border/70 p-4">{children}</div></details>; }
function Fact({label, value, finance = false}: {label: string; value: string; finance?: boolean}) { return <div className="min-w-0 rounded-lg border border-border/70 bg-card p-4 shadow-card">{finance ? <FinancialValue label={label} value={value}/> : <><CircleDollarSign className="h-4 w-4 text-primary" aria-hidden="true"/><p className="mt-2 text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-bold leading-5">{value}</p></>}</div>; }
function PreviewLoading() { return <div className="space-y-4" aria-label="Загрузка быстрого просмотра"><Skeleton className="h-28"/><Skeleton className="h-20"/><Skeleton className="h-12"/><Skeleton className="h-12"/></div>; }
