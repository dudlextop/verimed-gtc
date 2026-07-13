from __future__ import annotations

import random
from collections import defaultdict
from datetime import date, time, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import Doctor, MedicalOrganization, MedicalRecord, MedicalService, Patient
from app.synthetic.catalog import (
    ORGANIZATION_NAMES,
    ORGANIZATION_TYPES,
    REGIONS,
    SERVICE_SPECS,
    SPECIALTIES,
)


def create_reference_data(
    db: Session, rng: random.Random
) -> tuple[list[MedicalOrganization], list[Patient], list[Doctor], list[MedicalService]]:
    organizations = [
        MedicalOrganization(
            name=name,
            region=REGIONS[index // 4],
            organization_type=ORGANIZATION_TYPES[index % len(ORGANIZATION_TYPES)],
            specialization=("Диагностика" if index % 5 == 2 else "Общий профиль"),
            capacity=420 + (index % 5) * 130 + (index // 5) * 25,
        )
        for index, name in enumerate(ORGANIZATION_NAMES)
    ]
    db.add_all(organizations)
    services = [
        MedicalService(
            code=f"SVC-{index + 1:03d}",
            name=spec.name,
            category=spec.category,
            typical_cost=Decimal(spec.cost),
            minimum_interval_days=spec.minimum_interval_days,
            expected_duration_minutes=spec.duration_minutes,
            maximum_frequency_30d=spec.maximum_frequency_30d,
            allowed_organization_types=list(spec.allowed_types),
        )
        for index, spec in enumerate(SERVICE_SPECS)
    ]
    db.add_all(services)
    patients = [
        Patient(
            anonymous_code=f"PT-{index + 1:06d}",
            age_group=rng.choice(["0–17", "18–34", "35–49", "50–64", "65+"]),
            sex=rng.choice(["Женский", "Мужской"]),
        )
        for index in range(2000)
    ]
    db.add_all(patients)
    db.flush()
    doctors = [
        Doctor(
            anonymous_code=f"DR-{index + 1:04d}",
            specialty=SPECIALTIES[index % len(SPECIALTIES)],
            organization_id=organizations[index // 5].id,
        )
        for index in range(100)
    ]
    db.add_all(doctors)
    db.flush()
    return organizations, patients, doctors, services


def generate_normal_records(
    db: Session,
    rng: random.Random,
    organizations: list[MedicalOrganization],
    patients: list[Patient],
    doctors: list[Doctor],
    services: list[MedicalService],
    count: int = 13_800,
) -> list[MedicalRecord]:
    start = date(2026, 1, 1)
    end = date(2026, 6, 30)
    doctors_by_org: dict[int, list[Doctor]] = defaultdict(list)
    services_by_type: dict[str, list[MedicalService]] = defaultdict(list)
    for doctor in doctors:
        doctors_by_org[doctor.organization_id].append(doctor)
    for service in services:
        for organization_type in service.allowed_organization_types:
            services_by_type[organization_type].append(service)

    last_service_date: dict[tuple[int, int], date] = {}
    occupied: dict[tuple[int, date], list[tuple[int, int]]] = defaultdict(list)
    exact_keys: set[tuple[int, int, int, int, date, time, Decimal]] = set()
    records: list[MedicalRecord] = []
    while len(records) < count:
        organization = rng.choice(organizations)
        service = rng.choice(services_by_type[organization.organization_type])
        patient = rng.choice(patients)
        doctor = rng.choice(doctors_by_org[organization.id])
        service_date = start + timedelta(days=rng.randrange((end - start).days + 1))
        previous = last_service_date.get((patient.id, service.id))
        if previous and abs((service_date - previous).days) < service.minimum_interval_days:
            continue
        start_minute = rng.randrange(8 * 60, 17 * 60, 15)
        end_minute = start_minute + service.expected_duration_minutes
        if any(
            start_minute < existing_end and end_minute > existing_start
            for existing_start, existing_end in occupied[(patient.id, service_date)]
        ):
            continue
        service_time = time(hour=start_minute // 60, minute=start_minute % 60)
        factor = min(1.22, max(0.78, rng.lognormvariate(0, 0.07)))
        amount = (service.typical_cost * Decimal(str(factor))).quantize(Decimal("1"))
        key = (
            patient.id,
            organization.id,
            service.id,
            doctor.id,
            service_date,
            service_time,
            amount,
        )
        if key in exact_keys:
            continue
        record = MedicalRecord(
            organization_id=organization.id,
            patient_id=patient.id,
            doctor_id=doctor.id,
            service_id=service.id,
            service_date=service_date,
            service_time=service_time,
            amount=amount,
            is_ground_truth_anomaly=False,
        )
        records.append(record)
        exact_keys.add(key)
        occupied[(patient.id, service_date)].append((start_minute, end_minute))
        last_service_date[(patient.id, service.id)] = service_date
        if len(records) % 2000 == 0:
            db.add_all(records[-2000:])
            db.flush()
    remainder = len(records) % 2000
    if remainder:
        db.add_all(records[-remainder:])
        db.flush()
    return records
