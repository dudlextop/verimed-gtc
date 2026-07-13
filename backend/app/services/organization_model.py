from __future__ import annotations

import statistics
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import timedelta

from sklearn.ensemble import IsolationForest  # type: ignore[import-untyped]
from sqlalchemy.orm import Session

from app.models import (
    AnalysisRun,
    MedicalOrganization,
    MedicalRecord,
    OrganizationAnomalyScore,
    OrganizationFeature,
)
from app.services.detection import RuleDetection

FEATURE_LABELS = {
    "services_per_patient": "число услуг на одного пациента",
    "services_per_doctor": "число услуг на одного врача",
    "average_cost": "средняя стоимость",
    "median_cost": "медианная стоимость",
    "high_cost_share": "доля дорогостоящих услуг",
    "repeat_share": "доля повторных услуг",
    "month_end_share": "доля услуг в последние пять дней месяца",
    "daily_load": "средняя дневная загрузка",
    "rule_signal_share": "доля сигналов по правилам",
    "month_volume_change": "изменение объёма относительно предыдущего месяца",
}


@dataclass(frozen=True)
class PeerGroup:
    key: str
    organization_ids: tuple[int, ...]
    limitation: str


@dataclass(frozen=True)
class OrganizationModelResult:
    organization_id: int
    score: float
    peer_group: PeerGroup
    explanation: str
    feature_deviations: dict[str, float]
    top_category: str


def form_peer_group(
    organization: MedicalOrganization, organizations: list[MedicalOrganization]
) -> PeerGroup:
    exact = [
        item
        for item in organizations
        if item.region == organization.region
        and item.organization_type == organization.organization_type
        and item.specialization == organization.specialization
    ]
    if len(exact) >= 4:
        return PeerGroup(
            key=f"{organization.region}|{organization.organization_type}|{organization.specialization}",
            organization_ids=tuple(item.id for item in exact),
            limitation="",
        )
    by_type = [
        item
        for item in organizations
        if item.organization_type == organization.organization_type
        and item.specialization == organization.specialization
    ]
    if len(by_type) >= 4:
        return PeerGroup(
            key=f"Казахстан|{organization.organization_type}|{organization.specialization}",
            organization_ids=tuple(item.id for item in by_type),
            limitation=(
                "В регионе недостаточно сопоставимых организаций. Группа расширена до "
                "организаций того же типа и специализации по всем регионам."
            ),
        )
    by_org_type = [
        item for item in organizations if item.organization_type == organization.organization_type
    ]
    if len(by_org_type) >= 4:
        return PeerGroup(
            key=f"Казахстан|{organization.organization_type}",
            organization_ids=tuple(item.id for item in by_org_type),
            limitation=(
                "Сопоставимая группа расширена по типу организации без учёта специализации. "
                "Уверенность результата ограничена."
            ),
        )
    return PeerGroup(
        key="Все организации",
        organization_ids=tuple(item.id for item in organizations),
        limitation=(
            "Подходящая сопоставимая группа слишком мала. Использована расширенная выборка; "
            "результат не следует интерпретировать как уверенный вывод."
        ),
    )


def _feature_vector(
    records: list[MedicalRecord], doctors_count: int, rule_record_ids: set[int]
) -> dict[str, float]:
    patients = {record.patient_id for record in records}
    amounts = [float(record.amount) for record in records]
    dates = {record.service_date for record in records}
    ordered = sorted(
        records, key=lambda item: (item.patient_id, item.service_id, item.service_date)
    )
    repeats = 0
    for previous, current in zip(ordered, ordered[1:], strict=False):
        if (
            previous.patient_id == current.patient_id
            and previous.service_id == current.service_id
            and current.service_date - previous.service_date <= timedelta(days=7)
        ):
            repeats += 1
    month_counts = Counter(
        (record.service_date.year, record.service_date.month) for record in records
    )
    months = sorted(month_counts)
    previous_month = month_counts[months[-2]] if len(months) > 1 else len(records)
    current_month = month_counts[months[-1]] if months else len(records)
    features = {
        "services_per_patient": len(records) / max(1, len(patients)),
        "services_per_doctor": len(records) / max(1, doctors_count),
        "average_cost": statistics.fmean(amounts) if amounts else 0.0,
        "median_cost": statistics.median(amounts) if amounts else 0.0,
        "high_cost_share": sum(value >= 30_000 for value in amounts) / max(1, len(amounts)),
        "repeat_share": repeats / max(1, len(records)),
        "month_end_share": sum(record.service_date.day >= 26 for record in records)
        / max(1, len(records)),
        "daily_load": len(records) / max(1, len(dates)),
        "rule_signal_share": sum(record.id in rule_record_ids for record in records)
        / max(1, len(records)),
        "month_volume_change": (current_month - previous_month) / max(1, previous_month),
    }
    category_counts = Counter(record.service.category for record in records)
    for category, count in category_counts.items():
        features[f"category_share:{category}"] = count / max(1, len(records))
    return features


def calculate_organization_features(
    organizations: list[MedicalOrganization],
    records: list[MedicalRecord],
    detections: list[RuleDetection],
) -> dict[int, dict[str, float]]:
    records_by_org: dict[int, list[MedicalRecord]] = defaultdict(list)
    for record in records:
        records_by_org[record.organization_id].append(record)
    rule_ids = {detection.record_id for detection in detections}
    return {
        organization.id: _feature_vector(
            records_by_org[organization.id], len(organization.doctors), rule_ids
        )
        for organization in organizations
    }


def train_organization_models(
    db: Session,
    run: AnalysisRun,
    organizations: list[MedicalOrganization],
    features: dict[int, dict[str, float]],
    random_seed: int,
) -> dict[int, OrganizationModelResult]:
    results: dict[int, OrganizationModelResult] = {}
    processed_groups: set[str] = set()
    all_feature_names = sorted({name for values in features.values() for name in values})
    for organization in organizations:
        peer_group = form_peer_group(organization, organizations)
        if peer_group.key in processed_groups:
            continue
        processed_groups.add(peer_group.key)
        ids = list(peer_group.organization_ids)
        matrix = [
            [features[item_id].get(name, 0.0) for name in all_feature_names] for item_id in ids
        ]
        model = IsolationForest(
            n_estimators=160,
            contamination="auto",
            random_state=random_seed,
            n_jobs=1,
        )
        model.fit(matrix)
        raw_scores = [-float(value) for value in model.decision_function(matrix)]
        raw_min, raw_max = min(raw_scores), max(raw_scores)
        for index, organization_id in enumerate(ids):
            peer_medians = {
                name: statistics.median(features[item_id].get(name, 0.0) for item_id in ids)
                for name in all_feature_names
            }
            deviations = {
                name: (features[organization_id].get(name, 0.0) - median) / max(abs(median), 0.01)
                for name, median in peer_medians.items()
            }
            rank_score = (
                100 * (raw_scores[index] - raw_min) / (raw_max - raw_min)
                if raw_max > raw_min
                else 0.0
            )
            strongest = sorted(deviations.items(), key=lambda item: abs(item[1]), reverse=True)[:3]
            distance_score = min(100.0, statistics.fmean(abs(value) for _, value in strongest) * 65)
            score = round(min(100.0, 0.35 * rank_score + 0.65 * distance_score), 2)
            top_category_feature = next(
                (
                    name
                    for name, deviation in strongest
                    if name.startswith("category_share:") and deviation >= 0.6
                ),
                "",
            )
            top_category = top_category_feature.split(":", 1)[1] if top_category_feature else ""
            explanations = []
            for feature_name, deviation in strongest:
                label = (
                    feature_name.split(":", 1)[1]
                    if feature_name.startswith("category_share:")
                    else FEATURE_LABELS.get(feature_name, feature_name)
                )
                explanations.append(f"{label}: отклонение от медианы группы {deviation:+.0%}")
            explanation = "; ".join(explanations)
            results[organization_id] = OrganizationModelResult(
                organization_id=organization_id,
                score=score,
                peer_group=peer_group,
                explanation=explanation,
                feature_deviations=deviations,
                top_category=top_category,
            )
            db.add(
                OrganizationAnomalyScore(
                    analysis_run_id=run.id,
                    organization_id=organization_id,
                    score=score,
                    peer_group_key=peer_group.key,
                    peer_group_size=len(ids),
                    limitation=peer_group.limitation,
                    explanation=explanation,
                )
            )
            for feature_name in all_feature_names:
                value = features[organization_id].get(feature_name, 0.0)
                db.add(
                    OrganizationFeature(
                        analysis_run_id=run.id,
                        organization_id=organization_id,
                        feature_name=feature_name,
                        value=value,
                        peer_median=peer_medians[feature_name],
                        deviation=deviations[feature_name],
                    )
                )
    db.flush()
    return results
