"use client";

import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Database,
  Scale,
  SearchCheck,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Methodology } from "@/lib/types";
import { useApi } from "@/hooks/use-api";
import {
  Button,
  DataPanel,
  EmptyState,
  InlineNotice,
  PageHeader,
  PageSkeleton,
  SectionHeader,
} from "@/components/foundation";

const STAGES = [
  { key: "Сопоставимые группы", title: "Подготовка и сопоставление данных", icon: Database },
  { key: "Проверяемые отклонения", title: "Выявление проверяемых отклонений", icon: SearchCheck },
  { key: "Формирование оценки", title: "Формирование оценки", icon: Scale },
  { key: "Роль специалиста", title: "Экспертная проверка и решение", icon: Users },
] as const;

export default function MethodologyPage() {
  const state = useApi(api.methodology, []);
  const header = <PageHeader eyebrow="Прозрачность системы" title={state.data?.title ?? "Методика анализа"} description={state.data?.introduction ?? "Как Verimed формирует объяснимые основания для экспертной проверки."} />;

  if (state.loading) return <div className="page-shell">{header}<PageSkeleton variant="detail" /></div>;
  if (state.error || !state.data) {
    return (
      <div className="page-shell">
        {header}
        <EmptyState variant="error" title="Не удалось загрузить методику" description="Проверьте соединение и повторите попытку." action={<Button variant="secondary" onClick={() => void state.retry()}>Повторить</Button>} />
      </div>
    );
  }

  return (
    <div className="page-shell" data-testid="methodology-page">
      {header}
      <MethodologyStages data={state.data} />
      <MethodologyQuality data={state.data} />
      <InlineNotice
        className="mt-5"
        tone="warning"
        title="Важное ограничение"
        description={state.data.disclaimer}
      />
    </div>
  );
}

function MethodologyStages({ data }: { data: Methodology }) {
  const available = new Map(data.sections.map((section) => [section.title, section]));
  return (
    <section aria-labelledby="methodology-stages-title">
      <SectionHeader
        id="methodology-stages-title"
        title="Как проходит анализ"
        description="Четыре последовательных этапа отделяют подготовку данных, аналитический расчёт и решение специалиста."
      />
      <ol className="mt-5 overflow-hidden rounded-v2-section border border-v2-border bg-v2-surface">
        {STAGES.map((stage, index) => {
          const section = available.get(stage.key);
          const Icon = stage.icon;
          if (!section) return null;
          return (
            <li key={stage.key} className="grid gap-4 border-b border-v2-border p-5 last:border-b-0 md:grid-cols-[3rem_minmax(0,1fr)] md:p-6">
              <div className="grid h-11 w-11 place-items-center rounded-v2-control bg-v2-primary-soft text-v2-primary" aria-hidden="true">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="v2-tabular grid h-7 w-7 shrink-0 place-items-center rounded-full bg-v2-primary text-xs font-bold text-white">{index + 1}</span>
                  <h2 className="text-lg font-bold tracking-[-0.015em] text-v2-text">{stage.title}</h2>
                </div>
                <p className="mt-2 text-sm font-semibold text-v2-text">{section.title}</p>
                <p className="mt-1 max-w-[72ch] text-sm leading-6 text-v2-text-secondary">{section.description}</p>
                <details className="mt-3 rounded-v2-control border border-v2-border bg-v2-surface-soft">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-v2-control px-4 text-sm font-semibold text-v2-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary">
                    Подробности этапа
                    <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </summary>
                  <ul className="space-y-2 border-t border-v2-border px-4 py-3">
                    {section.items.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-v2-text-secondary"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-v2-primary" aria-hidden="true" />{item}</li>)}
                  </ul>
                </details>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function MethodologyQuality({ data }: { data: Methodology }) {
  const quality = data.sections.find((section) => section.title === "Качество текущего анализа");
  if (!quality) return null;
  return (
    <section className="mt-6" aria-labelledby="methodology-quality-title">
      <SectionHeader
        id="methodology-quality-title"
        title="Качество текущего анализа"
        description="Расчёт проверяется на синтетической эталонной разметке. Экспертная обратная связь хранится отдельно от аналитического вывода."
      />
      <DataPanel className="mt-4" title="Как проверяется качество" description={quality.description}>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {quality.items.map((item) => <li key={item} className="flex items-start justify-between gap-4 rounded-v2-control bg-v2-surface-soft p-4 text-sm"><span className="leading-6 text-v2-text-secondary">{item}</span><BarChart3 className="mt-1 h-4 w-4 shrink-0 text-v2-teal" aria-hidden="true" /></li>)}
        </ul>
      </DataPanel>
    </section>
  );
}
