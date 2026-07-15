from __future__ import annotations

import csv
import io
from collections.abc import Iterable, Iterator, Sequence
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import RiskSignal
from app.schemas import OrganizationListItem, SignalListItem
from app.services.organizations import list_organizations
from app.services.signals import SIGNAL_OPTIONS, list_signals, to_list_item

EXPORT_MAX_ROWS = 5_000
SELECTED_SIGNALS_MAX_ROWS = 1_000
type CsvScalar = str | int | float | Decimal | date | None

SIGNAL_EXPORT_COLUMNS = (
    "Сигнал",
    "Дата услуги",
    "Медицинская организация",
    "Регион",
    "Медицинская услуга",
    "Тип отклонения",
    "Основная причина",
    "Оценка риска",
    "Уровень риска",
    "Приоритет проверки",
    "Уровень приоритета",
    "Финансовая значимость",
    "Статус экспертной оценки",
)

ORGANIZATION_EXPORT_COLUMNS = (
    "Медицинская организация",
    "Регион",
    "Тип организации",
    "Количество услуг",
    "Количество сигналов",
    "Оценка риска",
    "Уровень риска",
    "Приоритет проверки",
    "Уровень приоритета",
    "Финансовая значимость",
    "Статус экспертной оценки",
)


@dataclass(frozen=True)
class ExportLimitExceeded(Exception):
    total: int
    limit: int


@dataclass(frozen=True)
class ExportSelectionMissing(Exception):
    missing_ids: tuple[int, ...]


def csv_safe_cell(value: CsvScalar) -> CsvScalar:
    """Protect text cells from spreadsheet formulas without changing numeric negatives."""
    if not isinstance(value, str):
        return value
    if value.startswith(("=", "+", "-", "@", "\t", "\r")):
        return f"'{value}"
    return value


def _money(value: Decimal | None) -> str:
    if value is None:
        return "—"
    places = 0 if value == value.to_integral_value() else 2
    return f"{value:,.{places}f}".replace(",", " ") + " ₸"


def _csv_stream(headers: Sequence[str], rows: Iterable[Sequence[CsvScalar]]) -> Iterator[str]:
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";", lineterminator="\r\n")
    yield "\ufeff"
    writer.writerow(headers)
    yield buffer.getvalue()
    buffer.seek(0)
    buffer.truncate(0)
    for row in rows:
        writer.writerow([csv_safe_cell(value) for value in row])
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)


def _signal_row(item: SignalListItem) -> tuple[CsvScalar, ...]:
    return (
        f"№ {item.id}",
        item.date.strftime("%d.%m.%Y"),
        item.organization_name,
        item.region,
        item.service_name,
        item.anomaly_type,
        item.primary_reason,
        item.score,
        item.level.value,
        item.priority_score,
        item.priority_level.value if item.priority_level else "Не рассчитан",
        _money(item.financial_significance),
        item.status.value,
    )


def _organization_row(item: OrganizationListItem) -> tuple[CsvScalar, ...]:
    return (
        item.name,
        item.region,
        item.organization_type,
        item.services_count,
        item.signals_count,
        item.risk_score,
        item.risk_level.value,
        item.priority_score,
        item.priority_level.value if item.priority_level else "Не рассчитан",
        _money(item.financial_significance),
        item.review_status.value,
    )


def export_signals(
    db: Session,
    *,
    search: str | None,
    level: str | None,
    levels: list[str] | None,
    organization_id: int | None,
    region: str | None,
    anomaly_type: str | None,
    status: str | None,
    priority_level: str | None,
    financial_min: Decimal | None,
    financial_max: Decimal | None,
    has_decision: bool | None,
    period_months: int | None,
    date_from: date | None,
    date_to: date | None,
    sort: str,
    direction: str | None,
) -> tuple[Iterator[str], int]:
    result = list_signals(
        db,
        1,
        EXPORT_MAX_ROWS + 1,
        level,
        organization_id,
        region,
        anomaly_type,
        status,
        sort,
        levels,
        priority_level,
        financial_min,
        financial_max,
        has_decision,
        period_months,
        search,
        date_from,
        date_to,
        direction,
    )
    if result.total > EXPORT_MAX_ROWS:
        raise ExportLimitExceeded(total=result.total, limit=EXPORT_MAX_ROWS)
    return _csv_stream(SIGNAL_EXPORT_COLUMNS, map(_signal_row, result.items)), result.total


def export_selected_signals(
    db: Session, signal_ids: list[int]
) -> tuple[Iterator[str], int]:
    if len(signal_ids) > SELECTED_SIGNALS_MAX_ROWS:
        raise ExportLimitExceeded(total=len(signal_ids), limit=SELECTED_SIGNALS_MAX_ROWS)
    signals = list(
        db.scalars(
            select(RiskSignal).where(RiskSignal.id.in_(signal_ids)).options(*SIGNAL_OPTIONS)
        ).all()
    )
    by_id = {signal.id: signal for signal in signals}
    missing = tuple(signal_id for signal_id in signal_ids if signal_id not in by_id)
    if missing:
        raise ExportSelectionMissing(missing_ids=missing)
    items = [
        to_list_item(by_id[signal_id], include_priority_details=False) for signal_id in signal_ids
    ]
    return _csv_stream(SIGNAL_EXPORT_COLUMNS, map(_signal_row, items)), len(items)


def export_organizations(
    db: Session,
    *,
    search: str | None,
    region: str | None,
    organization_type: str | None,
    risk_level: str | None,
    status: str | None,
    sort: str,
    direction: str | None,
) -> tuple[Iterator[str], int]:
    result = list_organizations(
        db,
        1,
        EXPORT_MAX_ROWS + 1,
        search,
        region,
        organization_type,
        risk_level,
        status,
        sort,
        direction,
    )
    if result.total > EXPORT_MAX_ROWS:
        raise ExportLimitExceeded(total=result.total, limit=EXPORT_MAX_ROWS)
    return (
        _csv_stream(ORGANIZATION_EXPORT_COLUMNS, map(_organization_row, result.items)),
        result.total,
    )
