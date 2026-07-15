# Реализация оболочки Verimed V2

## Статус фазы

Фаза `design-v2-shell` переводит только общую оболочку и навигацию на V2. Содержимое продуктовых страниц, маршруты, API, данные, фильтры, пагинация и рабочие сценарии не менялись. `/overview` сохраняет собственную полноэкранную оболочку и будет мигрирован на V2 отдельно.

## Изменённые компоненты

- `frontend/components/sidebar.tsx` — desktop Sidebar, tablet/mobile header, navigation sheet и profile trigger;
- `frontend/components/app-shell.tsx` — responsive offset, V2 canvas и ссылка пропуска к основному содержанию;
- `frontend/app/globals.css` — только переходы mobile sheet и overlay-токен;
- `frontend/scripts/capture-visuals.mjs` — отдельная shell-матрица;
- тесты Sidebar и AppShell — структура, active state, Escape, focus trap, return focus и scroll lock.

Foundation-компоненты не дублировались. Логотип подключён через существующий `BrandLogo`, цвета — через `--v2-*` tokens.

## Desktop Sidebar

- ширина `264 px` (`16.5rem`), белая поверхность и холодная правая граница;
- отображается с breakpoint `xl`, поэтому на 1280 и 1440 px используется постоянная боковая навигация, а на 1024 px — компактный shell header;
- сохранены состав, порядок и маршруты основной навигации;
- группа «Экспертная работа» отделена тонкой линией и коротким eyebrow;
- active state использует мягкий синий фон, левую линию 3 px, синюю иконку, `font-weight: 600` и `aria-current="page"`;
- hover меняет только цвет поверхности и текста, без transform;
- профиль является прямой доступной ссылкой на `/profile`, без dropdown, выхода, роли или настроек.

## Mobile navigation sheet

- верхняя панель высотой 64 px содержит только кнопку меню и компактный `BrandLogo`;
- sheet имеет ту же светлую систему и те же группы, что desktop Sidebar;
- ширина ограничена `384 px` и `calc(100% - 16px)`;
- при открытии фокус переходит на кнопку закрытия, прокрутка `body` блокируется;
- Tab и Shift+Tab циклически удерживают фокус внутри sheet;
- Escape, кнопка закрытия, overlay и переход по ссылке закрывают sheet;
- после закрытия фокус возвращается кнопке меню;
- анимация длится 200 ms и отключается через `prefers-reduced-motion`.

## BrandLogo

Desktop и mobile используют утверждённый `frontend/public/brand/verimed-logo@2x.png`. Artwork, цвета, пропорции и подпись не менялись. Shield-иконка и текстовый суррогат из прежнего Sidebar удалены.

## Responsive layout

- 1440/1280 px: Sidebar 264 px, main content смещён на ту же ширину;
- 1024/768 px: Sidebar скрыт, main content начинается после header, page gutter остаётся в существующем `.page-shell`;
- 375 px: header и sheet не расширяют документ, menu target — 44×44 px;
- основной контент по-прежнему ограничен `1480 px` существующим `.page-shell`;
- при 200% zoom оболочка переходит к mobile navigation вместо сжатия desktop Sidebar.

## Compatibility layer

Legacy page styles, route-specific cards, таблицы, фильтры и body background остаются для последующей поэкранной миграции. Новый `main` перекрывает legacy body background V2 canvas только на рабочих маршрутах. Никаких wrapper cards вокруг страниц не добавлено.

Минимальные compatibility fixes:

- desktop offset изменён с `17rem` на утверждённые `16.5rem`;
- breakpoint постоянного Sidebar изменён с `lg` на `xl`, чтобы 1024 px работал как tablet;
- добавлена ссылка «К основному содержанию»;
- `/overview` по-прежнему не получает рабочий Sidebar.

## Visual regression

Команда:

```bash
cd frontend
VERIMED_VISUAL_OUTPUT=/tmp/verimed-v2-shell npm run visual:shell
```

Она создаёт 20 закрытых состояний: `/`, `/signals`, `/organizations`, `/patterns`, `/profile` на 1440, 1280, 768 и 375 px. Открытые состояния 768/375 px и 200% zoom дополнительно проверяются в браузерном сценарии, потому что требуют взаимодействия с sheet.

Финальная проверка выполнена на production-сборке с данными из локального API. Дополнительно сохранены пять интерактивных снимков: tablet/mobile с закрытым и открытым sheet и эквивалент 200% zoom. На всех целевых ширинах `document.scrollWidth` совпадает с шириной viewport. Browser console не содержит ошибок или предупреждений оболочки.

## Результат проверок

- Vitest: 25 файлов, 82 теста;
- ESLint: без ошибок;
- TypeScript strict: без ошибок;
- Next.js production build: успешно;
- Escape закрывает sheet, очищает scroll lock и возвращает фокус кнопке меню;
- Tab/Shift+Tab не выпускают фокус за пределы открытого sheet;
- touch target кнопки меню: 44×44 px;
- контраст основного текста навигации и active state соответствует WCAG AA;
- анимации shell выполняются только при `prefers-reduced-motion: no-preference`.

## Готовность следующих страниц

После этой фазы рабочие маршруты готовы к поэкранной миграции на V2 primitives. Следующая утверждённая фаза — `data/actions`; редизайн списков и карточек в shell-фазу не входит.
