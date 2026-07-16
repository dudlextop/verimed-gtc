import Image from "next/image";
import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandLogo({ className, size = "default", priority = false }: { className?: string; size?: "small" | "default" | "large"; priority?: boolean }) {
  return (
    <Image
      src="/brand/verimed-logo@2x.png"
      width={436}
      height={112}
      unoptimized
      priority={priority}
      alt="Verimed"
      className={cn("h-auto object-contain object-left", size === "small" && "w-[136px]", size === "default" && "w-[172px]", size === "large" && "w-[218px]", className)}
    />
  );
}

export function Card({ className, variant = "surface", ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: "surface" | "elevated" | "soft" | "flat" }) {
  return (
    <div
      className={cn(
        "rounded-v2-card text-v2-text",
        variant === "surface" && "border border-v2-border bg-v2-surface",
        variant === "elevated" && "border border-v2-border bg-v2-surface shadow-v2-panel",
        variant === "soft" && "bg-v2-surface-soft",
        variant === "flat" && "border border-v2-border bg-v2-surface",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex min-h-7 items-center gap-1.5 rounded-full border border-v2-border bg-v2-surface-soft px-2.5 text-xs font-semibold leading-none text-v2-text-secondary", className)}>{children}</span>;
}

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, meta, primaryAction, secondaryActions, action, className }: PageHeaderProps) {
  const legacyAction = action && !primaryAction ? action : undefined;
  return (
    <header className={cn("mb-7 flex flex-col gap-5 border-b border-v2-border pb-6 xl:flex-row xl:items-end xl:justify-between", className)}>
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-v2-primary">{eyebrow}</p>}
        <h1 className="text-[clamp(1.75rem,3vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.035em] text-v2-text">{title}</h1>
        {description && <p className="mt-3 max-w-[72ch] text-[0.9375rem] leading-6 text-v2-text-secondary">{description}</p>}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-v2-text-secondary">{meta}</div>}
      </div>
      {(primaryAction || secondaryActions || legacyAction) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {secondaryActions}
          {legacyAction}
          {primaryAction}
        </div>
      )}
    </header>
  );
}

export function SectionHeader({ id, eyebrow, title, description, action, className }: { id?: string; eyebrow?: string; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-v2-primary">{eyebrow}</p>}
        <h2 id={id} className="text-lg font-bold leading-[1.3] tracking-[-0.015em] text-v2-text md:text-xl">{title}</h2>
        {description && <p className="mt-1.5 max-w-[72ch] text-sm leading-6 text-v2-text-secondary">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function MetricStrip({ children, className, label = "Ключевые показатели" }: { children: React.ReactNode; className?: string; label?: string }) {
  return (
    <section aria-label={label} className={cn("grid overflow-hidden rounded-v2-section border border-v2-border bg-v2-surface sm:grid-cols-2 xl:grid-cols-4", className)}>
      {children}
    </section>
  );
}

export interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  detail?: string;
  icon?: LucideIcon;
  tone?: "neutral" | "priority" | "risk" | "finance" | "importance" | "stability";
  variant?: "leading" | "compact" | "inline";
  prominent?: boolean;
  className?: string;
}

const metricTones: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  neutral: "bg-v2-primary-soft text-v2-primary",
  priority: "bg-v2-critical-soft text-v2-critical-text",
  risk: "bg-v2-high-soft text-v2-high-text",
  finance: "bg-v2-teal-soft text-v2-teal-text",
  importance: "bg-v2-primary-soft text-v2-primary-active",
  stability: "bg-v2-cyan-soft text-v2-cyan-text",
};

export function MetricCard({ label, value, detail, icon: Icon, tone = "neutral", variant = "compact", prominent = false, className }: MetricCardProps) {
  const resolvedVariant = prominent ? "leading" : variant;
  return (
    <div className={cn("min-w-0 border-b border-v2-border p-4 last:border-b-0 sm:border-r sm:last:border-r-0 xl:border-b-0 md:p-5", resolvedVariant === "inline" && "p-3 md:p-3", className)}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-5 text-v2-text-secondary">{label}</p>
          <p className={cn("v2-tabular mt-1.5 break-words font-bold leading-tight tracking-[-0.03em] text-v2-text", resolvedVariant === "leading" ? "text-3xl md:text-4xl" : resolvedVariant === "inline" ? "text-xl" : "text-2xl")}>{value}</p>
        </div>
        {Icon && <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-v2-control", metricTones[tone])}><Icon className="h-5 w-5" aria-hidden="true" /></span>}
      </div>
      {detail && <p className="mt-2 text-xs leading-5 text-v2-text-secondary">{detail}</p>}
    </div>
  );
}

export interface DataPanelProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  nested?: boolean;
  className?: string;
}

export function DataPanel({ title, description, action, children, footer, nested = false, className }: DataPanelProps) {
  return (
    <section className={cn("overflow-hidden rounded-v2-section", nested ? "bg-v2-surface-soft" : "border border-v2-border bg-v2-surface", className)}>
      {(title || description || action) && <div className="border-b border-v2-border px-5 py-4 md:px-6"><SectionHeader title={title ?? ""} description={description} action={action} /></div>}
      <div className="p-5 md:p-6">{children}</div>
      {footer && <footer className="border-t border-v2-border px-5 py-4 md:px-6">{footer}</footer>}
    </section>
  );
}

export function StickyActionBar({ primaryAction, secondaryActions, overflowAction, children, className }: { primaryAction?: React.ReactNode; secondaryActions?: React.ReactNode; overflowAction?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("sticky bottom-0 z-30 -mx-4 mt-6 border-t border-v2-border bg-v2-surface/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-v2-sticky backdrop-blur md:-mx-6 md:px-6 lg:mx-0 lg:rounded-v2-section lg:border", className)}>
      {children ?? <div className="flex flex-wrap items-center justify-end gap-2"><div className="hidden flex-wrap items-center gap-2 sm:flex">{secondaryActions}</div>{primaryAction}{overflowAction}</div>}
    </div>
  );
}

export function InlineLinkCue() {
  return <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />;
}
