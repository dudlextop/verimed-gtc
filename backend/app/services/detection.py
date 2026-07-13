from __future__ import annotations

import calendar
import statistics
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import MedicalRecord
from app.synthetic.catalog import ANOMALY_LABELS

COMMON_LIMITATION = (
    "Анализ основан на доступных обезличенных данных; клиническое обоснование "
    "должно быть оценено специалистом."
)


@dataclass(frozen=True)
class RuleDetection:
    record_id: int
    anomaly_type: str
    severity: float
    related_record_ids: tuple[int, ...]
    actual_value: str
    typical_value: str
    explanation: str
    limitation: str = COMMON_LIMITATION


def load_records(db: Session) -> list[MedicalRecord]:
    return list(
        db.scalars(
            select(MedicalRecord)
            .options(
                selectinload(MedicalRecord.service),
                selectinload(MedicalRecord.organization),
                selectinload(MedicalRecord.patient),
            )
            .order_by(MedicalRecord.id)
        ).all()
    )


def detect_exact_duplicates(records: list[MedicalRecord]) -> list[RuleDetection]:
    groups: dict[tuple[object, ...], list[MedicalRecord]] = defaultdict(list)
    for record in records:
        groups[
            (
                record.patient_id,
                record.organization_id,
                record.service_id,
                record.doctor_id,
                record.service_date,
                record.service_time,
                record.amount,
            )
        ].append(record)
    detections: list[RuleDetection] = []
    for group in groups.values():
        if len(group) < 2:
            continue
        related = tuple(item.id for item in group)
        for record in group[1:]:
            detections.append(
                RuleDetection(
                    record_id=record.id,
                    anomaly_type="exact_duplicate",
                    severity=min(100.0, 88.0 + (len(group) - 2) * 4),
                    related_record_ids=related,
                    actual_value=f"{len(group)} полностью совпадающие записи",
                    typical_value="одна запись об оказанной услуге",
                    explanation=(
                        "Обнаружены записи с одинаковыми пациентом, организацией, услугой, "
                        "врачом, датой, временем и суммой."
                    ),
                )
            )
    return detections


def detect_short_interval_repeats(records: list[MedicalRecord]) -> list[RuleDetection]:
    groups: dict[tuple[int, int], list[MedicalRecord]] = defaultdict(list)
    for record in records:
        if record.service.minimum_interval_days > 0:
            groups[(record.patient_id, record.service_id)].append(record)
    detections: list[RuleDetection] = []
    for group in groups.values():
        ordered = sorted(group, key=lambda item: (item.service_date, item.service_time, item.id))
        for previous, current in zip(ordered, ordered[1:], strict=False):
            previous_at = datetime.combine(previous.service_date, previous.service_time)
            current_at = datetime.combine(current.service_date, current.service_time)
            interval = current_at - previous_at
            minimum = timedelta(days=current.service.minimum_interval_days)
            if interval <= timedelta(0) or interval >= minimum:
                continue
            days = interval.total_seconds() / 86_400
            days_text = f"{days:.1f}".replace(".", ",")
            severity = min(100.0, 65.0 + 30.0 * (1 - days / max(1, minimum.days)))
            detections.append(
                RuleDetection(
                    record_id=current.id,
                    anomaly_type="short_interval_repeat",
                    severity=severity,
                    related_record_ids=(previous.id, current.id),
                    actual_value=f"интервал {days_text} дня",
                    typical_value=f"не менее {current.service.minimum_interval_days} дней",
                    explanation=(
                        f"Медицинская услуга зарегистрирована повторно через {days_text} дня. "
                        f"Для неё установлен минимальный интервал "
                        f"{current.service.minimum_interval_days} дней."
                    ),
                )
            )
    return detections


def detect_temporal_conflicts(records: list[MedicalRecord]) -> list[RuleDetection]:
    groups: dict[tuple[int, object], list[MedicalRecord]] = defaultdict(list)
    for record in records:
        groups[(record.patient_id, record.service_date)].append(record)
    detections: list[RuleDetection] = []
    seen: set[int] = set()
    for group in groups.values():
        ordered = sorted(group, key=lambda item: (item.service_time, item.id))
        for index, current in enumerate(ordered):
            current_start = datetime.combine(current.service_date, current.service_time)
            current_end = current_start + timedelta(
                minutes=current.service.expected_duration_minutes
            )
            for previous in ordered[max(0, index - 4) : index]:
                if previous.organization_id == current.organization_id:
                    continue
                previous_start = datetime.combine(previous.service_date, previous.service_time)
                previous_end = previous_start + timedelta(
                    minutes=previous.service.expected_duration_minutes
                )
                overlap = (
                    min(current_end, previous_end) - max(current_start, previous_start)
                ).total_seconds() / 60
                if overlap <= 0 or current.id in seen:
                    continue
                seen.add(current.id)
                detections.append(
                    RuleDetection(
                        record_id=current.id,
                        anomaly_type="temporal_conflict",
                        severity=min(100.0, 72.0 + overlap / 3),
                        related_record_ids=(previous.id, current.id),
                        actual_value=f"пересечение {overlap:.0f} минут",
                        typical_value="услуги не пересекаются по времени",
                        explanation=(
                            "Услуги одному пациенту зарегистрированы в разных организациях "
                            f"с пересечением предполагаемого времени на {overlap:.0f} минут."
                        ),
                    )
                )
    return detections


def detect_excessive_frequency(records: list[MedicalRecord]) -> list[RuleDetection]:
    groups: dict[tuple[int, int], list[MedicalRecord]] = defaultdict(list)
    for record in records:
        groups[(record.patient_id, record.service_id)].append(record)
    by_record: dict[int, RuleDetection] = {}
    for group in groups.values():
        ordered = sorted(group, key=lambda item: (item.service_date, item.service_time, item.id))
        window: deque[MedicalRecord] = deque()
        for current in ordered:
            while window and current.service_date - window[0].service_date > timedelta(days=30):
                window.popleft()
            window.append(current)
            maximum = current.service.maximum_frequency_30d
            if len(window) <= maximum:
                continue
            severity = min(100.0, 60.0 + (len(window) - maximum) * 10.0)
            related = tuple(item.id for item in window)
            for item in window:
                by_record[item.id] = RuleDetection(
                    record_id=item.id,
                    anomaly_type="excessive_frequency",
                    severity=severity,
                    related_record_ids=related,
                    actual_value=f"{len(window)} услуг за 30 дней",
                    typical_value=f"не более {maximum} услуг за 30 дней",
                    explanation=(
                        f"У пациента зарегистрировано {len(window)} одинаковых услуг за 30 дней. "
                        f"Ожидаемый диапазон — не более {maximum}."
                    ),
                )
    return list(by_record.values())


def _median_and_mad(values: list[float]) -> tuple[float, float]:
    median = statistics.median(values)
    mad = statistics.median(abs(value - median) for value in values)
    return median, mad


def detect_price_deviations(records: list[MedicalRecord]) -> list[RuleDetection]:
    peer_values: dict[tuple[int, str], list[float]] = defaultdict(list)
    for record in records:
        peer_values[(record.service_id, record.organization.organization_type)].append(
            float(record.amount)
        )
    detections: list[RuleDetection] = []
    for record in records:
        values = peer_values[(record.service_id, record.organization.organization_type)]
        if len(values) < 20:
            values = [
                float(item.amount) for item in records if item.service_id == record.service_id
            ]
        median, mad = _median_and_mad(values)
        robust_limit = median + max(median * 0.42, 5 * mad)
        amount = float(record.amount)
        if amount <= robust_limit:
            continue
        deviation = (amount / median - 1) * 100 if median else 0.0
        amount_text = f"{amount:,.0f}".replace(",", " ")
        median_text = f"{median:,.0f}".replace(",", " ")
        deviation_text = f"{deviation:.1f}".replace(".", ",")
        detections.append(
            RuleDetection(
                record_id=record.id,
                anomaly_type="price_deviation",
                severity=min(100.0, 58.0 + deviation / 2),
                related_record_ids=(record.id,),
                actual_value=f"{amount_text} тенге; отклонение {deviation_text}%",
                typical_value=f"медиана {median_text} тенге",
                explanation=(
                    f"Стоимость услуги составляет {amount_text} тенге. Медианная стоимость "
                    f"в сопоставимых организациях — {median_text} тенге. "
                    f"Отклонение составляет {deviation_text}%."
                ),
            )
        )
    return detections


def detect_organization_profile_mismatches(
    records: list[MedicalRecord],
) -> list[RuleDetection]:
    return [
        RuleDetection(
            record_id=record.id,
            anomaly_type="organization_profile_mismatch",
            severity=78.0,
            related_record_ids=(record.id,),
            actual_value=f"услуга категории «{record.service.category}»",
            typical_value=f"профиль «{record.organization.organization_type}»",
            explanation=(
                f"Услуга «{record.service.name}» не входит в перечень услуг для типа "
                f"«{record.organization.organization_type}»."
            ),
        )
        for record in records
        if record.organization.organization_type not in record.service.allowed_organization_types
    ]


def detect_end_of_month_spikes(records: list[MedicalRecord]) -> list[RuleDetection]:
    grouped: dict[tuple[int, int, int], list[MedicalRecord]] = defaultdict(list)
    for record in records:
        grouped[
            (record.organization_id, record.service_date.year, record.service_date.month)
        ].append(record)
    type_rates: dict[tuple[str, int, int], list[float]] = defaultdict(list)
    period_rates: dict[tuple[int, int, int], float] = {}
    for key, group in grouped.items():
        organization_id, year, month = key
        last_day = calendar.monthrange(year, month)[1]
        last_count = sum(item.service_date.day > last_day - 5 for item in group)
        remaining_count = len(group) - last_count
        rate = (last_count / 5) / max(remaining_count / max(1, last_day - 5), 0.01)
        period_rates[key] = rate
        org_type = group[0].organization.organization_type
        type_rates[(org_type, year, month)].append(rate)
    detections: list[RuleDetection] = []
    for key, group in grouped.items():
        organization_id, year, month = key
        last_day = calendar.monthrange(year, month)[1]
        last_records = [item for item in group if item.service_date.day > last_day - 5]
        share = len(last_records) / len(group)
        peer_median = statistics.median(
            type_rates[(group[0].organization.organization_type, year, month)]
        )
        rate = period_rates[key]
        if share < 0.27 or rate < max(1.8, peer_median * 1.45):
            continue
        for record in last_records:
            detections.append(
                RuleDetection(
                    record_id=record.id,
                    anomaly_type="end_of_month_spike",
                    severity=min(100.0, 55.0 + share * 100),
                    related_record_ids=tuple(item.id for item in last_records),
                    actual_value=f"{share:.0%} услуг за последние пять дней",
                    typical_value=(
                        f"медианный коэффициент группы {peer_median:.1f}".replace(".", ",")
                    ),
                    explanation=(
                        f"На последние пять дней месяца приходится {share:.0%} услуг организации. "
                        "Показатель сопоставлен с рабочими днями остальной части месяца."
                    ),
                )
            )
    return detections


RULES = {
    "exact_duplicate": detect_exact_duplicates,
    "short_interval_repeat": detect_short_interval_repeats,
    "temporal_conflict": detect_temporal_conflicts,
    "excessive_frequency": detect_excessive_frequency,
    "price_deviation": detect_price_deviations,
    "organization_profile_mismatch": detect_organization_profile_mismatches,
    "end_of_month_spike": detect_end_of_month_spikes,
}


def run_deterministic_rules(records: list[MedicalRecord]) -> list[RuleDetection]:
    detections: list[RuleDetection] = []
    for detector in RULES.values():
        detections.extend(detector(records))
    return detections


def detection_label(anomaly_type: str) -> str:
    return ANOMALY_LABELS[anomaly_type]
