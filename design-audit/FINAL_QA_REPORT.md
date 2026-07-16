# Финальный QA-отчёт Verimed V2

Дата: 16 июля 2026 года.

Фаза: `design-v2-qa`.

Статус: завершено, блокирующих дефектов не обнаружено.

## 1. Scope и неизменённые области

Финальная фаза включала только cleanup presentation layer, исправление подтверждённых accessibility/responsive дефектов, сквозную проверку и документацию.

Не изменялись:

- backend-код и API-контракты;
- аналитические формулы и результаты;
- модели данных, БД и миграции;
- маршруты и продуктовый scope;
- фильтрация, pagination, URL state и экспертные решения;
- topology relationship graph;
- региональный аналитический contract.

## 2. Проверенные маршруты

Продуктовые:

- `/`;
- `/overview`;
- `/signals`;
- `/signals/[id]`;
- `/organizations`;
- `/organizations/[id]`;
- `/patterns`;
- `/patterns/[id]`;
- `/reviews`;
- `/decision-journal`;
- `/methodology`;
- `/profile`.

Redirects и guards:

| Маршрут | Результат |
|---|---|
| `/risk-signals` | `307 → /signals` |
| `/data` | `307 → /` |
| `/settings` | `307 → /` |
| `/foundation-preview` | `404` в production без флага |

Отдельного data-actions route нет. Preview-ссылки отсутствуют в Sidebar и пользовательской навигации; sitemap в приложении не создаётся.

## 3. Cleanup legacy presentation layer

`frontend/app/globals.css` сокращён с 973 до 382 строк. Удалены:

- legacy HSL variables и параллельные цветовые aliases;
- старые dark navigation tokens;
- violet/purple/indigo presentation values;
- radial body background;
- старые `overview-*` selectors и дублирующий print CSS;
- legacy `surface-*`, `metric-number`, `interactive-card`, `filter-field`, `sticky-workbar`;
- глобальные route-specific table/mobile overrides;
- устаревшие shadows, gradients и typography overrides.

Из `tailwind.config.ts` удалены legacy named colors, старые radii/shadows и `glow`.

Удалены неиспользуемые компоненты:

- `components/expert-work.tsx`;
- `components/pattern-attention.tsx`;
- `components/quality-metric.tsx`;
- `components/ui.tsx` — временный compatibility facade после завершения миграции.

Связанные мёртвые тесты и fixtures удалены или переведены на прямой `@/components/foundation` import.

## 4. Оставшиеся совместимые элементы

Параллельных legacy style tokens или route-specific дизайн-систем в production не осталось.

Сохранены только:

- component API aliases `outline` и `danger`, которые делегируют V2-вариантам `secondary` и `destructive`;
- wrappers `PriorityBadge`, `RiskBadge`, `ImportanceBadge`, `StabilityBadge`, `StatusBadge`, которые используют `DomainIndicator`;
- исходный брендовый PNG размером 760 КБ как неприкосновенный source asset; runtime использует оптимизированный retina asset 48 КБ.

Эти элементы не создают отдельного presentation layer.

## 5. Поиск запрещённых паттернов

Production source проверен на:

- `violet`, `purple`, `indigo`;
- `radial-gradient`, `shadow-glow`, `transition-all`;
- `font-mono` для пользовательских показателей;
- `shield-logo`;
- старые gradient и legacy utility class names.

Совпадений в пользовательском presentation layer нет. Технические упоминания остаются только в документации и regression tests.

## 6. Исправленные дефекты

1. Mobile кнопка удаления длинного active-filter chip могла сжиматься flex-контейнером до 42 px. Добавлен `shrink-0`; target сохраняет 44×44 px.
2. Checkbox target на mobile приведён к доступной области 44×44 px.
3. Segmented controls слоя региональной карты увеличены до 44 px.
4. Overlay mobile navigation был семантическим `<button aria-hidden>`. Он заменён на mouse-dismiss layer; доступное закрытие обеспечивают именованная кнопка и Escape.
5. `--v2-text-muted` имел контраст 3.88:1 на белом. Значение изменено с `#74829B` на `#62718A`; минимум на V2 surfaces — 4.55:1.
6. Остаточные legacy styles в expert feedback, decision timeline и chart surface переведены на V2 tokens.
7. Redirect tests дополнены маршрутами `/data` и `/settings`.
8. Visual harness теперь проверяет controls без имени, `aria-hidden` focusable elements, mobile touch targets, duplicate IDs, `alt`, overflow и console errors.

## 7. Brand, shell и headers

- во всех оболочках используется один `BrandLogo` с утверждённым artwork;
- старого shield mark нет;
- desktop Sidebar имеет ширину 264 px и светлую поверхность;
- mobile sheet использует ту же структуру, active state и profile trigger;
- открытый sheet проверен на 768 и 375 px;
- Escape, focus trap, body scroll lock и return focus покрыты компонентными тестами;
- PageHeader сохраняет единую типографику, mobile collapse и одну primary CTA.

## 8. Метрики, таблицы и фильтры

- доменные показатели сохраняют отдельную семантику приоритета, риска, финансов, важности, устойчивости и экспертного статуса;
- суммы, проценты и аналитические значения используют tabular numerals;
- financial value не получает тревожный цвет автоматически;
- desktop-списки используют `DataTableShell`, mobile — `MobileObjectCard`;
- filters используют единый `FilterBar`, URL остаётся источником состояния;
- длинные filter chips не уменьшают touch target;
- export остаётся вторичным и не сбрасывает selection/filters при ошибке.

## 9. Panels, sheets и sticky actions

Проверены:

- `SignalPreviewPanel`;
- `DecisionEventPanel`;
- mobile navigation sheet;
- `OverflowActions`;
- disclosures;
- `StickyActionBar` карточки сигнала и модели.

Runtime snapshots включают открытые panels на desktop/mobile, короткий viewport, 200% zoom и sticky actions. Nested scroll trap и document overflow не обнаружены.

## 10. Карта, графики и relationship graph

- региональная карта использует V2 palette и фактический `regional_monitoring`;
- проверены слои сигналов, финансов и приоритета;
- неизвестный регион не получает случайную геометрию;
- `KZ-SHY` сохраняется отдельным кодом без геометрии, а Шымкент не сопоставляется с Туркестанской областью;
- регион без данных отображается отдельно и не превращается в ноль;
- mobile сначала показывает ранжированный текстовый список;
- graph topology и selection state не менялись;
- выбранный узел, dimming несвязанных элементов и mobile text alternative проверены;
- timeline/review charts используют общую V2 theme и честные empty/insufficient states.

## 11. Profile и methodology

Profile:

- synthetic fallback, versioning, safe parse, validation, save и reset проходят тесты;
- Sidebar обновляется через общий local profile store;
- повреждённый или недоступный localStorage не ломает страницу;
- интерфейс явно сообщает о хранении только в браузере;
- auth, roles, permissions, password и персональные фотографии отсутствуют.

Methodology:

- сохранены четыре фактических этапа;
- формулы и API-тексты не изменялись;
- юридическое ограничение показано один раз;
- формулировки не утверждают доказанное нарушение и сохраняют роль специалиста.

## 12. Responsive и accessibility

Проверенные ширины:

- 1440;
- 1280;
- 1024;
- 768;
- 375;
- 320 px stress check.

Дополнительно проверены landscape, short viewport, `prefers-reduced-motion` и 200% zoom.

Результаты:

- horizontal document overflow: 0;
- runtime accessibility issues: 0;
- controls без доступного имени: 0;
- focusable elements внутри `aria-hidden`: 0;
- mobile touch targets ниже допустимого размера: 0;
- browser console/unhandled errors: 0.

Контраст основных пар:

| Пара | Контраст |
|---|---:|
| основной текст / surface | 17.00:1 |
| secondary text / surface | 6.25:1 |
| muted text / surface-soft | 4.55:1 |
| white / primary | 5.30:1 |
| critical text / critical-soft | 5.55:1 |

Playwright и axe не добавлялись как новые зависимости. Эквивалентная сквозная проверка выполнялась существующим headless Chrome/CDP harness с behavior assertions и runtime accessibility audit.

## 13. Производительность

Расширенный QA manifest для 86 cross-route captures:

- средний browser `loadEventEnd`: 101 мс;
- максимальный browser `loadEventEnd`: 117 мс;
- средний transfer JS: 219 786 байт;
- максимальный transfer JS: 339 990 байт;
- максимальный DOM: 1 995 nodes.

Это локальные warm production-измерения и не являются оценкой Vercel network/cold start.

Подтверждено:

- map, graph и вторичные charts остаются ленивыми;
- object URL освобождается download client;
- panels и storage listeners очищают handlers;
- новые runtime dependencies не добавлены;
- `@emnapi/runtime` отмечен как extraneous только в текущем локальном `node_modules` и не входит в `package.json`; чистый `npm ci` его не требует.

## 14. Print и fullscreen

- `/overview` сформировал пять читаемых альбомных страниц;
- логотип, период, карта, timeline и текстовые альтернативы сохранены;
- интерактивные controls скрыты;
- значимые блоки не разрываются неконтролируемо;
- fullscreen enter/exit, Escape и fallback покрыты analytics tests и browser state.

## 15. Тесты и visual regression

Backend:

- pytest: 109 passed;
- Ruff: passed;
- mypy strict: 32 source files, passed;
- export/regional tests входят в общий pytest-набор.

Frontend:

- Vitest: 33 files, 175 tests passed;
- ESLint: passed;
- TypeScript strict: passed;
- Vercel production build с `NEXT_PUBLIC_API_URL=/api`, `VERCEL=1`: passed;
- `.next/package.json`: присутствует;
- Vercel-ветка корректно не создаёт standalone output.

Browser/e2e:

| Набор | Снимки / browser runs |
|---|---:|
| master 12 routes × 3 widths | 36 |
| extended route QA | 86 |
| review flow states | 45 |
| organizations states | 36 |
| patterns/graph states | 43 |
| analytics/map/print states | 29 |
| expert pages states | 45 |
| **Всего** | **320** |

Во всех manifests — 0 audit issues. Снимки и PDF сохранены во временных каталогах и не добавлены в git.

## 16. Оставшиеся ограничения

Блокирующих ограничений нет.

Неблокирующие:

1. В backend test run остаётся стороннее `StarletteDeprecationWarning` о будущем переходе с текущего `httpx` TestClient на `httpx2`; поведение тестов не затронуто.
2. GeoJSON-источник не содержит отдельной геометрии Шымкента. Продукт честно оставляет город в текстовом списке без случайной заливки.
3. Runtime browser performance числа относятся к локальной прогретой production-сборке; Vercel cold start и внешняя сеть измеряются отдельно от визуальной миграции.
4. Исходный брендовый PNG сохранён намеренно и не используется как runtime asset.

## 17. Итог

Verimed V2 является единой светлой визуальной и UX-системой на всех 12 продуктовых маршрутах. Legacy presentation layer удалён, подтверждённые accessibility/responsive дефекты исправлены, production guards работают, полный test gate и visual matrix проходят. Финальная QA-фаза не меняет API, БД, аналитику или продуктовый scope.
