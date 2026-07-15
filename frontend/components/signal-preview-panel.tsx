"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, ChevronRight, ExternalLink, RefreshCw, X } from "lucide-react";
import { api } from "@/lib/api";
import type { SignalDetail } from "@/lib/types";
import { useApi } from "@/hooks/use-api";
import { dateText, dateTimeText, money } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  DomainIndicator,
  FinancialValue,
  InlineNotice,
  OverflowActions,
  Skeleton,
} from "./foundation";
import { FinancialDisclaimer } from "./financial-disclaimer";

type SignalPreviewPanelProps = {
  signalId: number;
  previousId?: number | null;
  nextId?: number | null;
  position?: number;
  queueSize?: number;
  fullCardHref?: string;
  onNavigate?: (signalId: number) => void;
  onOpenFull?: () => void;
  onClose: () => void;
  onUpdated: (signal: SignalDetail) => void;
};

const FOCUSABLE = "a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), details > summary, [tabindex]:not([tabindex='-1'])";

export function SignalPreviewPanel({ signalId, previousId = null, nextId = null, position, queueSize, fullCardHref, onNavigate, onOpenFull, onClose, onUpdated }: SignalPreviewPanelProps) {
  const state = useApi(() => api.signalPreview(signalId), [signalId]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const controls = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");
      if (!controls.length) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  const startReview = async () => {
    if (!state.data) return;
    setSaving(true);
    setNotice(null);
    try {
      const updated = await api.review(state.data.id, "На рассмотрении", "", "проверка начата");
      state.setData(updated);
      onUpdated(updated);
      setNotice("Проверка начата");
    } catch {
      setNotice("Не удалось начать проверку. Повторите попытку.");
    } finally {
      setSaving(false);
    }
  };

  const continueReview = state.data?.status !== "Не проверено";
  const cardHref = fullCardHref ?? `/signals/${signalId}`;
  const openFullCard = () => {
    onOpenFull?.();
    document.getElementById(`preview-full-card-${signalId}`)?.click();
  };

  return <div className="fixed inset-0 z-50">
    <button type="button" className="absolute inset-0 bg-v2-overlay motion-safe:animate-[v2-mobile-navigation-overlay-in_150ms_ease-out] motion-reduce:animate-none" onClick={onClose} aria-label="Закрыть быстрый просмотр"/>
    <aside
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={state.data ? titleId : undefined}
      aria-describedby={descriptionId}
      aria-label={state.data ? undefined : `Быстрый просмотр сигнала ${signalId}`}
      className="absolute inset-0 flex min-w-0 flex-col border-l border-v2-border bg-v2-surface text-v2-text shadow-v2-panel focus-visible:outline-none motion-safe:animate-[panel-in_200ms_ease-out] motion-reduce:animate-none lg:left-auto lg:w-[30rem]"
    >
      <header className="flex min-h-16 items-center gap-1 border-b border-v2-border bg-v2-surface px-3 sm:gap-2 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-v2-primary">Быстрый просмотр</p>
          <p id={descriptionId} className="mt-1 truncate text-xs text-v2-text-secondary">Сигнал № {signalId}{position && queueSize ? ` · ${position} из ${queueSize}` : ""}</p>
        </div>
        <Button variant="ghost" size="icon" disabled={!previousId} onClick={() => previousId && onNavigate?.(previousId)} aria-label="Предыдущий сигнал"><ArrowLeft className="h-4 w-4" aria-hidden="true"/></Button>
        <Button variant="ghost" size="icon" disabled={!nextId} onClick={() => nextId && onNavigate?.(nextId)} aria-label="Следующий сигнал"><ArrowRight className="h-4 w-4" aria-hidden="true"/></Button>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть панель"><X className="h-5 w-5" aria-hidden="true"/></Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-8 sm:p-5">
        {state.loading && <PreviewLoading/>}
        {state.error && (
          <InlineNotice
            tone="danger"
            title="Не удалось загрузить сигнал"
            description="Проверьте соединение и повторите попытку."
            action={<Button variant="secondary" size="compact" onClick={() => void state.retry()}><RefreshCw className="h-4 w-4" aria-hidden="true"/>Повторить</Button>}
          />
        )}
        {!state.loading && !state.error && !state.data && <InlineNotice title="Сигнал недоступен" description="Список мог измениться после нового анализа."/>}
        {state.data && <PreviewContent signal={state.data} titleId={titleId}/>} 
      </div>

      {state.data && <footer className="border-t border-v2-border bg-v2-surface/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-v2-sticky backdrop-blur sm:p-4">
        <div className="flex min-w-0 items-center gap-2">
          {continueReview ? <Link href={cardHref} onClick={onOpenFull} className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-v2-control bg-v2-primary px-4 text-sm font-semibold text-white transition-colors duration-100 hover:bg-v2-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary focus-visible:ring-offset-2 motion-reduce:transition-none">Продолжить проверку<ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true"/></Link> : <Button className="min-w-0 flex-1" onClick={() => void startReview()} loading={saving}>Начать проверку<ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true"/></Button>}
          {!continueReview && <Link href={cardHref} onClick={onOpenFull} className="hidden min-h-11 items-center justify-center rounded-v2-control border border-v2-border-strong bg-v2-surface px-3 text-sm font-semibold text-v2-text hover:border-v2-primary hover:bg-v2-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary sm:inline-flex">Открыть карточку</Link>}
          {!continueReview && <div className="shrink-0 sm:hidden"><Link id={`preview-full-card-${signalId}`} href={cardHref} onClick={onOpenFull} className="sr-only">Открыть полную карточку</Link><OverflowActions compactOnMobile placement="top" label="Другие действия" items={[{ id: "open-card", label: "Открыть полную карточку", icon: <ExternalLink className="h-4 w-4"/>, onSelect: openFullCard }]}/></div>}
        </div>
      </footer>}
      {notice && <div role="status" aria-live="polite" className="absolute bottom-24 left-4 right-4 rounded-v2-control bg-v2-text px-4 py-3 text-sm text-white shadow-v2-dropdown">{notice}</div>}
    </aside>
  </div>;
}

function PreviewContent({ signal: s, titleId }: { signal: SignalDetail; titleId: string }) {
  const factors = [...s.factors, ...s.priority_factors].slice(0, 3);
  const lastReview = s.reviews[0];
  return <div className="space-y-4">
    <Card variant="soft" className="border border-v2-primary/20 p-4">
      <p className="text-xs font-semibold text-v2-text-secondary">Приоритет проверки</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className="v2-tabular text-4xl font-bold tracking-[-0.04em] text-v2-text">{s.priority_score ?? "—"}<span className="ml-1 text-xs font-medium tracking-normal text-v2-text-secondary">из 100</span></p>
        {s.priority_level && <DomainIndicator kind="priority" level={s.priority_level} compact/>}
      </div>
    </Card>

    <div className="flex flex-wrap items-center gap-2"><DomainIndicator kind="reviewStatus" level={s.status}/><Badge>{s.anomaly_type}</Badge></div>
    <div className="min-w-0"><h2 id={titleId} className="break-words text-xl font-bold leading-tight tracking-[-0.025em] [overflow-wrap:anywhere] sm:text-2xl">{s.service_name}</h2><p className="mt-2 flex min-w-0 items-start gap-2 break-words text-sm font-semibold text-v2-text-secondary [overflow-wrap:anywhere]"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-v2-primary" aria-hidden="true"/>{s.organization_name}</p></div>

    <Card className="p-4"><FinancialValue label="Финансовая значимость" value={s.financial_significance ?? "—"} leading/><div className="mt-4 border-t border-v2-border pt-4"><p className="text-xs font-semibold text-v2-text-secondary">Основная причина</p><p className="mt-1 text-sm font-semibold leading-6 text-v2-text">{s.primary_reason}</p></div></Card>
    <FinancialDisclaimer/>

    <Disclosure title="Обоснование"><div className="space-y-3"><DomainIndicator kind="risk" level={s.level} value={s.score}/>{factors.map((factor) => <div key={factor.name} className="rounded-v2-control bg-v2-surface-soft p-3"><div className="flex justify-between gap-3"><p className="text-sm font-semibold">{factor.name}</p><strong className="v2-tabular text-sm text-v2-primary">Вклад +{factor.contribution}</strong></div><p className="mt-2 text-xs leading-5 text-v2-text-secondary">{factor.actual_value} · сравнение: {factor.typical_value}</p></div>)}</div></Disclosure>
    <Disclosure title="Связанные записи"><div className="space-y-3">{s.related_services.length ? s.related_services.slice(0, 3).map((item) => <div key={item.record_id} className="border-l-2 border-v2-cyan pl-3"><p className="text-sm font-semibold">{item.name}</p><p className="mt-1 text-xs text-v2-text-secondary">{dateText(item.date)} · {item.time} · {money(item.amount)}</p></div>) : <p className="text-sm text-v2-text-secondary">Связанные записи не найдены.</p>}</div></Disclosure>
    <Disclosure title="Ограничения"><ul className="space-y-2">{s.limitations.map((item) => <li key={item} className="text-sm leading-6 text-v2-text-secondary">• {item}</li>)}</ul></Disclosure>
    <Disclosure title="Последнее экспертное решение">{lastReview ? <div><p className="font-semibold">{lastReview.status}</p><p className="mt-1 text-xs text-v2-text-secondary">{lastReview.reviewer_name} · {dateTimeText(lastReview.created_at)}</p>{lastReview.comment && <p className="mt-3 text-sm leading-6">{lastReview.comment}</p>}</div> : <p className="text-sm text-v2-text-secondary">Решения по сигналу пока не зафиксированы.</p>}</Disclosure>
  </div>;
}

function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
  return <details className="group rounded-v2-card border border-v2-border bg-v2-surface"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-v2-card px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary"><span>{title}</span><ChevronRight className="h-4 w-4 text-v2-primary transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true"/></summary><div className="border-t border-v2-border p-4">{children}</div></details>;
}

function PreviewLoading() {
  return <div className="space-y-4" aria-label="Загрузка быстрого просмотра" aria-busy="true"><Skeleton className="h-28"/><Skeleton className="h-20"/><Skeleton className="h-12"/><Skeleton className="h-12"/></div>;
}
