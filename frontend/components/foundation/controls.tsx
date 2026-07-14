"use client";

import * as React from "react";
import { Check, RotateCcw, Search as SearchIcon, SlidersHorizontal, X } from "lucide-react";
import { Button } from "./actions";
import { cn } from "@/lib/utils";

const fieldClass = cn(
  "min-h-11 rounded-v2-control border border-v2-border-strong bg-v2-surface px-3 text-[0.9375rem] text-v2-text",
  "placeholder:text-v2-text-secondary hover:border-v2-text-muted",
  "focus-visible:border-v2-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary focus-visible:ring-offset-1",
  "disabled:cursor-not-allowed disabled:bg-v2-surface-soft disabled:text-v2-text-disabled",
  "transition-[background-color,border-color,box-shadow,color] duration-100 ease-out motion-reduce:transition-none",
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(fieldClass, "w-full", className)} {...props} />,
);
Input.displayName = "Input";

export const Search = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <span className="relative block min-w-0">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-v2-text-muted" aria-hidden="true" />
      <input ref={ref} type="search" className={cn(fieldClass, "w-full pl-10", className)} {...props} />
    </span>
  ),
);
Search.displayName = "Search";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => <select ref={ref} className={cn(fieldClass, "min-w-0 pr-9", className)} {...props} />,
);
Select.displayName = "Select";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(fieldClass, "min-h-28 w-full resize-y py-3 leading-6", className)} {...props} />,
);
Textarea.displayName = "Textarea";

export function Checkbox({ label, description, className, id, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; description?: string }) {
  const generatedId = React.useId();
  const controlId = id ?? generatedId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  return (
    <label htmlFor={controlId} className={cn("inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm text-v2-text", className)}>
      <span className="relative grid h-5 w-5 shrink-0 place-items-center">
        <input
          id={controlId}
          aria-describedby={descriptionId}
          className="peer h-5 w-5 appearance-none rounded border border-v2-border-strong bg-v2-surface checked:border-v2-primary checked:bg-v2-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary focus-visible:ring-offset-2"
          {...props}
          type="checkbox"
        />
        <Check className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} aria-hidden="true" />
      </span>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block font-medium">{label}</span>}
          {description && <span id={descriptionId} className="mt-0.5 block text-xs leading-5 text-v2-text-secondary">{description}</span>}
        </span>
      )}
    </label>
  );
}

export interface ActiveFilter {
  id: string;
  label: string;
  onRemove?: () => void;
}

export function ActiveFilterChip({ filter }: { filter: ActiveFilter }) {
  return (
    <span className="inline-flex min-h-8 items-center gap-1 rounded-v2-control border border-v2-border bg-v2-primary-soft pl-2.5 text-xs font-medium text-v2-text">
      {filter.label}
      {filter.onRemove && (
        <button
          type="button"
          onClick={filter.onRemove}
          className="grid h-8 w-8 place-items-center rounded-v2-control text-v2-text-secondary hover:bg-v2-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary max-sm:h-11 max-sm:w-11"
          aria-label={`Удалить фильтр «${filter.label}»`}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

export interface FilterBarProps {
  primary: React.ReactNode;
  advanced?: React.ReactNode;
  activeFilters?: ActiveFilter[];
  activeCount?: number;
  onResetAll?: () => void;
  defaultAdvancedOpen?: boolean;
  className?: string;
}

export function FilterBar({ primary, advanced, activeFilters = [], activeCount, onResetAll, defaultAdvancedOpen = false, className }: FilterBarProps) {
  const [advancedOpen, setAdvancedOpen] = React.useState(defaultAdvancedOpen);
  const advancedId = React.useId();
  const count = activeCount ?? activeFilters.length;

  return (
    <section aria-label="Фильтры" className={cn("rounded-v2-section border border-v2-border bg-v2-surface p-4", className)}>
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{primary}</div>
        <div className="flex flex-wrap items-center gap-2">
          {advanced && (
            <Button
              type="button"
              variant="ghost"
              size="compact"
              aria-expanded={advancedOpen}
              aria-controls={advancedId}
              onClick={() => setAdvancedOpen((value) => !value)}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Дополнительные фильтры{count > 0 ? ` (${count})` : ""}
            </Button>
          )}
          {onResetAll && (
            <Button type="button" variant="text" size="compact" onClick={onResetAll} disabled={count === 0}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Сбросить все
            </Button>
          )}
        </div>
      </div>
      {advanced && advancedOpen && <div id={advancedId} className="mt-4 grid gap-3 border-t border-v2-border pt-4 sm:grid-cols-2 xl:grid-cols-3">{advanced}</div>}
      {activeFilters.length > 0 && <div className="mt-3 flex flex-wrap gap-2 border-t border-v2-border pt-3" aria-label="Применённые фильтры">{activeFilters.map((filter) => <ActiveFilterChip key={filter.id} filter={filter} />)}</div>}
    </section>
  );
}
