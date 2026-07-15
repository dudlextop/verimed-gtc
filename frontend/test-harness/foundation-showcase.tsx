"use client";

import * as React from "react";
import { Activity, Building2, CircleDollarSign, Download, FileText, MessageSquare, ShieldCheck } from "lucide-react";
import {
  Button,
  BrandLogo,
  Checkbox,
  DataPanel,
  DataTableCell,
  DataTableRow,
  DataTableShell,
  DomainIndicator,
  EmptyState,
  ExportAction,
  FilterBar,
  FinancialValue,
  Input,
  InlineNotice,
  MetricCard,
  MetricStrip,
  MobileObjectCard,
  OverflowActions,
  PageHeader,
  PageSkeleton,
  Search,
  SectionHeader,
  Select,
  StickyActionBar,
  Textarea,
} from "@/components/foundation";
import { DataActionsShowcase } from "@/test-harness/data-actions-showcase";

const columns = [
  { id: "priority", label: "Приоритет", sortable: true, sortDirection: "descending" as const },
  { id: "organization", label: "Медицинская организация" },
  { id: "reason", label: "Основная причина" },
  { id: "finance", label: "Финансовая значимость", align: "right" as const },
];

export function FoundationShowcase() {
  const [message, setMessage] = React.useState("Действия пока не выполнялись");
  const [advanced, setAdvanced] = React.useState(false);

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-8 bg-v2-canvas px-4 py-6 text-v2-text md:px-8 md:py-10">
      <div className="flex flex-wrap items-center gap-3 rounded-v2-section border border-v2-border bg-v2-surface px-4 py-3">
        <BrandLogo size="small" priority />
        <span className="text-sm text-v2-text-secondary">Утверждённый брендовый asset</span>
      </div>
      <PageHeader
        eyebrow="Внутренняя проверка"
        title="Foundation дизайн-системы Verimed V2"
        description="Изолированный стенд для визуальной, адаптивной и доступной проверки примитивов до миграции рабочих страниц."
        meta={<span>Не входит в основную навигацию</span>}
        primaryAction={<Button onClick={() => setMessage("Основное действие выполнено")}>Основное действие</Button>}
        secondaryActions={<Button variant="secondary" onClick={() => setMessage("Вторичное действие выполнено")}>Вторичное</Button>}
      />

      <section className="space-y-4" aria-labelledby="brand-title">
        <SectionHeader id="brand-title" title="Действия и состояния" description="Одно основное действие, до двух вторичных; остальные доступны через меню." />
        <DataPanel>
          <div className="flex flex-wrap items-start gap-3">
            <Button>Основная</Button>
            <Button variant="secondary">Вторичная</Button>
            <Button variant="ghost">Нейтральная</Button>
            <Button variant="text">Текстовая</Button>
            <Button variant="destructive">Необратимое действие</Button>
            <Button size="icon" variant="secondary" aria-label="Открыть документ"><FileText className="h-4 w-4" aria-hidden="true" /></Button>
            <Button loading>Сохранение</Button>
            <OverflowActions
              items={[
                { id: "comment", label: "Добавить комментарий", icon: <MessageSquare className="h-4 w-4" />, onSelect: () => setMessage("Комментарий выбран") },
                { id: "download", label: "Подготовить данные", icon: <Download className="h-4 w-4" />, onSelect: () => setMessage("Подготовка данных выбрана") },
              ]}
            />
          </div>
          <p className="mt-4 text-sm text-v2-text-secondary" role="status">{message}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <ExportAction state="idle" scopeLabel="текущая выборка" />
            <ExportAction state="loading" />
            <ExportAction state="success" />
            <ExportAction state="error" />
            <ExportAction state="disabled" />
          </div>
        </DataPanel>
      </section>

      <section className="space-y-4" aria-labelledby="metrics-title">
        <SectionHeader id="metrics-title" title="Семантика показателей" description="Рабочий приоритет, аналитический риск, масштаб и характеристики модели не используют один визуальный паттерн." />
        <MetricStrip>
          <MetricCard label="Приоритет проверки" value="95" detail="Критический" icon={ShieldCheck} tone="priority" variant="leading" />
          <MetricCard label="Оценка риска" value="91" detail="Объясняющий показатель" icon={Activity} tone="risk" />
          <MetricCard label="Финансовая значимость" value="4 273 966 ₸" detail="Масштаб связанных услуг" icon={CircleDollarSign} tone="finance" />
          <MetricCard label="Сигналов" value="230" detail="Текущая выборка" icon={Building2} />
        </MetricStrip>
        <div className="grid gap-4 rounded-v2-section border border-v2-border bg-v2-surface p-5 sm:grid-cols-2 xl:grid-cols-5">
          <DomainIndicator kind="priority" level="Критический" value={95} />
          <DomainIndicator kind="risk" level="Высокий" value={88} />
          <DomainIndicator kind="importance" level="Критическая" value={93} />
          <DomainIndicator kind="stability" level="Очень высокая" value={97} />
          <DomainIndicator kind="reviewStatus" level="На рассмотрении" />
          <FinancialValue value={4_273_966} label="Финансовая значимость" leading />
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="controls-title">
        <SectionHeader id="controls-title" title="Поля и фильтры" description="Основные фильтры видимы сразу, дополнительные раскрываются по запросу." />
        <FilterBar
          primary={
            <>
              <label className="space-y-1.5 text-sm font-medium text-v2-text"><span>Поиск</span><Search placeholder="Организация или услуга" aria-label="Поиск по объектам" /></label>
              <label className="space-y-1.5 text-sm font-medium text-v2-text"><span>Приоритет</span><Select defaultValue="all"><option value="all">Все уровни</option><option value="critical">Критический</option></Select></label>
              <label className="space-y-1.5 text-sm font-medium text-v2-text"><span>Период</span><Input type="date" defaultValue="2026-07-15" /></label>
            </>
          }
          advanced={<><Checkbox label="Только без решения" /><label className="space-y-1.5 text-sm font-medium"><span>Тип сигнала</span><Select><option>Все типы</option></Select></label></>}
          activeFilters={[{ id: "status", label: "Без решения", onRemove: () => setMessage("Фильтр удалён") }]}
          activeCount={1}
          defaultAdvancedOpen={advanced}
          onResetAll={() => { setAdvanced(false); setMessage("Фильтры сброшены"); }}
        />
        <label className="block max-w-2xl space-y-1.5 text-sm font-medium"><span>Комментарий специалиста</span><Textarea placeholder="Добавьте медицинский или организационный контекст" /></label>
      </section>

      <section className="space-y-4" aria-labelledby="table-title">
        <SectionHeader id="table-title" title="Таблица и мобильная карточка" description="Сортировка присутствует только у работающей колонки; выбранная строка обозначена не только цветом." />
        <DataTableShell
          columns={columns.map((column) => column.id === "priority" ? { ...column, onSort: () => setMessage("Сортировка изменена") } : column)}
          caption="Пример списка сигналов"
          mobileContent={<MobileObjectCard title="Компьютерная томография грудной клетки" context="Центр диагностики «Оңтүстік»" indicator={<DomainIndicator kind="priority" level="Критический" value={99} compact />} financial={<FinancialValue value={705_805} compact />} status={<DomainIndicator kind="reviewStatus" level="Не проверено" />} reason="Отклонение стоимости от сопоставимого диапазона" />}
        >
          <DataTableRow selected>
            <DataTableCell><DomainIndicator kind="priority" level="Критический" value={99} compact /></DataTableCell>
            <DataTableCell>Центр диагностики «Оңтүстік»</DataTableCell>
            <DataTableCell clamp>Отклонение стоимости от сопоставимого диапазона</DataTableCell>
            <DataTableCell className="text-right"><FinancialValue value={705_805} compact /></DataTableCell>
          </DataTableRow>
          <DataTableRow>
            <DataTableCell><DomainIndicator kind="priority" level="Высокий" value={87} compact /></DataTableCell>
            <DataTableCell>Городская клиническая больница №2</DataTableCell>
            <DataTableCell clamp>Повторяющаяся услуга в коротком периоде</DataTableCell>
            <DataTableCell className="text-right"><FinancialValue value={412_450} compact /></DataTableCell>
          </DataTableRow>
        </DataTableShell>
      </section>

      <section className="space-y-4" aria-labelledby="states-title">
        <SectionHeader id="states-title" title="Состояния" description="Короткий заголовок, одно пояснение и не более одного действия." />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <EmptyState variant="empty" title="Данных пока нет" description="Измените фильтры или вернитесь позже." />
          <EmptyState variant="insufficient" title="Недостаточно данных" description="Вывод станет доступен после накопления экспертных решений." />
          <EmptyState variant="error" title="Не удалось получить данные" description="Повторите попытку после восстановления соединения." action={<Button variant="secondary">Повторить</Button>} />
          <EmptyState variant="history" title="История отсутствует" description="Этот объект обнаружен впервые." />
          <EmptyState variant="stale" title="Данные требуют обновления" description="Последний анализ был выполнен ранее выбранного периода." />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <InlineNotice title="Данные актуальны" description="Показатели получены из последнего анализа." tone="success" />
          <InlineNotice title="Ограничение анализа" description="Сигнал требует экспертной оценки." tone="warning" />
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="skeleton-title">
        <SectionHeader id="skeleton-title" title="Skeleton геометрия" description="Варианты повторяют структуру будущих страниц и учитывают reduced motion." />
        <DataPanel><PageSkeleton variant="list" /></DataPanel>
      </section>

      <DataActionsShowcase />

      <StickyActionBar
        secondaryActions={<Button variant="secondary" onClick={() => setMessage("Черновик сохранён")}>Сохранить черновик</Button>}
        primaryAction={<Button onClick={() => setMessage("Решение сохранено")}>Сохранить решение</Button>}
        overflowAction={<OverflowActions label="Другие действия" items={[{ id: "note", label: "Добавить комментарий", onSelect: () => setMessage("Комментарий выбран") }]} />}
      />
    </div>
  );
}
