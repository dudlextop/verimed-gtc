"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, Building2, ChevronRight, CircleUserRound, ClipboardCheck, FileCheck2, FlaskConical, History, Menu, Network, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const main = [
  ["/", "Сводная аналитика", BarChart3],
  ["/organizations", "Медицинские организации", Building2],
  ["/signals", "Проверка", ClipboardCheck],
  ["/patterns", "Повторяющиеся модели", Network],
] as const;
const expertWork = [["/reviews", "Результаты экспертной оценки", FileCheck2], ["/decision-journal", "Журнал решений", History]] as const;
const secondary = [["/methodology", "Методика анализа", FlaskConical]] as const;

function NavLink({ item, onNavigate }: { item: readonly [string, string, typeof Activity]; onNavigate: () => void }) {
  const pathname = usePathname();
  const [href, label, Icon] = item;
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return <Link href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn(
    "group relative flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-[background-color,color,transform] duration-100 ease-out focus-visible:ring-2 focus-visible:ring-white/80 active:translate-y-px motion-reduce:transition-none",
    active ? "bg-white/[0.11] text-white shadow-[inset_0_0_0_1px_rgb(255_255_255_/.07)]" : "text-navigation-muted hover:bg-white/[0.065] hover:text-white",
  )}>
    {active && <span className="absolute inset-y-2 -left-1 w-0.5 rounded-full bg-gradient-to-b from-violet-300 to-cyan-300" aria-hidden="true"/>}
    <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors duration-100", active ? "bg-white/10 text-violet-200" : "text-slate-400 group-hover:bg-white/5 group-hover:text-slate-200")}><Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden="true"/></span>
    <span className="min-w-0 flex-1 leading-5">{label}</span>
    {active && <ChevronRight className="h-4 w-4 text-cyan-200" aria-hidden="true"/>}
  </Link>;
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="fixed left-4 top-4 z-30 grid h-11 w-11 place-items-center rounded-md bg-navigation text-white shadow-raised focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:hidden" aria-label="Открыть навигацию"><Menu className="h-5 w-5" aria-hidden="true"/></button>
    {open && <button type="button" className="fixed inset-0 z-30 bg-navigation/45 backdrop-blur-sm lg:hidden" onClick={close} aria-label="Закрыть навигацию"/>}
    <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-[17rem] flex-col overflow-hidden bg-navigation px-3.5 py-4 text-white shadow-[12px_0_42px_-32px_rgb(11_22_50_/.7)] transition-transform duration-200 ease-out motion-reduce:transition-none lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" aria-hidden="true"/>
      <div className="relative mb-6 flex items-center gap-3 px-2 py-1">
        <div className="relative grid h-11 w-11 place-items-center rounded-lg border border-white/15 bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-500 shadow-[0_12px_32px_-18px_rgb(92_84_241)]"><ShieldCheck className="h-6 w-6" aria-hidden="true"/><span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-300 ring-2 ring-navigation"/></div>
        <div className="min-w-0"><p className="text-xl font-bold tracking-[-0.035em]">Verimed</p><p className="mt-0.5 text-[0.6875rem] leading-4 text-navigation-muted">Контроль медицинских услуг</p></div>
        <button type="button" onClick={close} className="ml-auto grid h-10 w-10 place-items-center rounded-md text-navigation-muted hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white lg:hidden" aria-label="Закрыть навигацию"><X className="h-5 w-5" aria-hidden="true"/></button>
      </div>
      <nav aria-label="Основная навигация" className="relative space-y-1">{main.map(item => <NavLink key={item[0]} item={item} onNavigate={close}/>)}</nav>
      <div className="relative mt-5 border-t border-white/[0.08] pt-4"><p className="px-3 pb-2 text-[0.625rem] font-bold uppercase tracking-[0.16em] text-slate-500">Экспертная работа</p><nav aria-label="Экспертная работа" className="space-y-1">{expertWork.map(item => <NavLink key={item[0]} item={item} onNavigate={close}/>)}</nav></div>
      <div className="relative mt-auto border-t border-white/[0.08] pt-4"><nav aria-label="Дополнительная навигация" className="space-y-1">{secondary.map(item => <NavLink key={item[0]} item={item} onNavigate={close}/>)}</nav><Link href="/profile" onClick={close} className="mt-3 flex min-h-14 items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.045] px-3 transition-colors duration-100 hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-white"><span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet-400/25 to-cyan-300/15 text-violet-100"><CircleUserRound className="h-5 w-5" aria-hidden="true"/></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">Айдана Сарсенова</span><span className="block text-xs text-navigation-muted">Ведущий эксперт</span></span></Link></div>
    </aside>
  </>;
}
