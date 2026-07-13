from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    ExpertDecisionEvent,
    RecurringPattern,
    ReviewPriority,
    ReviewStatus,
    RiskSignal,
    SignalFingerprintHistory,
)
from app.services.expert_decisions import calculate_event_hash, verify_integrity
from app.services.financial_priority import calculate_review_priority
from app.services.fingerprints import signal_fingerprint


def _first_signal(db: Session) -> RiskSignal:
    signal = db.scalar(
        select(RiskSignal)
        .options(
            selectinload(RiskSignal.record),
            selectinload(RiskSignal.organization),
            selectinload(RiskSignal.review_priority),
        )
        .order_by(RiskSignal.id)
    )
    assert signal is not None
    assert signal.fingerprint is not None
    return signal


def test_signal_fingerprint_is_reproducible_and_sensitive(db_session: Session) -> None:
    signal = _first_signal(db_session)
    original = signal_fingerprint(signal, signal.record)
    assert original == signal_fingerprint(signal, signal.record) == signal.fingerprint
    amount = signal.record.amount
    signal.record.amount = amount + Decimal("10000")
    changed = signal_fingerprint(signal, signal.record)
    signal.record.amount = amount
    assert changed != original


def test_legacy_review_creates_append_only_event(client: TestClient, db_session: Session) -> None:
    signal = _first_signal(db_session)
    before = db_session.scalar(select(func.count(ExpertDecisionEvent.id))) or 0
    response = client.post(
        f"/api/signals/{signal.id}/review",
        json={
            "status": ReviewStatus.CONFIRMED.value,
            "comment": "Доступные сведения сопоставлены специалистом.",
            "reason_code": "данные подтверждают отклонение",
            "reviewer_name": "Эксперт 01",
        },
    )
    assert response.status_code == 200
    db_session.expire_all()
    events = list(
        db_session.scalars(
            select(ExpertDecisionEvent)
            .where(ExpertDecisionEvent.entity_fingerprint == signal.fingerprint)
            .order_by(ExpertDecisionEvent.id)
        ).all()
    )
    assert (db_session.scalar(select(func.count(ExpertDecisionEvent.id))) or 0) == before + 1
    assert events[-1].event_hash == calculate_event_hash(events[-1])
    assert response.json()["reviews"][0]["comment"] == events[-1].comment


def test_refinement_adds_event_and_preserves_previous(
    client: TestClient, db_session: Session
) -> None:
    signal = _first_signal(db_session)
    history = client.get(f"/api/signals/{signal.id}/decision-history").json()
    previous = history["events"][-1]
    response = client.post(
        f"/api/signals/{signal.id}/decision-events",
        json={
            "action_type": "Решение уточнено",
            "decision_status": ReviewStatus.ESCALATED.value,
            "reason_code": "требуется запрос документов",
            "comment": "Требуется сопоставить дополнительные документы.",
            "reviewer_id": "expert-002",
            "reviewer_display_name": "Эксперт 02",
            "supersedes_event_id": previous["id"],
        },
    )
    assert response.status_code == 200
    updated = client.get(f"/api/signals/{signal.id}/decision-history").json()
    assert len(updated["events"]) == len(history["events"]) + 1
    assert updated["events"][0]["id"] == previous["id"]
    assert updated["events"][-1]["supersedes_event_id"] == previous["id"]
    assert updated["current_status"] == ReviewStatus.ESCALATED.value


def test_history_is_restored_after_next_analysis(client: TestClient, db_session: Session) -> None:
    signal = _first_signal(db_session)
    fingerprint = signal.fingerprint
    response = client.post("/api/analysis/run", json={"seed": 20260712})
    assert response.status_code == 200
    db_session.expire_all()
    current = db_session.scalar(
        select(RiskSignal)
        .where(RiskSignal.fingerprint == fingerprint)
        .order_by(RiskSignal.analysis_run_id.desc(), RiskSignal.id.desc())
    )
    assert current is not None
    assert current.status == ReviewStatus.ESCALATED
    history = client.get(f"/api/signals/by-fingerprint/{fingerprint}/decision-history").json()
    recurrence = client.get(f"/api/signals/{current.id}/recurrence-history").json()
    assert history["history_found"] is True
    assert recurrence["appeared_runs"] >= 2


def test_pattern_history_uses_existing_fingerprint(client: TestClient, db_session: Session) -> None:
    pattern = db_session.scalar(
        select(RecurringPattern)
        .where(RecurringPattern.is_active.is_(True))
        .order_by(RecurringPattern.importance_score.desc())
    )
    assert pattern is not None
    response = client.post(
        f"/api/patterns/{pattern.id}/decision-events",
        json={
            "action_type": "Значимость модели подтверждена",
            "decision_status": "Значимость подтверждена",
            "reason_code": "повторяемость требует дополнительного внимания",
            "comment": "Модель наблюдается в нескольких периодах.",
            "feedback": {
                "usefulness": "Полезный",
                "grouping_correctness": "Корректная",
                "graph_usefulness": "Полезный",
                "comment": "",
            },
        },
    )
    assert response.status_code == 200
    history = client.get(
        f"/api/patterns/by-fingerprint/{pattern.fingerprint}/decision-history"
    ).json()
    assert history["events"][-1]["feedback"]["grouping_correctness"] == "Корректная"


def test_hash_chain_detects_tampering(db_session: Session) -> None:
    assert verify_integrity(db_session, persist=False).is_valid is True
    event = db_session.scalar(select(ExpertDecisionEvent).order_by(ExpertDecisionEvent.id))
    assert event is not None
    original = event.comment
    event.comment = f"{original} изменено"
    db_session.flush()
    invalid = verify_integrity(db_session, persist=False)
    assert invalid.is_valid is False
    assert invalid.mismatch_count >= 1
    event.comment = original
    db_session.flush()
    assert verify_integrity(db_session, persist=False).is_valid is True
    db_session.commit()


def test_expert_analytics_and_journal_api_are_structured(client: TestClient) -> None:
    journal = client.get("/api/decision-journal")
    summary = client.get("/api/analytics/expert-review-summary")
    by_signal = client.get("/api/analytics/expert-review-by-signal-type")
    integrity = client.get("/api/decision-journal/integrity")
    assert journal.status_code == summary.status_code == by_signal.status_code == 200
    assert journal.json()["items"][0]["entity_fingerprint"]
    assert "sample_sufficient" in summary.json()
    assert all("category" in item for item in by_signal.json())
    assert integrity.json()["is_valid"] is True


def test_history_factor_remains_within_existing_weight() -> None:
    unreviewed = calculate_review_priority(
        55, 50, 2, 1, ReviewStatus.UNREVIEWED, False, Decimal("100000"), 20
    )
    rejected = calculate_review_priority(
        55, 50, 2, 1, ReviewStatus.REJECTED, False, Decimal("100000"), 20
    )
    confirmed = calculate_review_priority(
        55, 50, 2, 1, ReviewStatus.COMPLETED, True, Decimal("100000"), 20
    )
    assert abs(unreviewed.score - rejected.score) <= 10
    assert abs(confirmed.score - rejected.score) <= 10


def test_signal_history_snapshots_are_one_per_fingerprint_and_run(
    db_session: Session,
) -> None:
    duplicates = db_session.execute(
        select(
            SignalFingerprintHistory.entity_fingerprint,
            SignalFingerprintHistory.analysis_run_id,
            func.count(SignalFingerprintHistory.id),
        )
        .group_by(
            SignalFingerprintHistory.entity_fingerprint,
            SignalFingerprintHistory.analysis_run_id,
        )
        .having(func.count(SignalFingerprintHistory.id) > 1)
    ).all()
    assert duplicates == []
    priority = db_session.scalar(select(ReviewPriority).order_by(ReviewPriority.score.desc()))
    assert priority is not None
