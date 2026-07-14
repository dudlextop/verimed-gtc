import * as React from "react";
import { AlertCircle, CheckCircle2, Clock3, DatabaseZap, History, Inbox, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("v2-skeleton animate-pulse rounded-v2-control bg-v2-surface-soft motion-reduce:animate-none", className)} />;
}

export type SkeletonVariant = "dashboard" | "list" | "detail" | "journal" | "overview";

function SkeletonRows({ count = 4 }: { count?: number }) {
  return <div className="space-y-3">{Array.from({ length: count }, (_, index) => <Skeleton key={index} className="h-16" />)}</div>;
}

export function PageSkeleton({ variant = "dashboard", className }: { variant?: SkeletonVariant; className?: string }) {
  return (
    <div className={cn("space-y-5", className)} aria-label="Загрузка данных" aria-busy="true" data-skeleton={variant}>
      <Skeleton className="h-24" />
      {variant === "dashboard" && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div><SkeletonRows count={3} /></>}
      {variant === "list" && <><Skeleton className="h-28" /><SkeletonRows count={5} /></>}
      {variant === "detail" && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div><Skeleton className="h-72" /></>}
      {variant === "journal" && <><Skeleton className="h-24" /><SkeletonRows count={5} /></>}
      {variant === "overview" && <><div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]"><Skeleton className="h-44" /><Skeleton className="h-44" /></div><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-36" /></div></>}
    </div>
  );
}

export type EmptyStateVariant = "empty" | "insufficient" | "error" | "history" | "stale";

const emptyStateStyles: Record<EmptyStateVariant, { icon: typeof Inbox; iconClass: string; surface: string }> = {
  empty: { icon: Inbox, iconClass: "text-v2-primary", surface: "bg-v2-surface-soft" },
  insufficient: { icon: DatabaseZap, iconClass: "text-v2-warning-text", surface: "bg-v2-warning-soft" },
  error: { icon: AlertCircle, iconClass: "text-v2-critical-text", surface: "bg-v2-critical-soft" },
  history: { icon: History, iconClass: "text-v2-primary", surface: "bg-v2-primary-soft" },
  stale: { icon: Clock3, iconClass: "text-v2-warning-text", surface: "bg-v2-warning-soft" },
};

export function EmptyState({ variant = "empty", title = "Данных пока нет", description = "Дополнительные сведения появятся после обновления данных.", action, className }: { variant?: EmptyStateVariant; title?: string; description?: string; action?: React.ReactNode; className?: string }) {
  const style = emptyStateStyles[variant];
  const Icon = style.icon;
  return (
    <div className={cn("flex min-h-44 flex-col items-center justify-center rounded-v2-section border border-dashed border-v2-border-strong px-5 py-8 text-center", style.surface, className)}>
      <span className={cn("grid h-10 w-10 place-items-center rounded-v2-control bg-v2-surface", style.iconClass)}><Icon className="h-5 w-5" aria-hidden="true" /></span>
      <p className="mt-4 text-sm font-bold text-v2-text">{title}</p>
      <p className="mt-1 max-w-md text-sm leading-6 text-v2-text-secondary">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export type NoticeTone = "info" | "success" | "warning" | "danger" | "error" | "stale";

export function InlineNotice({ title, description, tone = "info", action, className }: { title: string; description?: string; tone?: NoticeTone; action?: React.ReactNode; className?: string }) {
  const resolved = tone === "error" ? "danger" : tone;
  const toneClass = {
    info: "border-v2-primary/20 bg-v2-info-soft text-v2-primary",
    success: "border-v2-success/20 bg-v2-success-soft text-v2-success-text",
    warning: "border-v2-warning/25 bg-v2-warning-soft text-v2-warning-text",
    stale: "border-v2-warning/25 bg-v2-warning-soft text-v2-warning-text",
    danger: "border-v2-critical/20 bg-v2-critical-soft text-v2-critical-text",
  }[resolved];
  const Icon = resolved === "success" ? CheckCircle2 : resolved === "info" ? Info : resolved === "stale" ? Clock3 : AlertCircle;
  return (
    <div className={cn("flex items-start gap-3 rounded-v2-control border p-4", toneClass, className)} role={resolved === "danger" ? "alert" : resolved === "success" ? "status" : undefined}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{title}</p>
        {description && <p className="mt-1 text-sm leading-5 text-v2-text-secondary">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
