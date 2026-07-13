"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Database,
  FileSearch,
  Flag,
  Layers3,
  Network,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import type { AnalyticsChanges, PatternChanges, RecurringPattern } from "@/lib/types";
import { dateTimeText, money, number, percent, plural } from "@/lib/utils";
import { isAnalysisStale } from "@/lib/overview";
import { ErrorState } from "@/components/data-state";
import { ImportanceBadge } from "@/components/pattern-badges";
import { PriorityBadge } from "@/components/priority-badge";
import { FinancialValue, Skeleton } from "@/components/ui";
import { OverviewActions } from "@/components/overview-actions";
import { PRIORITY_QUEUE_URL } from "@/components/command-center";

const SYNTHETIC_DATA_NOTE = "Показатели рассчитаны на воспроизводимом синтетическом наборе с известной эталонной разметкой.";

async function loadAllPatterns(): Promise<RecurringPattern[]> {
  const first = await api.patterns("page=1&page_size=100&sort=importance");
  const pageCount = Math.ceil(first.total / first.page_size);
  if (pageCount <= 1) return first.items;
  const rest = await Promise.all(Array.from({length: pageCount - 1}, (_, index) => api.patterns(`page=${index + 2}&page_size=100&sort=importance`)));
  return [first, ...rest].flatMap(page => page.items);
}

function OverviewPage() {
  const summary = useApi(api.summary);
  const command = useApi(api.commandCenter);
  const changes = useApi(api.changes);
  const financial = useApi(api.financialImpact);
  const priorities = useApi(api.prioritySummary);
  const patternSummary = useApi(api.patternSummary);
  const patternChanges = useApi(api.patternChanges);
  const patterns = useApi(loadAllPatterns);
  const quality = useApi(api.analysisMetrics);
  const expert = useApi(api.expertReviewSummary);

  const requests = [summary, command, changes, financial, priorities, patternSummary, patternChanges, patterns, quality, expert];
  if (requests.some(request => request.loading)) return <OverviewLoading/>;
  const error = requests.find(request => request.error)?.error;
  if (error || !summary.data || !command.data || !changes.data || !financial.data || !priorities.data || !patternSummary.data || !patternChanges.data || !patterns.data || !quality.data || !expert.data) {
    return <div className="overview-shell"><ErrorState message={error ?? "Ответ сервиса неполон"} retry={() => requests.forEach(request => void request.retry())}/></div>;
  }

  const analysis = summary.data.analysis;
  const selectedCount = quality.data.true_positive_count + quality.data.false_positive_count;
  const reviewAmount = financial.data.period?.signal_services_amount ?? command.data.potential_review_amount;
  const stale = isAnalysisStale(command.data.last_analysis_at);
  const topOrganization = priorities.data.top_organization ?? command.data.priority_organization;
  const topSignal = priorities.data.top_signal ?? command.data.top_financial_signal;
  const topPattern = patternSummary.data.top_importance_pattern;
  const distribution = patternDistribution(patterns.data);
  const systemFindings = [
    {
      icon: Network,
      title: "Устойчивые модели",
      text: `${number(patternSummary.data.high_stability_patterns)} повторяющихся моделей имеют высокую или очень высокую устойчивость.`,
      href: "/patterns?sort=stability",
    },
    {
      icon: UsersRound,
      title: "Связанные пациенты",
      text: `${number(patternSummary.data.affected_patients)} пациентов связаны с повторяющимися моделями текущего анализа.`,
      href: "/patterns",
    },
    {
      icon: Building2,
      title: "Фокус проверки",
      text: topOrganization ? `${topOrganization.name} имеет наибольший текущий приоритет — ${topOrganization.priority_score} из 100.` : "Приоритетная организация появится после формирования сигналов.",
      href: topOrganization ? `/organizations/${topOrganization.id}` : "/organizations",
    },
    {
      icon: FileSearch,
      title: "Объём ручной работы",
      text: `Предварительный отбор сокращает объём ручного просмотра на ${percent(quality.data.manual_review_reduction)}.`,
      href: PRIORITY_QUEUE_URL,
    },
  ];

  return <div className="overview-shell" data-testid="overview-root">
    <OverviewHeader
      period={analysis.period}
      lastAnalysis={command.data.last_analysis_at}
      organizations={analysis.organizations_count}
      status={analysis.processing_status}
      stale={stale}
    />

    <div className="overview-content">
      <section className="overview-hero" aria-labelledby="overview-result-title">
        <div className="overview-hero-copy">
          <p className="overview-kicker"><ScanSearch className="h-4 w-4" aria-hidden="true"/>Главный результат</p>
          <h1 id="overview-result-title">Аналитический обзор</h1>
          <p className="overview-conclusion">Verimed проанализировал <strong>{number(analysis.records_count)} медицинских услуг</strong> и отобрал для экспертной проверки <strong>{plural(selectedCount, ["запись", "записи", "записей"])} ({percent(quality.data.selected_for_review_rate, 2)})</strong>. Потенциальный объём проверки составляет <strong>{money(reviewAmount, true)}</strong>.</p>
        </div>
        <div className="overview-metrics" aria-label="Ключевые показатели анализа">
          <OverviewMetric icon={Database} label="Проанализировано услуг" value={number(analysis.records_count)} prominent/>
          <OverviewMetric icon={ClipboardCheck} label="Отобрано для проверки" value={number(selectedCount)} detail={percent(quality.data.selected_for_review_rate, 2)}/>
          <OverviewMetric icon={TrendingUp} label="Сокращение ручного просмотра" value={percent(quality.data.manual_review_reduction)}/>
          <OverviewMetric icon={CircleDollarSign} label="Потенциальный объём проверки" value={money(reviewAmount, true)} tone="finance"/>
        </div>
      </section>

      <section className="overview-section" aria-labelledby="attention-title">
        <OverviewSectionTitle icon={Flag} title="Требуют внимания" description="Три объекта с наибольшим текущим рабочим приоритетом"/>
        <div className="overview-attention-grid">
          {topOrganization ? <AttentionLink href={`/organizations/${topOrganization.id}`} eyebrow="Медицинская организация" title={topOrganization.name} reason={topOrganization.main_reason} value={`Приоритет ${topOrganization.priority_score} из 100`} finance={topOrganization.review_amount} badge={<PriorityBadge level={topOrganization.priority_level}/>}/> : <AttentionEmpty label="Приоритетная организация пока не определена"/>}
          {topSignal ? <AttentionLink href={`/signals/${topSignal.id}`} eyebrow="Сигнал" title={topSignal.service_name} context={topSignal.organization_name} reason="Наибольшая финансовая значимость среди текущих сигналов." value={`Приоритет ${topSignal.priority_score} из 100`} finance={topSignal.financial_significance} badge={<PriorityBadge level={topSignal.priority_level}/>}/> : <AttentionEmpty label="Приоритетный сигнал пока не определён"/>}
          {topPattern ? <AttentionLink href={`/patterns/${topPattern.id}`} eyebrow="Повторяющаяся модель" title={topPattern.name} context={topPattern.main_organization ?? "Несколько организаций"} reason={topPattern.primary_reason} value={`Важность ${topPattern.importance_score} из 100`} finance={topPattern.financial_significance} badge={<ImportanceBadge level={topPattern.importance_level}/>}/> : <AttentionEmpty label="Повторяющиеся модели пока не сформированы"/>}
        </div>
      </section>

      <div className="overview-insight-grid">
        <section className="overview-section overview-findings" aria-labelledby="findings-title">
          <OverviewSectionTitle icon={Sparkles} title="Системные выводы"/>
          <div className="overview-findings-list">{systemFindings.map(finding => <Link key={finding.title} href={finding.href} className="overview-finding"><span className="overview-finding-icon"><finding.icon className="h-4 w-4" aria-hidden="true"/></span><span><strong>{finding.title}</strong><span>{finding.text}</span></span><ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true"/></Link>)}</div>
        </section>

        <section className="overview-section overview-quality" aria-labelledby="quality-title">
          <OverviewSectionTitle icon={CheckCircle2} title="Качество анализа"/>
          <div className="overview-quality-grid">
            <QualityValue label="Точность выявления" value={quality.data.precision}/>
            <QualityValue label="Полнота выявления" value={quality.data.recall}/>
            <QualityValue label="F1-мера" value={quality.data.f1}/>
            <QualityValue label="Ложноположительные записи" value={quality.data.false_positive_rate}/>
          </div>
          <p className="overview-method-note">{SYNTHETIC_DATA_NOTE}</p>
          {!expert.data.sample_sufficient && <p className="overview-sample-note">{expert.data.sample_message ?? "Недостаточно экспертных решений для устойчивого вывода."}</p>}
        </section>

        <section className="overview-section overview-patterns" aria-labelledby="patterns-title">
          <OverviewSectionTitle icon={Layers3} title="Повторяющиеся модели"/>
          {patternSummary.data.total_patterns > 0 ? <>
            <div className="overview-pattern-stats">
              <SmallStat label="Всего" value={number(patternSummary.data.total_patterns)}/>
              <SmallStat label="Высокая устойчивость" value={number(patternSummary.data.high_stability_patterns)}/>
              <SmallStat label="Организации" value={number(patternSummary.data.affected_organizations)}/>
              <SmallStat label="Финансовая значимость" value={money(patternSummary.data.financial_significance, true)} finance/>
            </div>
            <div className="overview-distribution" aria-label="Распределение моделей по типам">{distribution.slice(0, 4).map(item => <div key={item.label} className="overview-distribution-row"><div><span>{item.label}</span><strong>{number(item.value)}</strong></div><div className="overview-distribution-track"><span style={{width: `${item.percent}%`}}/></div></div>)}</div>
          </> : <p className="overview-compact-empty">Повторяющиеся модели пока не сформированы. Для анализа требуется несколько периодов наблюдений.</p>}
        </section>
      </div>

      <div className="overview-bottom-grid">
        <ChangesSummary changes={changes.data} patternChanges={patternChanges.data}/>
        <section className="overview-recommendation" aria-labelledby="recommendation-title">
          <div><p className="overview-kicker"><Flag className="h-4 w-4" aria-hidden="true"/>Рекомендуемое действие</p><h2 id="recommendation-title">Начать приоритетную проверку</h2><p>{topOrganization ? `Начните с ${topOrganization.name}: приоритет ${topOrganization.priority_score} из 100 · ${number(topOrganization.high_risk_signals)} сигналов · ${money(topOrganization.review_amount)}.` : "Перейдите к сигналам с наибольшим текущим приоритетом."}</p></div>
          <Link href={PRIORITY_QUEUE_URL} className="overview-primary-action print:hidden">Перейти к приоритетной проверке<ArrowRight className="h-4 w-4" aria-hidden="true"/></Link>
        </section>
      </div>
    </div>
  </div>;
}

function OverviewHeader({ period, lastAnalysis, organizations, status, stale }: { period: string; lastAnalysis: string | null; organizations: number; status: string; stale: boolean }) {
  return <header className="overview-header">
    <div className="overview-brand"><span className="overview-brand-mark"><ShieldCheck className="h-5 w-5" aria-hidden="true"/></span><span><strong>Verimed</strong><span>Интеллектуальная система прозрачности и контроля медицинских услуг</span></span></div>
    <div className="overview-context" aria-label="Контекст анализа"><span><BarChart3 className="h-4 w-4" aria-hidden="true"/>{period}</span><span><Building2 className="h-4 w-4" aria-hidden="true"/>{number(organizations)} организаций</span><span><Clock3 className="h-4 w-4" aria-hidden="true"/>{lastAnalysis ? dateTimeText(lastAnalysis) : "Анализ ещё не выполнялся"}</span><span className={stale ? "overview-freshness is-stale" : "overview-freshness"}><span aria-hidden="true"/>{stale ? "Данные требуют обновления" : status}</span></div>
    <div className="overview-header-actions print:hidden"><Link href={PRIORITY_QUEUE_URL} className="overview-header-link is-primary">Перейти к проверке</Link><Link href="/" className="overview-header-link">Вернуться в систему</Link><OverviewActions/></div>
  </header>;
}

function OverviewMetric({ icon: Icon, label, value, detail, prominent = false, tone = "default" }: { icon: typeof Database; label: string; value: string; detail?: string; prominent?: boolean; tone?: "default" | "finance" }) {
  return <div className={`overview-metric${prominent ? " is-prominent" : ""}${tone === "finance" ? " is-finance" : ""}`}><Icon className="h-4 w-4" aria-hidden="true"/><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}

function OverviewSectionTitle({ icon: Icon, title, description }: { icon: typeof Flag; title: string; description?: string }) {
  return <div className="overview-section-title"><span><Icon className="h-4 w-4" aria-hidden="true"/></span><div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>;
}

function AttentionLink({ href, eyebrow, title, context, reason, value, finance, badge }: { href: string; eyebrow: string; title: string; context?: string; reason: string; value: string; finance: string; badge: React.ReactNode }) {
  return <Link href={href} className="overview-attention-card"><div className="overview-attention-top"><span>{eyebrow}</span>{badge}</div><h3>{title}</h3>{context && <p className="overview-attention-context">{context}</p>}<p className="overview-attention-reason">{reason}</p><div className="overview-attention-bottom"><strong>{value}</strong><FinancialValue value={money(finance, true)} compact/></div><ArrowRight className="overview-card-arrow h-4 w-4" aria-hidden="true"/></Link>;
}

function AttentionEmpty({ label }: { label: string }) {
  return <div className="overview-attention-card is-empty"><Network className="h-5 w-5" aria-hidden="true"/><p>{label}</p></div>;
}

function QualityValue({ label, value }: { label: string; value: number }) {
  return <div><strong>{percent(value, 2)}</strong><span>{label}</span><div className="overview-quality-track"><span style={{width: `${Math.min(value * 100, 100)}%`}}/></div></div>;
}

function SmallStat({ label, value, finance = false }: { label: string; value: string; finance?: boolean }) {
  return <div className={finance ? "is-finance" : ""}><strong>{value}</strong><span>{label}</span></div>;
}

function ChangesSummary({ changes, patternChanges }: { changes: AnalyticsChanges; patternChanges: PatternChanges }) {
  return <section className="overview-section overview-changes" aria-labelledby="changes-title"><OverviewSectionTitle icon={TrendingUp} title="Что изменилось"/>{changes.comparison_available ? <div className="overview-change-list"><ChangeValue value={number(changes.new_signals)} label="новых сигналов"/><ChangeValue value={money(changes.review_amount_change, true)} label="финансовая значимость"/><ChangeValue value={number(patternChanges.new_patterns)} label="новых моделей"/></div> : <p className="overview-compact-empty">Изменения станут доступны после следующего запуска анализа.</p>}</section>;
}

function ChangeValue({ value, label }: { value: string; label: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function patternDistribution(patterns: RecurringPattern[]): { label: string; value: number; percent: number }[] {
  const counts = new Map<string, number>();
  for (const pattern of patterns) counts.set(pattern.pattern_type_label, (counts.get(pattern.pattern_type_label) ?? 0) + 1);
  const max = Math.max(...counts.values(), 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({label, value, percent: (value / max) * 100}));
}

function OverviewLoading() {
  return <div className="overview-shell" aria-label="Загрузка аналитического обзора" aria-busy="true"><div className="overview-header"><Skeleton className="h-12 w-72"/><Skeleton className="h-10 w-[32rem] max-w-full"/></div><div className="overview-content space-y-4"><Skeleton className="h-52"/><div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-44"/><Skeleton className="h-44"/><Skeleton className="h-44"/></div><div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-56"/><Skeleton className="h-56"/><Skeleton className="h-56"/></div></div></div>;
}

export default OverviewPage;
