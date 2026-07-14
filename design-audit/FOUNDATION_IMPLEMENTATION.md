# Реализация foundation Verimed V2

## Статус фазы

Foundation реализован без изменения backend, API, аналитики, маршрутов, данных, Sidebar, App Shell и композиции рабочих страниц. Публичные импорты старых примитивов сохранены через совместимый фасад `components/ui.tsx`.

До изменений зафиксированы:

- 24 test files и 64 frontend-теста — успешно;
- production build — успешно;
- 27 baseline-снимков девяти рабочих маршрутов на ширинах 1440, 768 и 375 px;
- данные на контрольных маршрутах поступают из существующего API;
- рабочие сценарии: сводная аналитика → проверка → сигнал; организации → карточка; модели → карточка; журнал решений.

## Брендовые активы

- `frontend/public/brand/verimed-logo-source.png` — неизменённый утверждённый исходник 2172×724 px;
- `frontend/public/brand/verimed-logo@2x.png` — прозрачный retina asset 436×112 px без технических белых полей;
- `BrandLogo` использует только утверждённый сине-бирюзовый знак и wordmark, `alt="Verimed"`.

Форма, цвет и пропорции логотипа не менялись. Старый бренд в Sidebar будет заменён отдельной фазой.

## Токены V2

Добавлены централизованные токены:

- canvas, surface, surface-soft, selected;
- обычная и усиленная граница;
- основной, вторичный, приглушённый и disabled-текст;
- primary blue, cyan, teal и мягкие поверхности;
- success, warning, critical, high, medium, low;
- шаг пространства 4 px;
- радиусы control 10 px, card 12 px, section 14 px, overlay 16 px;
- тени panel, dropdown и sticky action bar;
- focus ring 2 px;
- micro, short и panel transitions;
- общий режим `prefers-reduced-motion`.

Базовые cyan, teal и семантические цвета сохранены для маркеров и графиков. Для мелкого текста добавлены отдельные `*-text` foreground-токены с контрастом не ниже WCAG AA на соответствующих мягких поверхностях. Это предотвращает затемнение всей палитры и одновременно исключает использование недостаточно контрастного яркого цвета как текста.

## Типографика

Inter подключён через `next/font` с кириллицей и начертаниями 400, 500, 600 и 700. Системный fallback: Arial и системный sans-serif. Суммы, проценты, даты и аналитические значения используют `v2-tabular`; monospace зарезервирован для технических обезличенных кодов.

## Примитивы

Созданы и унифицированы:

- `BrandLogo`;
- `PageHeader`, `SectionHeader`;
- `MetricStrip`, `MetricCard`;
- `DomainIndicator`, `FinancialValue`;
- `Card`, `DataPanel`, `StickyActionBar`;
- `Button`, `ExportAction`, `OverflowActions`;
- `Input`, `Search`, `Select`, `Textarea`, `Checkbox`;
- `ActiveFilterChip`, `FilterBar`;
- `DataTableShell`, `DataTableRow`, `DataTableCell`, `MobileObjectCard`;
- `InlineNotice`, `EmptyState`;
- `Skeleton`, `PageSkeleton` для dashboard, list, detail, journal и overview;
- общая V2-тема Recharts.

`ExportAction` в этой фазе реализует только интерфейс состояний `idle`, `loading`, `success`, `error`, `disabled`. Фактический экспорт не подключён и не показывается пользователю как готовое действие.

## Семантика показателей

- Приоритет проверки — marker, уровень и при необходимости крупное число.
- Оценка риска — спокойная текстовая структура без конкурирующей заливки.
- Финансовая значимость — teal, знак тенге и tabular numerals; красный не применяется автоматически.
- Важность модели — глубокий синий прямоугольный индикатор, отличный от приоритета.
- Устойчивость — cyan-шкала повторяемости, а не опасности.
- Статус экспертной оценки — нейтральный status chip и текст.

Совместимые `PriorityBadge`, `RiskBadge`, `ImportanceBadge`, `StabilityBadge` и `StatusBadge` теперь делегируют эту семантику `DomainIndicator`.

## Migration layer

Существующий `components/ui.tsx` оставлен как фасад, поэтому рабочие страницы не требуют массовой замены импортов. `page-header.tsx` также переэкспортирует V2-компонент. Дублирующий EmptyState удалён из `data-state.tsx`; старое имя продолжает работать.

Legacy HSL-токены, старые route-specific CSS-классы, текущие тени и фоновый radial gradient пока остаются, потому что рабочие страницы ещё не мигрированы. Они не используются внутри новых foundation-компонентов. Их удаление выполняется только после поэкранной миграции и visual regression каждой страницы.

## Internal harness

Маршрут `/foundation-preview` показывает примитивы, семантические показатели, таблицу, мобильную карточку, фильтры, состояния экспорта, EmptyState, skeleton и sticky action bar. Он:

- не входит в навигацию;
- имеет `noindex`;
- возвращает 404 в production без `NEXT_PUBLIC_ENABLE_FOUNDATION_HARNESS=true`;
- использует только статические примеры внутреннего стенда и не заменяет данные рабочих страниц.

Команда снимков foundation:

```bash
cd frontend
NEXT_PUBLIC_ENABLE_FOUNDATION_HARNESS=true npm run dev
# во втором терминале
npm run visual:foundation
```

## Критерии готовности следующей фазы

- frontend tests, ESLint, TypeScript strict и production build проходят;
- стандартная матрица рабочих маршрутов остаётся зелёной;
- harness проверен на 1440, 768 и 375 px, при 200% zoom и reduced motion;
- backend не имеет diff;
- новые foundation-файлы не содержат violet, purple, indigo, glow, radial gradient или `transition-all`.

Следующая фаза может мигрировать App Shell и Sidebar только после отдельного подтверждения. Страницы, карта, экспорт, профиль и новые графики в foundation-фазу не входят.

## Результаты проверки

- 25 test files и 79 frontend-тестов — успешно;
- ESLint — успешно;
- TypeScript strict — успешно;
- production build — успешно;
- `/foundation-preview` в production без флага возвращает HTTP 404;
- visual regression — 30 снимков: 27 рабочих и 3 foundation;
- foundation проверен на 1440, 768 и 375 px, с 200% device scale и `prefers-reduced-motion`;
- на 375 px горизонтального переполнения и видимых touch targets меньше 44×44 px нет;
- `aria-expanded`, закрытие меню по Escape и возврат фокуса работают;
- ошибок и предупреждений браузерной консоли нет;
- backend не изменён.
