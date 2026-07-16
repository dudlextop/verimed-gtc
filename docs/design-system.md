# Дизайн-система Verimed

Статус: V2 реализована.

Дата: 16 июля 2026 года.

Каноническая полная спецификация находится в `design-audit/DESIGN_SYSTEM_V2.md`. Этот документ фиксирует краткие правила для повседневной разработки.

## Характер

Verimed использует единую светлую рабочую систему:

- белые и холодные светлые поверхности;
- глубокий тёмно-синий текст;
- чистый синий основной акцент;
- cyan и teal для аналитического контекста;
- янтарный и коралловый только по смыслу;
- тонкие границы, умеренные радиусы и минимум теней.

Фиолетовые/indigo accents, тёмная навигация, glow и постоянные radial gradients запрещены.

## Токены

Токены определены в `frontend/app/globals.css`, Tailwind bindings — в `frontend/tailwind.config.ts`. Production presentation layer использует только `--v2-*`.

Основные группы:

- `--v2-canvas`, `--v2-surface`, `--v2-surface-soft`, `--v2-selected`;
- `--v2-border`, `--v2-border-strong`;
- `--v2-text`, `--v2-text-secondary`, `--v2-text-muted`;
- `--v2-primary`, `--v2-cyan`, `--v2-teal`;
- семантические critical/high/medium/low/success/warning states.

## Семантика данных

- приоритет проверки — главный рабочий показатель сигнала и организации;
- риск — вторичная аналитическая оценка;
- финансовая значимость — teal и формат тенге, не тревожный цвет;
- важность модели — глубокий синий;
- устойчивость — голубая/бирюзовая шкала повторяемости;
- экспертный статус — нейтральный status chip.

Компоненты не оформляют эти понятия одинаковыми badges.

## Типографика

Основной шрифт — Inter через `next/font`, начертания 400, 500, 600 и 700, с кириллицей и системным fallback.

Суммы, проценты, даты и аналитические значения используют `tabular-nums`. Monospace допускается только для технически значимых обезличенных кодов.

## Компоненты

Примитивы импортируются из `@/components/foundation`:

- `PageHeader`, `SectionHeader`;
- `MetricStrip`, `MetricCard`;
- `DomainIndicator`, `FinancialValue`;
- `DataPanel`, `InlineNotice`, `EmptyState`;
- `FilterBar`, `DataTableShell`, `MobileObjectCard`;
- `StickyActionBar`, `ExportAction`, `OverflowActions`;
- `Button`, `Input`, `Search`, `Select`, `Textarea`, `Checkbox`.

Временный фасад `@/components/ui` удалён после завершения миграции.

## Layout и interaction

- desktop Sidebar — 264 px, светлый;
- gutters: 32 px desktop, 24 px tablet, 16 px mobile;
- одна primary CTA на первом уровне;
- table превращается в mobile cards до 768 px;
- controls и touch targets — не меньше 44×44 px;
- `focus-visible` обязателен;
- `transition: all` запрещён;
- `prefers-reduced-motion` отключает необязательное движение.

## Проверка

Изменение presentation layer проходит:

- Vitest, ESLint и TypeScript strict;
- production build;
- visual master на 1440, 768 и 375 px;
- runtime audit доступных имён, focusability, touch targets, overflow и console errors;
- отдельные состояния 200% zoom, reduced motion, panels/sheets, loading/empty/error и print.

Итог финальной приёмки зафиксирован в `design-audit/FINAL_QA_REPORT.md`.
