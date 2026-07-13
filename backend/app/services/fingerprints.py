from __future__ import annotations

import hashlib
import json
from datetime import date
from decimal import Decimal
from typing import Any

from app.models import MedicalRecord, RiskSignal


def _amount_band(amount: Decimal) -> int:
    """Normalize an amount while retaining materially different financial contexts."""
    value = int(amount)
    step = 500 if value < 25_000 else 2_500
    return round(value / step) * step


def _time_period(signal: RiskSignal, record: MedicalRecord) -> str:
    if signal.anomaly_type in {
        "end_of_month_spike",
        "excessive_frequency",
        "peer_group_anomaly",
    }:
        return record.service_date.strftime("%Y-%m")
    if signal.anomaly_type in {"short_interval_repeat", "temporal_conflict"}:
        year, week, _ = record.service_date.isocalendar()
        return f"{year}-W{week:02d}"
    return record.service_date.isoformat()


def signal_fingerprint_payload(signal: RiskSignal, record: MedicalRecord) -> dict[str, Any]:
    related_count = len(set(signal.related_record_ids or [record.id]))
    relation_kind = (
        "sequence"
        if signal.anomaly_type in {"short_interval_repeat", "temporal_conflict"}
        else "group"
        if related_count > 1
        else "single"
    )
    return {
        "version": 1,
        "signal_type": signal.anomaly_type,
        "organization": record.organization_id,
        "patient": record.patient_id,
        "doctor": record.doctor_id,
        "service": record.service_id,
        "period": _time_period(signal, record),
        "relation": relation_kind,
        "related_count": related_count,
        "amount_band": _amount_band(record.amount),
    }


def signal_fingerprint(signal: RiskSignal, record: MedicalRecord) -> str:
    payload = signal_fingerprint_payload(signal, record)
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def date_periods_between(start: date, end: date) -> list[str]:
    cursor = date(start.year, start.month, 1)
    finish = date(end.year, end.month, 1)
    result: list[str] = []
    while cursor <= finish:
        result.append(cursor.strftime("%Y-%m"))
        cursor = date(cursor.year + (cursor.month == 12), cursor.month % 12 + 1, 1)
    return result
