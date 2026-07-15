"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Download, LoaderCircle, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "text" | "destructive" | "danger";
export type ButtonSize = "default" | "compact" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const resolvedVariant = variant === "outline" ? "secondary" : variant === "danger" ? "destructive" : variant;
    const styles = cn(
      "inline-flex max-w-full items-center justify-center gap-2 whitespace-nowrap rounded-v2-control border border-transparent px-4 text-sm font-semibold",
      "transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-100 ease-out",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary focus-visible:ring-offset-2 focus-visible:ring-offset-v2-surface",
      "active:translate-y-px disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:translate-y-0",
      size === "default" && "min-h-11",
      size === "compact" && "min-h-10 px-3 max-sm:min-h-11",
      size === "icon" && "h-11 min-h-11 w-11 min-w-11 p-0",
      resolvedVariant === "primary" && "bg-v2-primary text-white hover:bg-v2-primary-hover active:bg-v2-primary-active",
      resolvedVariant === "secondary" && "border-v2-border-strong bg-v2-surface text-v2-text hover:border-v2-primary hover:bg-v2-primary-soft",
      resolvedVariant === "ghost" && "bg-transparent text-v2-text hover:bg-v2-surface-soft",
      resolvedVariant === "text" && "bg-transparent px-2 text-v2-primary hover:bg-v2-primary-soft hover:text-v2-primary-hover",
      resolvedVariant === "destructive" && "border-v2-critical-text bg-v2-critical-text text-white hover:brightness-95 active:brightness-90",
      className,
    );

    if (asChild && React.isValidElement<{ className?: string; "aria-busy"?: boolean }>(children)) {
      return React.cloneElement(children, {
        className: cn(styles, children.props.className),
        "aria-busy": loading || undefined,
      });
    }

    return (
      <button ref={ref} className={styles} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
        {loading && <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export type ExportActionState = "idle" | "loading" | "success" | "error" | "disabled";

export interface ExportActionProps {
  state?: ExportActionState;
  scopeLabel?: string;
  onAction?: () => void | Promise<void>;
  className?: string;
  message?: string;
}

const exportLabels: Record<ExportActionState, string> = {
  idle: "Экспортировать",
  loading: "Подготовка…",
  success: "Экспорт подготовлен",
  error: "Повторить экспорт",
  disabled: "Экспорт недоступен",
};

export function ExportAction({ state, scopeLabel, onAction, className, message }: ExportActionProps) {
  const [internalState, setInternalState] = React.useState<ExportActionState>("idle");
  const [internalMessage, setInternalMessage] = React.useState<string>();
  const resolvedState = state ?? internalState;
  const disabled = resolvedState === "disabled" || resolvedState === "loading";
  const Icon = resolvedState === "loading" ? LoaderCircle : resolvedState === "success" ? CheckCircle2 : resolvedState === "error" ? AlertCircle : Download;
  const feedback = message ?? internalMessage ?? (resolvedState === "error" ? "Не удалось подготовить файл." : resolvedState === "success" ? "Файл готов к сохранению." : undefined);

  const runAction = async () => {
    if (!onAction) return;
    if (state === undefined) {
      setInternalState("loading");
      setInternalMessage(undefined);
    }
    try {
      await onAction();
      if (state === undefined) setInternalState("success");
    } catch (error) {
      if (state === undefined) {
        setInternalState("error");
        setInternalMessage(error instanceof Error ? error.message : "Не удалось подготовить файл.");
      }
    }
  };

  return (
    <div className={cn("inline-flex min-w-0 flex-col items-start gap-1", className)}>
      <Button type="button" variant="secondary" size="compact" disabled={disabled} loading={resolvedState === "loading"} onClick={() => void runAction()}>
        {resolvedState !== "loading" && <Icon className="h-4 w-4" aria-hidden="true" />}
        <span>{exportLabels[resolvedState]}</span>
        {scopeLabel && resolvedState === "idle" && <span className="font-normal text-v2-text-secondary">· {scopeLabel}</span>}
      </Button>
      {feedback && (
        <span className={cn("text-xs", resolvedState === "error" ? "text-v2-critical-text" : "text-v2-text-secondary")} role={resolvedState === "error" ? "alert" : "status"}>
          {feedback}
        </span>
      )}
    </div>
  );
}

export interface OverflowActionItem {
  id: string;
  label: string;
  onSelect?: () => void | Promise<void>;
  icon?: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
}

export interface OverflowActionsProps {
  items: OverflowActionItem[];
  label?: string;
  className?: string;
  disabled?: boolean;
  onActionError?: (message: string) => void;
}

export function OverflowActions({ items, label = "Другие действия", className, disabled = false, onActionError }: OverflowActionsProps) {
  const [open, setOpen] = React.useState(false);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const menuId = React.useId();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const focusFrame = window.requestAnimationFrame(() => {
      rootRef.current?.querySelector<HTMLButtonElement>("[role='menuitem']")?.focus();
    });
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const availableItems = items.filter((item) => item.onSelect && !item.disabled);
  if (!availableItems.length) return null;

  const moveFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const actions = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
    if (!actions.length) return;
    const current = actions.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Home") actions[0]?.focus();
    else if (event.key === "End") actions.at(-1)?.focus();
    else {
      const direction = event.key === "ArrowDown" ? 1 : -1;
      actions[(current + direction + actions.length) % actions.length]?.focus();
    }
  };

  const runItem = async (item: OverflowActionItem) => {
    if (!item.onSelect) return;
    setLoadingId(item.id);
    try {
      await item.onSelect();
      setOpen(false);
      triggerRef.current?.focus();
    } catch (error) {
      onActionError?.(error instanceof Error ? error.message : "Не удалось выполнить действие");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <Button
        ref={triggerRef}
        type="button"
        variant="secondary"
        size="compact"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled || loadingId !== null}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !open) {
            event.preventDefault();
            setOpen(true);
            window.requestAnimationFrame(() => {
              const actions = rootRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']");
              (event.key === "ArrowDown" ? actions?.[0] : actions?.[actions.length - 1])?.focus();
            });
          }
        }}
      >
        <MoreVertical className="h-4 w-4" aria-hidden="true" />
        {label}
      </Button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={moveFocus}
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-56 rounded-v2-overlay border border-v2-border bg-v2-surface p-2 shadow-v2-dropdown"
        >
          {availableItems.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={loadingId !== null}
              aria-busy={loadingId === item.id || undefined}
              onClick={() => void runItem(item)}
              className={cn(
                "flex min-h-10 w-full items-center gap-2 rounded-v2-control px-3 py-2 text-left text-sm font-medium max-sm:min-h-11",
                "transition-colors duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary motion-reduce:transition-none",
                "disabled:pointer-events-none disabled:text-v2-text-disabled",
                item.destructive ? "text-v2-critical-text hover:bg-v2-critical-soft" : "text-v2-text hover:bg-v2-surface-soft",
              )}
            >
              {loadingId === item.id ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : item.icon && <span aria-hidden="true">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
