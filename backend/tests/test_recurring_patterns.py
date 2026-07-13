from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    MedicalRecord,
    PatternFactor,
    PatternReviewStatus,
    PatternSignal,
    PatternSnapshot,
    RecurringPattern,
    ReviewPriority,
    RiskSignal,
)
from app.services.analysis_pipeline import run_analysis
from app.services.recurring_patterns import (
    PATTERN_TYPES,
    calculate_importance,
    calculate_stability,
    get_pattern_graph,
    pattern_fingerprint,
)


def test_pattern_never_contains_single_signal(db_session: Session) -> None:
    patterns = list(
        db_session.scalars(
            select(RecurringPattern).where(RecurringPattern.is_active.is_(True))
        ).all()
    )
    assert patterns
    assert all(pattern.signal_count >= 3 for pattern in patterns)
    for pattern in patterns:
        record_ids = set(
            db_session.scalars(
                select(RiskSignal.medical_record_id)
                .join(PatternSignal, PatternSignal.signal_id == RiskSignal.id)
                .where(PatternSignal.pattern_id == pattern.id)
            ).all()
        )
        assert len(record_ids) >= 2


def test_all_configured_pattern_types_are_grouped(db_session: Session) -> None:
    detected = set(
        db_session.scalars(
            select(RecurringPattern.pattern_type).where(RecurringPattern.is_active.is_(True))
        ).all()
    )
    assert detected == set(PATTERN_TYPES)


def test_fingerprint_is_stable_and_does_not_use_record_ids() -> None:
    first = pattern_fingerprint("repeated_service", ("4", "17"), (1, 2, 1))
    second = pattern_fingerprint("repeated_service", ("4", "17"), (1, 2, 1))
    changed = pattern_fingerprint("repeated_service", ("4", "18"), (1, 2, 1))
    assert first == second
    assert first != changed
    assert len(first) == 64


def test_stability_and_importance_are_explainable() -> None:
    stability, stability_factors = calculate_stability(4, 18, 82, 90, 75, 3)
    importance, importance_factors = calculate_importance(81, 88, 75, 14, 4, 2, stability)
    assert stability == sum(int(factor["contribution"]) for factor in stability_factors)
    assert importance == sum(int(factor["contribution"]) for factor in importance_factors)
    assert 0 <= stability <= 100
    assert 0 <= importance <= 100


def test_pattern_financial_significance_has_no_double_count(db_session: Session) -> None:
    pattern = db_session.scalar(
        select(RecurringPattern)
        .where(RecurringPattern.is_active.is_(True))
        .order_by(RecurringPattern.financial_significance.desc())
    )
    assert pattern is not None
    signal_ids = list(
        db_session.scalars(
            select(PatternSignal.signal_id).where(PatternSignal.pattern_id == pattern.id)
        ).all()
    )
    priorities = list(
        db_session.scalars(
            select(ReviewPriority).where(ReviewPriority.signal_id.in_(signal_ids))
        ).all()
    )
    unique_record_ids = {
        record_id for priority in priorities for record_id in priority.linked_record_ids
    }
    expected = db_session.scalar(
        select(func.sum(MedicalRecord.amount)).where(MedicalRecord.id.in_(unique_record_ids))
    ) or Decimal("0")
    assert pattern.financial_significance == expected


def test_clustering_and_fingerprints_are_reproducible(db_session: Session) -> None:
    before = {
        pattern.fingerprint: (
            pattern.pattern_type,
            pattern.signal_count,
            pattern.financial_significance,
        )
        for pattern in db_session.scalars(
            select(RecurringPattern).where(RecurringPattern.is_active.is_(True))
        ).all()
    }
    run_analysis(db_session, 20260712)
    after = {
        pattern.fingerprint: (
            pattern.pattern_type,
            pattern.signal_count,
            pattern.financial_significance,
        )
        for pattern in db_session.scalars(
            select(RecurringPattern).where(RecurringPattern.is_active.is_(True))
        ).all()
    }
    assert before == after


def test_recurring_pattern_links_to_previous_run(db_session: Session) -> None:
    pattern = db_session.scalar(
        select(RecurringPattern)
        .where(RecurringPattern.is_active.is_(True))
        .order_by(RecurringPattern.id)
    )
    assert pattern is not None
    before_runs = pattern.recurrence_runs
    before_snapshots = (
        db_session.scalar(
            select(func.count(PatternSnapshot.id)).where(PatternSnapshot.pattern_id == pattern.id)
        )
        or 0
    )
    run_analysis(db_session, 20260712)
    db_session.refresh(pattern)
    after_snapshots = (
        db_session.scalar(
            select(func.count(PatternSnapshot.id)).where(PatternSnapshot.pattern_id == pattern.id)
        )
        or 0
    )
    assert pattern.recurrence_runs == before_runs + 1
    assert after_snapshots == before_snapshots + 1


def test_pattern_factors_match_saved_scores(db_session: Session) -> None:
    pattern = db_session.scalar(
        select(RecurringPattern)
        .where(RecurringPattern.is_active.is_(True))
        .order_by(RecurringPattern.importance_score.desc())
    )
    assert pattern is not None
    factors = list(
        db_session.scalars(
            select(PatternFactor).where(PatternFactor.pattern_id == pattern.id)
        ).all()
    )
    assert (
        sum(item.contribution for item in factors if item.factor_group == "Важность")
        == pattern.importance_score
    )
    assert (
        sum(item.contribution for item in factors if item.factor_group == "Устойчивость")
        == pattern.stability_score
    )


def test_pattern_graph_has_valid_nodes_and_relationships(db_session: Session) -> None:
    pattern_id = db_session.scalar(
        select(RecurringPattern.id)
        .where(RecurringPattern.is_active.is_(True))
        .order_by(RecurringPattern.importance_score.desc())
    )
    assert pattern_id is not None
    graph = get_pattern_graph(db_session, pattern_id)
    assert graph is not None
    node_ids = {node.id for node in graph.nodes}
    assert f"pattern-{pattern_id}" in node_ids
    assert {node.node_type for node in graph.nodes} >= {"pattern", "signal", "organization"}
    assert graph.edges
    assert all(edge.source in node_ids and edge.target in node_ids for edge in graph.edges)


def test_pattern_api_returns_structured_data(client: TestClient) -> None:
    listing = client.get("/api/patterns?page_size=5&sort=importance")
    assert listing.status_code == 200
    payload = listing.json()
    assert payload["items"]
    pattern_id = payload["items"][0]["id"]
    for suffix in ["", "/signals", "/graph", "/timeline"]:
        response = client.get(f"/api/patterns/{pattern_id}{suffix}")
        assert response.status_code == 200
    assert client.get("/api/analytics/pattern-summary").json()["total_patterns"] > 0
    assert "comparison_available" in client.get("/api/analytics/pattern-changes").json()


def test_pattern_review_is_saved(client: TestClient) -> None:
    pattern_id = client.get("/api/patterns?page_size=1").json()["items"][0]["id"]
    response = client.post(
        f"/api/patterns/{pattern_id}/review",
        json={
            "status": PatternReviewStatus.ESCALATED.value,
            "comment": "Требуется сопоставить клинический контекст связанных сигналов.",
            "reviewer_name": "Аналитик",
        },
    )
    assert response.status_code == 200
    assert response.json()["review_status"] == PatternReviewStatus.ESCALATED.value
    assert response.json()["reviews"][0]["comment"]


def test_pattern_filters_and_manual_build_are_deterministic(client: TestClient) -> None:
    initial = client.get("/api/patterns?page_size=100").json()
    first = initial["items"][0]
    filtered = client.get(
        "/api/patterns?page_size=100",
        params={
            "pattern_type": first["pattern_type"],
            "organization_id": initial["organizations"][0]["id"],
            "sort": "financial",
        },
    )
    assert filtered.status_code == 200
    built = client.post("/api/analysis/build-patterns")
    assert built.status_code == 200
    assert built.json()["patterns_built"] == initial["total"]
