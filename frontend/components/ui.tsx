import * as React from "react";
import { AlertCircle, ArrowRight, CheckCircle2, CircleDollarSign, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; asChild?: boolean; size?: "default" | "icon" }>(
  ({ className, variant = "primary", asChild = false, size = "default", children, ...props }, ref) => {
    const styles = cn(
      "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-[transform,background-color,border-color,color,box-shadow] duration-100 ease-out focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:translate-y-0",
      size === "icon" && "min-w-10 px-2",
      variant === "primary" && "bg-primary text-primary-foreground shadow-[0_8px_24px_-14px_hsl(var(--primary)/.8)] hover:bg-[hsl(var(--primary-hover))]",
      variant === "secondary" && "border border-border/80 bg-secondary text-secondary-foreground hover:border-primary/20 hover:bg-primary/10",
      variant === "outline" && "border border-border-strong bg-card text-foreground hover:border-primary/35 hover:bg-surface-tint",
      variant === "ghost" && "text-foreground hover:bg-muted",
      variant === "danger" && "border border-danger/25 bg-danger-soft text-danger hover:bg-danger/15",
      className,
    );
    if (asChild && React.isValidElement<{className?: string}>(children)) return React.cloneElement(children, {className: cn(styles, children.props.className)});
    return <button ref={ref} className={styles} {...props}>{children}</button>;
  },
);
Button.displayName = "Button";

export function Card({ className, variant = "surface", ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: "surface" | "elevated" | "soft" | "flat" }) {
  return <div className={cn(
    "rounded-lg text-card-foreground",
    variant === "surface" && "border border-border/80 bg-card shadow-card",
    variant === "elevated" && "border border-primary/10 bg-surface-raised shadow-raised",
    variant === "soft" && "bg-surface-soft",
    variant === "flat" && "border border-border/80 bg-surface-raised",
    className,
  )} {...props} />;
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex min-h-7 items-center gap-1.5 rounded-full border border-transparent bg-muted px-2.5 text-xs font-semibold leading-none", className)}>{children}</span>;
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn("filter-field w-full", className)} {...props} />,
);
Input.displayName = "Input";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("filter-field", className)} {...props} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-gradient-to-r from-muted via-surface-raised to-muted bg-[length:220%_100%] motion-reduce:animate-none", className)} />;
}

export function SectionHeader({ eyebrow, title, description, action, className }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}><div className="min-w-0">{eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}<h2 className="section-title">{title}</h2>{description && <p className="section-description">{description}</p>}</div>{action}</div>;
}

export function MetricCard({ label, value, detail, icon: Icon, tone = "neutral", prominent = false, className }: { label: string; value: string; detail?: string; icon?: typeof CircleDollarSign; tone?: "neutral" | "priority" | "finance" | "importance" | "stability"; prominent?: boolean; className?: string }) {
  const tones = { neutral: "bg-surface-raised text-primary", priority: "bg-priority-soft text-priority", finance: "bg-finance-soft text-finance", importance: "bg-importance-soft text-importance", stability: "bg-stability-soft text-stability" };
  return <Card variant={prominent ? "elevated" : "flat"} className={cn("min-w-0 p-4 md:p-5", prominent && "bg-gradient-to-br from-priority-soft via-card to-card", className)}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="metric-label">{label}</p><p className={cn("mt-2 break-words font-mono font-bold tracking-[-0.035em] tabular-nums", prominent ? "text-3xl md:text-4xl" : "text-2xl")}>{value}</p></div>{Icon && <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-md", tones[tone])}><Icon className="h-5 w-5" aria-hidden="true"/></span>}</div>{detail && <p className="mt-3 text-xs leading-5 text-muted-foreground">{detail}</p>}</Card>;
}

export function FinancialValue({ value, label, compact = false }: { value: string; label?: string; compact?: boolean }) {
  return <span className="inline-flex min-w-0 items-center gap-2 text-finance"><CircleDollarSign className="h-4 w-4 shrink-0" aria-hidden="true"/><span className="min-w-0">{label && <span className="block text-[0.6875rem] font-semibold text-muted-foreground">{label}</span>}<span className={cn("block font-mono font-bold tabular-nums", compact ? "text-sm" : "text-base")}>{value}</span></span></span>;
}

export function InlineNotice({ title, description, tone = "info", action }: { title: string; description?: string; tone?: "info" | "success" | "warning" | "danger"; action?: React.ReactNode }) {
  const toneClass = { info: "border-info/15 bg-info-soft text-info", success: "border-success/15 bg-success-soft text-success", warning: "border-warning/20 bg-warning-soft text-amber-900", danger: "border-danger/15 bg-danger-soft text-danger" }[tone];
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;
  return <div className={cn("flex items-start gap-3 rounded-md border p-4", toneClass)}><Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true"/><div className="min-w-0 flex-1"><p className="text-sm font-bold">{title}</p>{description && <p className="mt-1 text-sm leading-5 text-foreground/75">{description}</p>}</div>{action}</div>;
}

export function EmptyState({ title = "Данных пока нет", description, action }: { title?: string; description: string; action?: React.ReactNode }) {
  return <div className="flex min-h-44 flex-col items-center justify-center rounded-lg border border-dashed border-border-strong/80 bg-surface-soft/65 px-5 py-8 text-center"><span className="grid h-10 w-10 place-items-center rounded-full bg-card text-muted-foreground shadow-sm"><Inbox className="h-5 w-5" aria-hidden="true"/></span><p className="mt-4 text-sm font-bold">{title}</p><p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

export function DataPanel({ title, description, action, children, className }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <Card className={cn("overflow-hidden", className)}><div className="border-b border-border/70 px-5 py-4 md:px-6"><SectionHeader title={title} description={description} action={action}/></div><div className="p-5 md:p-6">{children}</div></Card>;
}

export function StickyActionBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("sticky-workbar sticky bottom-0 z-30 -mx-4 mt-6 px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] md:-mx-6 md:px-6 lg:mx-0 lg:rounded-lg lg:border lg:px-4", className)}>{children}</div>;
}

export function InlineLinkCue() { return <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true"/>; }
