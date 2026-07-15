"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CircleUserRound,
  ClipboardCheck,
  FileCheck2,
  FlaskConical,
  History,
  Menu,
  Network,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/foundation";
import { useLocalProfile } from "@/hooks/use-local-profile";
import { cn } from "@/lib/utils";

type NavigationItem = readonly [href: string, label: string, icon: LucideIcon];

const mainNavigation: readonly NavigationItem[] = [
  ["/", "Сводная аналитика", BarChart3],
  ["/organizations", "Медицинские организации", Building2],
  ["/signals", "Проверка", ClipboardCheck],
  ["/patterns", "Повторяющиеся модели", Network],
];

const expertNavigation: readonly NavigationItem[] = [
  ["/reviews", "Результаты экспертной оценки", FileCheck2],
  ["/decision-journal", "Журнал решений", History],
];

const secondaryNavigation: readonly NavigationItem[] = [
  ["/methodology", "Методика анализа", FlaskConical],
];

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function isActiveRoute(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLink({ item, pathname, onNavigate }: { item: NavigationItem; pathname: string; onNavigate?: () => void }) {
  const [href, label, Icon] = item;
  const active = isActiveRoute(pathname, href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex min-h-11 items-center gap-3 rounded-v2-control px-3 py-2 text-sm leading-5 text-v2-text-secondary",
        "motion-safe:transition-colors motion-safe:duration-100 focus-visible:ring-2 focus-visible:ring-v2-primary focus-visible:ring-offset-2 focus-visible:ring-offset-v2-surface",
        active
          ? "bg-v2-selected font-semibold text-v2-primary"
          : "font-medium hover:bg-v2-surface-soft hover:text-v2-text",
      )}
    >
      {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-v2-primary" aria-hidden="true" />}
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-v2-control",
          active ? "bg-v2-surface text-v2-primary" : "text-v2-text-muted group-hover:text-v2-primary",
        )}
      >
        <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">{label}</span>
    </Link>
  );
}

function ProfileTrigger({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const active = isActiveRoute(pathname, "/profile");
  const { profile, source } = useLocalProfile();

  return (
    <Link
      href="/profile"
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative mt-3 flex min-h-16 items-center gap-3 rounded-v2-card border px-3 py-2.5",
        "motion-safe:transition-colors motion-safe:duration-100 focus-visible:ring-2 focus-visible:ring-v2-primary focus-visible:ring-offset-2 focus-visible:ring-offset-v2-surface",
        active
          ? "border-v2-primary bg-v2-selected"
          : "border-v2-border bg-v2-surface hover:border-v2-border-strong hover:bg-v2-surface-soft",
      )}
    >
      {active && <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-v2-primary" aria-hidden="true" />}
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-v2-control bg-v2-primary-soft text-v2-primary">
        {source === "local" ? (
          <span className="text-xs font-bold" aria-hidden="true">{profile.initials}</span>
        ) : (
          <CircleUserRound className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold leading-5 text-v2-text">{profile.displayName}</span>
        <span className="block truncate text-xs leading-5 text-v2-text-secondary">{profile.jobTitle || profile.department}</span>
      </span>
    </Link>
  );
}

function NavigationContent({ pathname, onNavigate, onClose }: { pathname: string; onNavigate?: () => void; onClose?: () => void }) {
  return (
    <div className="flex min-h-full flex-col px-4 pb-4 pt-5">
      <div className="flex min-h-12 items-center gap-3 px-2">
        <Link
          href="/"
          onClick={onNavigate}
          className="inline-flex min-h-11 items-center rounded-v2-control focus-visible:ring-2 focus-visible:ring-v2-primary focus-visible:ring-offset-2 focus-visible:ring-offset-v2-surface"
          aria-label="Verimed — на сводную аналитику"
        >
          <BrandLogo size="default" priority />
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-v2-control text-v2-text-secondary motion-safe:transition-colors motion-safe:duration-100 hover:bg-v2-surface-soft hover:text-v2-text focus-visible:ring-2 focus-visible:ring-v2-primary focus-visible:ring-offset-2 focus-visible:ring-offset-v2-surface"
            aria-label="Закрыть навигацию"
            data-navigation-close
          >
            <X className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="mt-6 flex flex-1 flex-col">
        <nav aria-label="Основная навигация" className="space-y-1">
          {mainNavigation.map((item) => <NavigationLink key={item[0]} item={item} pathname={pathname} onNavigate={onNavigate} />)}
        </nav>

        <div className="mt-5 border-t border-v2-border pt-4">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-v2-text-secondary">Экспертная работа</p>
          <nav aria-label="Экспертная работа" className="space-y-1">
            {expertNavigation.map((item) => <NavigationLink key={item[0]} item={item} pathname={pathname} onNavigate={onNavigate} />)}
          </nav>
        </div>

        <div className="mt-auto border-t border-v2-border pt-4">
          <nav aria-label="Дополнительная навигация" className="space-y-1">
            {secondaryNavigation.map((item) => <NavigationLink key={item[0]} item={item} pathname={pathname} onNavigate={onNavigate} />)}
          </nav>
          <ProfileTrigger pathname={pathname} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : menuButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const sheet = sheetRef.current;
    const closeButton = sheet?.querySelector<HTMLElement>("[data-navigation-close]");
    closeButton?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== "Tab" || !sheet) return;
      const focusable = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !sheet.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !sheet.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center border-b border-v2-border bg-v2-surface px-4 md:px-6 xl:hidden">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setOpen(true)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-v2-control text-v2-text motion-safe:transition-colors motion-safe:duration-100 hover:bg-v2-surface-soft focus-visible:ring-2 focus-visible:ring-v2-primary focus-visible:ring-offset-2 focus-visible:ring-offset-v2-surface"
          aria-label="Открыть навигацию"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls="mobile-navigation"
        >
          <Menu className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
        </button>
        <Link
          href="/"
          className="ml-3 inline-flex min-h-11 items-center rounded-v2-control focus-visible:ring-2 focus-visible:ring-v2-primary focus-visible:ring-offset-2 focus-visible:ring-offset-v2-surface"
          aria-label="Verimed — на сводную аналитику"
        >
          <BrandLogo size="small" priority />
        </Link>
      </header>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[16.5rem] overflow-y-auto border-r border-v2-border bg-v2-surface xl:block" aria-label="Боковая панель">
        <NavigationContent pathname={pathname} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button
            type="button"
            tabIndex={-1}
            className="v2-mobile-navigation-overlay absolute inset-0 bg-v2-overlay backdrop-blur-[2px]"
            onClick={close}
            aria-hidden="true"
          />
          <aside
            ref={sheetRef}
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Навигация"
            className="v2-mobile-navigation-sheet absolute inset-y-0 left-0 w-[calc(100%_-_1rem)] max-w-sm overflow-y-auto border-r border-v2-border bg-v2-surface shadow-v2-panel"
          >
            <NavigationContent pathname={pathname} onNavigate={close} onClose={close} />
          </aside>
        </div>
      )}
    </>
  );
}
