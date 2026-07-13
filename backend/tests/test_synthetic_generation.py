import random
from collections import Counter

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base
from app.models import MedicalRecord
from app.synthetic.catalog import ANOMALY_LABELS
from app.synthetic.generator import create_reference_data, generate_normal_records
from app.synthetic.injectors import INJECTORS


def _small_normal_signature(seed: int) -> list[tuple[object, ...]]:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    local_session = sessionmaker(bind=engine)
    with local_session() as db:
        rng = random.Random(seed)
        organizations, patients, doctors, services = create_reference_data(db, rng)
        records = generate_normal_records(
            db, rng, organizations, patients, doctors, services, count=250
        )
        signature = [
            (
                record.organization_id,
                record.patient_id,
                record.doctor_id,
                record.service_id,
                record.service_date,
                record.service_time,
                record.amount,
            )
            for record in records
        ]
    engine.dispose()
    return signature


def test_normal_generation_contains_no_ground_truth_labels() -> None:
    signature = _small_normal_signature(1204)
    assert len(signature) == 250
    assert len(set(signature)) == 250


def test_normal_generation_is_reproducible() -> None:
    assert _small_normal_signature(20260712) == _small_normal_signature(20260712)
    assert _small_normal_signature(20260712) != _small_normal_signature(20260713)


def _assert_injected_count(db_session: Session, anomaly_type: str) -> None:
    count = db_session.scalar(
        select(func.count(MedicalRecord.id)).where(
            MedicalRecord.ground_truth_anomaly_type == anomaly_type
        )
    )
    assert count == 150
    assert anomaly_type in INJECTORS


def test_exact_duplicate_injection(db_session: Session) -> None:
    _assert_injected_count(db_session, "exact_duplicate")


def test_short_interval_repeat_injection(db_session: Session) -> None:
    _assert_injected_count(db_session, "short_interval_repeat")


def test_temporal_conflict_injection(db_session: Session) -> None:
    _assert_injected_count(db_session, "temporal_conflict")


def test_excessive_frequency_injection(db_session: Session) -> None:
    _assert_injected_count(db_session, "excessive_frequency")


def test_price_deviation_injection(db_session: Session) -> None:
    _assert_injected_count(db_session, "price_deviation")


def test_profile_mismatch_injection(db_session: Session) -> None:
    _assert_injected_count(db_session, "organization_profile_mismatch")


def test_end_of_month_spike_injection(db_session: Session) -> None:
    _assert_injected_count(db_session, "end_of_month_spike")


def test_peer_group_anomaly_injection(db_session: Session) -> None:
    _assert_injected_count(db_session, "peer_group_anomaly")


def test_total_injected_share_is_eight_percent(db_session: Session) -> None:
    total = db_session.scalar(select(func.count(MedicalRecord.id))) or 0
    anomaly_count = (
        db_session.scalar(
            select(func.count(MedicalRecord.id)).where(
                MedicalRecord.is_ground_truth_anomaly.is_(True)
            )
        )
        or 0
    )
    assert total == 15_000
    assert anomaly_count == 1_200
    assert anomaly_count / total == 0.08
    counts = Counter(
        db_session.scalars(
            select(MedicalRecord.ground_truth_anomaly_type).where(
                MedicalRecord.is_ground_truth_anomaly.is_(True)
            )
        ).all()
    )
    assert set(counts) == set(ANOMALY_LABELS)
