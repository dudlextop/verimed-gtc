from __future__ import annotations

import calendar
import random
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, time, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import (
    Doctor,
    GroundTruthAnomaly,
    MedicalOrganization,
    MedicalRecord,
    MedicalService,
    Patient,
)


@dataclass
class InjectionContext:
    db: Session
    rng: random.Random
    records: list[MedicalRecord]
    organizations: list[MedicalOrganization]
    patients: list[Patient]
    doctors: list[Doctor]
    services: list[MedicalService]
    doctors_by_org: dict[int, list[Doctor]] = field(init=False)

    def __post_init__(self) -> None:
        grouped: dict[int, list[Doctor]] = defaultdict(list)
        for doctor in self.doctors:
            grouped[doctor.organization_id].append(doctor)
        self.doctors_by_org = grouped


def _clone(
    source: MedicalRecord, anomaly_type: str, injection_id: str, **changes: object
) -> MedicalRecord:
    values: dict[str, object] = {
        "organization_id": source.organization_id,
        "patient_id": source.patient_id,
        "doctor_id": source.doctor_id,
        "service_id": source.service_id,
        "service_date": source.service_date,
        "service_time": source.service_time,
        "amount": source.amount,
        "is_ground_truth_anomaly": True,
        "ground_truth_anomaly_type": anomaly_type,
        "anomaly_injection_id": injection_id,
    }
    values.update(changes)
    return MedicalRecord(**values)


def _persist_group(
    context: InjectionContext,
    anomaly_type: str,
    injection_id: str,
    records: list[MedicalRecord],
    related_existing_ids: list[int],
    parameters: dict[str, str | int | float],
) -> None:
    context.db.add_all(records)
    context.db.flush()
    related_ids = related_existing_ids + [record.id for record in records]
    context.db.add(
        GroundTruthAnomaly(
            injection_id=injection_id,
            anomaly_type=anomaly_type,
            primary_record_id=records[0].id,
            related_record_ids=related_ids,
            parameters=parameters,
        )
    )
    context.records.extend(records)


def inject_exact_duplicates(context: InjectionContext, count: int) -> int:
    baseline = context.records[:]
    for index, source in enumerate(context.rng.sample(baseline, count)):
        injection_id = f"exact_duplicate-{index:04d}"
        duplicate = _clone(source, "exact_duplicate", injection_id)
        _persist_group(context, "exact_duplicate", injection_id, [duplicate], [source.id], {})
    return count


def inject_short_interval_repeats(context: InjectionContext, count: int) -> int:
    candidates = [
        record
        for record in context.records
        if record.service.minimum_interval_days >= 3
        and record.service_date <= date(2026, 6, 25)
        and not record.is_ground_truth_anomaly
    ]
    for index, source in enumerate(context.rng.sample(candidates, count)):
        injection_id = f"short_interval_repeat-{index:04d}"
        interval = max(1, source.service.minimum_interval_days // 3)
        repeated = _clone(
            source,
            "short_interval_repeat",
            injection_id,
            service_date=source.service_date + timedelta(days=interval),
            service_time=time(15, index % 4 * 15),
        )
        _persist_group(
            context,
            "short_interval_repeat",
            injection_id,
            [repeated],
            [source.id],
            {
                "actual_interval_days": interval,
                "minimum_interval_days": source.service.minimum_interval_days,
            },
        )
    return count


def inject_temporal_conflicts(context: InjectionContext, count: int) -> int:
    candidates = [record for record in context.records if not record.is_ground_truth_anomaly]
    chosen = context.rng.sample(candidates, count)
    for index, source in enumerate(chosen):
        possible = [
            organization
            for organization in context.organizations
            if organization.id != source.organization_id
            and organization.organization_type in source.service.allowed_organization_types
        ]
        organization = context.rng.choice(possible)
        injection_id = f"temporal_conflict-{index:04d}"
        conflict = _clone(
            source,
            "temporal_conflict",
            injection_id,
            organization_id=organization.id,
            doctor_id=context.rng.choice(context.doctors_by_org[organization.id]).id,
            amount=source.service.typical_cost,
        )
        _persist_group(
            context,
            "temporal_conflict",
            injection_id,
            [conflict],
            [source.id],
            {"overlap_minutes": source.service.expected_duration_minutes},
        )
    return count


def inject_excessive_frequency(context: InjectionContext, count: int) -> int:
    group_size = 6
    if count % group_size:
        raise ValueError("Количество частотных записей должно делиться на шесть")
    service = next(
        item
        for item in context.services
        if item.minimum_interval_days == 0 and item.maximum_frequency_30d == 5
    )
    allowed_orgs = [
        item
        for item in context.organizations
        if item.organization_type in service.allowed_organization_types
    ]
    for group_index in range(count // group_size):
        patient = context.patients[(group_index * 37) % len(context.patients)]
        organization = context.rng.choice(allowed_orgs)
        start = date(2026, 2 + group_index % 4, 2 + group_index % 8)
        injection_id = f"excessive_frequency-{group_index:04d}"
        records = [
            MedicalRecord(
                organization_id=organization.id,
                patient_id=patient.id,
                doctor_id=context.rng.choice(context.doctors_by_org[organization.id]).id,
                service_id=service.id,
                service_date=start + timedelta(days=offset * 3),
                service_time=time(10, (offset % 4) * 15),
                amount=service.typical_cost,
                is_ground_truth_anomaly=True,
                ground_truth_anomaly_type="excessive_frequency",
                anomaly_injection_id=injection_id,
            )
            for offset in range(group_size)
        ]
        _persist_group(
            context,
            "excessive_frequency",
            injection_id,
            records,
            [],
            {"records_in_30d": group_size, "maximum_frequency_30d": service.maximum_frequency_30d},
        )
    return count


def inject_price_deviations(context: InjectionContext, count: int) -> int:
    baseline = [record for record in context.records if not record.is_ground_truth_anomaly]
    for index, source in enumerate(context.rng.sample(baseline, count)):
        injection_id = f"price_deviation-{index:04d}"
        patient = context.patients[(source.patient_id + 701 + index) % len(context.patients)]
        factor = Decimal("1.85") + Decimal(index % 5) / Decimal("10")
        record = _clone(
            source,
            "price_deviation",
            injection_id,
            patient_id=patient.id,
            service_date=date(2026, 1 + index % 6, 5 + index % 20),
            service_time=time(11, index % 4 * 15),
            amount=(source.service.typical_cost * factor).quantize(Decimal("1")),
        )
        _persist_group(
            context,
            "price_deviation",
            injection_id,
            [record],
            [],
            {"price_factor": float(factor)},
        )
    return count


def inject_organization_profile_mismatches(context: InjectionContext, count: int) -> int:
    for index in range(count):
        organization = context.organizations[index % len(context.organizations)]
        disallowed = [
            service
            for service in context.services
            if organization.organization_type not in service.allowed_organization_types
        ]
        service = context.rng.choice(disallowed)
        injection_id = f"organization_profile_mismatch-{index:04d}"
        record = MedicalRecord(
            organization_id=organization.id,
            patient_id=context.patients[(index * 19) % len(context.patients)].id,
            doctor_id=context.rng.choice(context.doctors_by_org[organization.id]).id,
            service_id=service.id,
            service_date=date(2026, 1 + index % 6, 3 + index % 22),
            service_time=time(13, index % 4 * 15),
            amount=service.typical_cost,
            is_ground_truth_anomaly=True,
            ground_truth_anomaly_type="organization_profile_mismatch",
            anomaly_injection_id=injection_id,
        )
        _persist_group(
            context,
            "organization_profile_mismatch",
            injection_id,
            [record],
            [],
            {"organization_type": organization.organization_type},
        )
    return count


def inject_end_of_month_spikes(context: InjectionContext, count: int) -> int:
    target = context.organizations[17]
    allowed = [
        service
        for service in context.services
        if target.organization_type in service.allowed_organization_types
    ]
    for index in range(count):
        month = 1 + index % 6
        last_day = calendar.monthrange(2026, month)[1]
        injection_id = f"end_of_month_spike-{index:04d}"
        service = context.rng.choice(allowed)
        record = MedicalRecord(
            organization_id=target.id,
            patient_id=context.patients[(index * 23 + 11) % len(context.patients)].id,
            doctor_id=context.rng.choice(context.doctors_by_org[target.id]).id,
            service_id=service.id,
            service_date=date(2026, month, last_day - index % 5),
            service_time=time(9 + index % 7, index % 4 * 15),
            amount=service.typical_cost,
            is_ground_truth_anomaly=True,
            ground_truth_anomaly_type="end_of_month_spike",
            anomaly_injection_id=injection_id,
        )
        _persist_group(context, "end_of_month_spike", injection_id, [record], [], {})
    return count


def inject_peer_group_anomalies(context: InjectionContext, count: int) -> int:
    target = context.organizations[15]
    preferred = [
        service
        for service in context.services
        if service.category == "Профилактика"
        and target.organization_type in service.allowed_organization_types
    ]
    for index in range(count):
        service = context.rng.choice(preferred)
        injection_id = f"peer_group_anomaly-{index:04d}"
        record = MedicalRecord(
            organization_id=target.id,
            patient_id=context.patients[(index * 29 + 7) % len(context.patients)].id,
            doctor_id=context.rng.choice(context.doctors_by_org[target.id]).id,
            service_id=service.id,
            service_date=date(2026, 1 + index % 6, 2 + index % 24),
            service_time=time(8 + index % 8, index % 4 * 15),
            amount=service.typical_cost,
            is_ground_truth_anomaly=True,
            ground_truth_anomaly_type="peer_group_anomaly",
            anomaly_injection_id=injection_id,
        )
        _persist_group(context, "peer_group_anomaly", injection_id, [record], [], {})
    return count


Injector = Callable[[InjectionContext, int], int]
INJECTORS: dict[str, Injector] = {
    "exact_duplicate": inject_exact_duplicates,
    "short_interval_repeat": inject_short_interval_repeats,
    "temporal_conflict": inject_temporal_conflicts,
    "excessive_frequency": inject_excessive_frequency,
    "price_deviation": inject_price_deviations,
    "organization_profile_mismatch": inject_organization_profile_mismatches,
    "end_of_month_spike": inject_end_of_month_spikes,
    "peer_group_anomaly": inject_peer_group_anomalies,
}


def inject_all_anomalies(context: InjectionContext, per_type: int = 150) -> dict[str, int]:
    return {name: injector(context, per_type) for name, injector in INJECTORS.items()}
