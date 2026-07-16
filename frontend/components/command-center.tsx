import Link from "next/link";
import { ArrowRight, Building2, CircleDollarSign, Clock3, ScanSearch } from "lucide-react";
import type { CommandCenter as CommandCenterData } from "@/lib/types";
import { dateTimeText, money, number } from "@/lib/utils";
import { Button, MetricCard, MetricStrip, SectionHeader } from "@/components/foundation";

export const PRIORITY_QUEUE_URL = "/signals?levels=Критический&levels=Высокий&status=Не%20проверено&sort=priority";

export function CommandCenter({ data }: { data: CommandCenterData }) {
  const leadingLabel = data.comparison_available
    ? "Новых сигналов высокого и критического уровня"
    : "Сигналов высокого и критического уровня";

  return (
    <section
      className="overflow-hidden rounded-v2-section border border-v2-border bg-v2-surface"
      data-testid="command-center"
      data-command-theme="light"
      aria-labelledby="command-center-title"
    >
      <div className="flex flex-col gap-4 border-b border-v2-border px-5 py-5 md:px-6 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeader
          id="command-center-title"
          eyebrow="Рабочий старт"
          title="Требуют внимания"
          description="Приоритет текущего анализа и следующий шаг специалиста."
        />
        <Link
          href="/overview"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-v2-control px-2 text-sm font-semibold text-v2-primary transition-colors duration-100 hover:bg-v2-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary motion-reduce:transition-none"
        >
          Открыть аналитический обзор
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <MetricStrip className="rounded-none border-x-0 border-t-0" label="Показатели, требующие внимания">
        <MetricCard
          variant="leading"
          tone="priority"
          icon={ScanSearch}
          label={leadingLabel}
          value={number(data.new_high_critical_signals)}
          detail="Сигналы требуют экспертной оценки и не являются подтверждённым нарушением."
        />
        <MetricCard
          icon={Building2}
          label="Организации повышенного приоритета"
          value={number(data.high_risk_organizations)}
        />
        <MetricCard
          tone="finance"
          icon={CircleDollarSign}
          label="Потенциальный объём проверки"
          value={money(data.potential_review_amount, true)}
        />
        <MetricCard
          icon={Clock3}
          label="Сигналы без решения"
          value={number(data.signals_without_decision)}
          detail={data.last_analysis_at ? `Анализ обновлён ${dateTimeText(data.last_analysis_at)}` : "Анализ ещё не выполнялся"}
        />
      </MetricStrip>

      <div className="grid gap-4 bg-v2-surface-soft px-5 py-5 md:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-v2-primary">Рекомендуемое действие</p>
          {data.priority_organization ? (
            <>
              <Link
                href={`/organizations/${data.priority_organization.id}`}
                className="mt-2 inline-flex rounded-sm text-lg font-bold leading-6 text-v2-text underline-offset-4 hover:text-v2-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary"
              >
                {data.priority_organization.name}
              </Link>
              <p className="mt-1 text-sm leading-6 text-v2-text-secondary">
                Приоритет {data.priority_organization.priority_score} из 100 · {money(data.priority_organization.review_amount)}. {data.priority_organization.main_reason}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm leading-6 text-v2-text-secondary">
              Откройте очередь и начните с сигналов с наибольшим приоритетом проверки.
            </p>
          )}
        </div>
        <Button asChild>
          <Link href={PRIORITY_QUEUE_URL}>
            Перейти к проверке
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
