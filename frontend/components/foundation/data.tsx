import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DataTableColumn {
  id: string;
  label: string;
  header?: React.ReactNode;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  sortDirection?: "ascending" | "descending";
  onSort?: () => void;
  className?: string;
}

export interface DataTableShellProps {
  columns: DataTableColumn[];
  children: React.ReactNode;
  mobileContent?: React.ReactNode;
  caption?: string;
  className?: string;
  tableClassName?: string;
}

export function DataTableShell({ columns, children, mobileContent, caption, className, tableClassName }: DataTableShellProps) {
  return (
    <div className={cn("min-w-0", className)}>
      {mobileContent && <div className="space-y-3 lg:hidden">{mobileContent}</div>}
      <div className={cn("overflow-x-auto rounded-v2-section border border-v2-border bg-v2-surface", mobileContent && "hidden lg:block")}>
        <table className={cn("v2-data-table w-full min-w-[42rem] border-separate border-spacing-0", tableClassName)}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="sticky top-0 z-10 bg-v2-surface-soft">
            <tr>
              {columns.map((column) => {
                const SortIcon = column.sortDirection === "ascending" ? ArrowUp : column.sortDirection === "descending" ? ArrowDown : ArrowUpDown;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={column.sortable ? column.sortDirection ?? "none" : undefined}
                    className={cn(
                      "h-12 border-b border-v2-border px-4 text-xs font-semibold uppercase tracking-[0.06em] text-v2-text-secondary",
                      column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left",
                      column.className,
                    )}
                  >
                    {column.sortable && column.onSort ? (
                      <button
                        type="button"
                        onClick={column.onSort}
                        className={cn(
                          "inline-flex min-h-10 items-center gap-1.5 rounded-v2-control px-1.5 text-left",
                          "hover:bg-v2-primary-soft hover:text-v2-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary",
                          column.align === "right" && "ml-auto",
                        )}
                        aria-label={`Сортировать по столбцу «${column.label}»`}
                      >
                        {column.label}
                        <SortIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    ) : column.header ?? column.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function DataTableRow({ selected = false, className, ...props }: React.HTMLAttributes<HTMLTableRowElement> & { selected?: boolean }) {
  return <tr data-selected={selected || undefined} aria-selected={selected || undefined} className={cn("h-16 bg-v2-surface text-sm text-v2-text", className)} {...props} />;
}

export function DataTableCell({ className, clamp = false, children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { clamp?: boolean }) {
  return <td className={cn("border-t border-v2-border px-4 py-3 align-middle text-sm", clamp && "max-w-72", className)} {...props}>{clamp ? <span className="line-clamp-2">{children}</span> : children}</td>;
}

export interface MobileObjectCardProps {
  title: string;
  context?: string;
  indicator?: React.ReactNode;
  financial?: React.ReactNode;
  period?: string;
  status?: React.ReactNode;
  reason?: string;
  href?: string;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}

export function MobileObjectCard({ title, context, indicator, financial, period, status, reason, href, onClick, selected = false, className }: MobileObjectCardProps) {
  const content = (
    <>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {indicator && <div className="mb-2">{indicator}</div>}
          <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-v2-text">{title}</h3>
          {context && <p className="mt-1 line-clamp-1 text-sm text-v2-text-secondary">{context}</p>}
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-v2-primary" aria-hidden="true" />
      </div>
      {(financial || period || status) && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-v2-border pt-3"><span className="v2-tabular text-sm font-semibold text-v2-teal">{financial ?? period}</span>{status}</div>}
      {reason && <p className="mt-3 line-clamp-2 text-xs leading-5 text-v2-text-secondary">{reason}</p>}
    </>
  );
  const styles = cn(
    "block w-full rounded-v2-card border bg-v2-surface p-4 text-left",
    "transition-[background-color,border-color,box-shadow] duration-100 ease-out hover:border-v2-primary hover:bg-v2-primary-soft",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary focus-visible:ring-offset-2 motion-reduce:transition-none",
    selected ? "border-v2-primary bg-v2-selected shadow-v2-dropdown" : "border-v2-border",
    className,
  );
  if (href) return <a href={href} className={styles} aria-current={selected ? "true" : undefined}>{content}</a>;
  if (onClick) return <button type="button" onClick={onClick} className={styles} aria-pressed={selected}>{content}</button>;
  return <article className={styles}>{content}</article>;
}
