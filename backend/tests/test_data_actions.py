import csv
import io
from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.models import (
    AnalysisRun,
    FinancialImpactSnapshot,
    MedicalOrganization,
    OrganizationPrioritySnapshot,
    ReviewPriority,
    ReviewStatus,
    RiskLevel,
    RiskSignal,
)
from app.services import exports as export_service
from app.services.exports import _csv_stream, csv_safe_cell
from app.services.regional_monitoring import get_regional_monitoring
from app.services.regions import canonicalize_region


def _csv_rows(response_text: str) -> list[dict[str, str]]:
    return list(csv.DictReader(io.StringIO(response_text.lstrip("\ufeff")), delimiter=";"))


def test_overview_adds_timeline_and_regional_monitoring(client: TestClient) -> None:
    response = client.get("/api/analytics/overview")
    assert response.status_code == 200
    payload = response.json()
    assert payload["schema_version"] == 2
    assert payload["timeline"] == client.get("/api/analytics/timeline").json()
    assert payload["regional_monitoring"]
    regions = payload["regional_monitoring"]
    assert [item["region_name"] for item in regions] == sorted(
        item["region_name"] for item in regions
    )
    assert sum(item["signal_count"] for item in regions) == 1441
    assert any(item["signal_count"] != item["unique_record_count"] for item in regions)
    assert all(item["leading_organization"] for item in regions)
    assert all(item["maximum_priority"] > 0 for item in regions)


def test_region_canonicalization_is_explicit_and_stable() -> None:
    assert canonicalize_region("  Восточно-Казахстанская   область ").code == "KZ-VOS"
    assert canonicalize_region("ВКО").name == "Восточно-Казахстанская область"
    unknown = canonicalize_region("Регион без справочника")
    assert unknown.known is False
    assert unknown.code == canonicalize_region("регион без справочника").code
    assert unknown.code.startswith("unknown-")


def test_regional_monitoring_handles_unknown_and_empty_datasets() -> None:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        assert get_regional_monitoring(db) == []
        run = AnalysisRun(
            started_at=datetime(2026, 7, 15, tzinfo=UTC).replace(tzinfo=None),
            completed_at=datetime(2026, 7, 15, tzinfo=UTC).replace(tzinfo=None),
            period_start=date(2026, 1, 1),
            period_end=date(2026, 7, 15),
            records_processed=1,
            status="Обработка завершена",
        )
        organization = MedicalOrganization(
            name="Организация неизвестного региона",
            region="Регион без справочника",
            organization_type="Диагностический центр",
            risk_score=70,
        )
        db.add_all([run, organization])
        db.flush()
        signal = RiskSignal(
            medical_record_id=999,
            organization_id=organization.id,
            analysis_run_id=run.id,
            score=75,
            level=RiskLevel.HIGH,
            primary_reason="Отклонение от сопоставимого диапазона",
            anomaly_type="cost_deviation",
            status=ReviewStatus.UNREVIEWED,
        )
        db.add(signal)
        db.flush()
        db.add_all(
            [
                ReviewPriority(
                    analysis_run_id=run.id,
                    signal_id=signal.id,
                    score=77,
                    level=RiskLevel.HIGH,
                    financial_significance=Decimal("123456"),
                    linked_record_ids=[10, 11],
                    repetition_count=2,
                    affected_patients=1,
                    duration_days=1,
                    factors=[],
                    explanation="Тестовый приоритет",
                ),
                OrganizationPrioritySnapshot(
                    analysis_run_id=run.id,
                    organization_id=organization.id,
                    score=76,
                    level=RiskLevel.HIGH,
                    financial_significance=Decimal("123456"),
                    high_critical_signals=1,
                    affected_patients=1,
                    duration_days=1,
                    unreviewed_share=1.0,
                    factors=[],
                    explanation="Тестовый приоритет организации",
                ),
                FinancialImpactSnapshot(
                    analysis_run_id=run.id,
                    scope_type="region",
                    scope_key=organization.region,
                    total_services_amount=Decimal("123456"),
                    signal_services_amount=Decimal("123456"),
                    high_critical_amount=Decimal("123456"),
                    confirmed_amount=Decimal("0"),
                    rejected_amount=Decimal("0"),
                    unreviewed_amount=Decimal("123456"),
                    affected_records=2,
                    affected_patients=1,
                    unique_record_ids=[10, 11],
                ),
            ]
        )
        db.flush()
        result = get_regional_monitoring(db)
        assert len(result) == 1
        assert result[0].region_code.startswith("unknown-")
        assert result[0].signal_count == 1
        assert result[0].unique_record_count == 2
        assert result[0].financial_significance == Decimal("123456")
        assert result[0].maximum_priority == 77
        assert result[0].leading_organization is not None


def test_signal_csv_matches_filters_sort_and_ignores_pagination(client: TestClient) -> None:
    listing = client.get(
        "/api/signals?page=1&page_size=1&region=Алматы&sort=financial"
    ).json()
    response = client.get(
        "/api/exports/signals.csv?page=3&page_size=1&region=Алматы&sort=financial"
    )
    assert response.status_code == 200
    rows = _csv_rows(response.text)
    assert int(response.headers["x-export-rows"]) == listing["total"]
    assert len(rows) == listing["total"]
    assert rows[0]["Медицинская организация"] == listing["items"][0]["organization_name"]
    assert rows[0]["Финансовая значимость"].endswith("₸")
    assert "fingerprint" not in response.text.casefold()
    assert "Код пациента" not in response.text


def test_signal_csv_reuses_search_date_range_and_direction(client: TestClient) -> None:
    params = (
        "search=томография&date_from=2026-02-01&date_to=2026-06-30"
        "&sort=date&direction=asc"
    )
    listing = client.get(f"/api/signals?page_size=100&{params}").json()
    response = client.get(f"/api/exports/signals.csv?{params}")
    assert response.status_code == 200
    rows = _csv_rows(response.text)
    assert len(rows) == listing["total"]
    assert rows[0]["Сигнал"] == f"№ {listing['items'][0]['id']}"
    dates = [datetime.strptime(row["Дата услуги"], "%d.%m.%Y").date() for row in rows]
    assert dates == sorted(dates)
    assert all(date(2026, 2, 1) <= value <= date(2026, 6, 30) for value in dates)


def test_organization_csv_matches_list_filters_and_sort(client: TestClient) -> None:
    listing = client.get(
        "/api/organizations?page_size=1&region=Астана&sort=name"
    ).json()
    response = client.get("/api/exports/organizations.csv?region=Астана&sort=name")
    assert response.status_code == 200
    rows = _csv_rows(response.text)
    assert len(rows) == listing["total"]
    assert rows[0]["Медицинская организация"] == listing["items"][0]["name"]
    assert response.headers["content-disposition"] == (
        'attachment; filename="verimed-organizations.csv"'
    )

    descending = client.get(
        "/api/exports/organizations.csv?region=Астана&sort=name&direction=desc"
    )
    descending_rows = _csv_rows(descending.text)
    assert [row["Медицинская организация"] for row in descending_rows] == sorted(
        (row["Медицинская организация"] for row in descending_rows), reverse=True
    )


def test_selected_signal_csv_deduplicates_and_preserves_order(client: TestClient) -> None:
    items = client.get("/api/signals?page_size=2&sort=date").json()["items"]
    ids = [items[1]["id"], items[0]["id"], items[1]["id"]]
    response = client.post("/api/exports/signals.csv", json={"signal_ids": ids})
    assert response.status_code == 200
    assert response.headers["x-export-rows"] == "2"
    rows = _csv_rows(response.text)
    assert [row["Сигнал"] for row in rows] == [f"№ {ids[0]}", f"№ {ids[1]}"]


@pytest.mark.parametrize(
    "payload",
    [
        {"signal_ids": []},
        {"signal_ids": [-1]},
        {"signal_ids": [True]},
        {"signal_ids": ["1"]},
    ],
)
def test_selected_signal_csv_validates_ids(client: TestClient, payload: dict[str, object]) -> None:
    response = client.post("/api/exports/signals.csv", json=payload)
    assert response.status_code == 422


def test_selected_signal_csv_reports_missing_ids(client: TestClient) -> None:
    response = client.post("/api/exports/signals.csv", json={"signal_ids": [999999]})
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "signals_not_found"
    assert response.json()["detail"]["missing_ids"] == [999999]


def test_csv_export_limit_is_structured(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(export_service, "EXPORT_MAX_ROWS", 1)
    response = client.get("/api/exports/signals.csv")
    assert response.status_code == 413
    assert response.json()["detail"] == {
        "code": "export_limit_exceeded",
        "message": "В выборке 1441 строк. Сузьте фильтры до 1 строк.",
        "limit": 1,
        "total": 1441,
    }


def test_csv_formula_injection_and_escaping() -> None:
    assert csv_safe_cell("=SUM(A1:A2)") == "'=SUM(A1:A2)"
    assert csv_safe_cell("+команда") == "'+команда"
    assert csv_safe_cell("-текст") == "'-текст"
    assert csv_safe_cell("@ссылка") == "'@ссылка"
    assert csv_safe_cell("\tформула") == "'\tформула"
    assert csv_safe_cell("\rформула") == "'\rформула"
    assert csv_safe_cell(-125.5) == -125.5
    content = "".join(_csv_stream(("Текст",), [('Кавычки "и"\nперенос',)]))
    assert list(csv.reader(io.StringIO(content.lstrip("\ufeff")), delimiter=";"))[1][0] == (
        'Кавычки "и"\nперенос'
    )
