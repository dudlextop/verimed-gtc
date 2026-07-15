# Verimed V2 — data/actions implementation

## Scope

Фаза `design-v2-data-actions` добавляет инфраструктуру данных и действий без page-level редизайна. Маршруты, бизнес-сценарии, формулы, модели БД и topology графа не изменены.

## Backend

- overview schema version повышена до 2;
- `timeline` переиспользует существующий `get_timeline`;
- `regional_monitoring` собирает сигналы, уникальные записи, финансовую значимость, организации и существующие приоритеты по явному региональному справочнику;
- неизвестные регионы остаются отдельными и не получают геометрию;
- добавлены GET/POST CSV endpoint’ы в `/api/exports`;
- экспорт вызывает существующие list-сервисы, поэтому фильтрация, сортировка и pagination semantics не расходятся;
- модели и миграции не добавлены.

## Frontend

- общий `downloadFile` и `useFileDownload` для GET/POST, ошибок, abort и cleanup;
- `ExportAction` поддерживает controlled и async callback states;
- `useScopedSelection` фиксирует filter signature и очищает выбор при смене условий;
- versioned local profile store v1 с fallback и storage-event sync;
- profile trigger минимально читает локальное имя, должность и инициалы;
- локальный GeoJSON и typed mapping отделены от будущего компонента карты;
- `OverflowActions` скрывает пункты без callback, поддерживает async loading, клавиатуру, Escape и возврат фокуса;
- foundation preview расширен скрытым data/actions harness; production без специального флага по-прежнему возвращает 404.

## Совместимость

Существующие поля overview сохранены. Новые frontend-типы имеют optional semantics для старых fixtures. Рабочие страницы не получили новых кнопок, карту или форму профиля. Legacy CSV выбранных строк на `/signals` пока оставлен неизменным и будет заменён серверной интеграцией в соответствующей page-level фазе.

## Следующая фаза

После отдельного утверждения можно подключать:

1. серверный экспорт и scoped selection к `/signals`;
2. экспорт организаций к `/organizations`;
3. карту и timeline к `/overview`;
4. форму локального профиля к `/profile`;
5. overflow pattern к конкретным рабочим действиям.
