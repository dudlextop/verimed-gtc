from __future__ import annotations

from dataclasses import dataclass

from app.models import RiskLevel
from app.services.detection import RuleDetection, detection_label
from app.services.organization_model import OrganizationModelResult

REQUIRED_LIMITATIONS = [
    "Анализ основан на доступных обезличенных данных.",
    "Система не располагает полной клинической историей пациента.",
    "Отклонение может иметь медицинское или организационное объяснение.",
    "Итоговое решение принимает уполномоченный специалист.",
]


def _decimal_text(value: float) -> str:
    return f"{value:.1f}".replace(".", ",")


@dataclass(frozen=True)
class RiskFactorValue:
    name: str
    contribution: int
    actual_value: str
    typical_value: str
    explanation: str


@dataclass(frozen=True)
class RiskComputation:
    score: int
    level: RiskLevel
    rule_score: float
    organization_score: float
    financial_score: float
    factors: tuple[RiskFactorValue, ...]
    limitations: tuple[str, ...]
    recommendation: str


def risk_level_for_score(score: int) -> RiskLevel:
    if score >= 80:
        return RiskLevel.CRITICAL
    if score >= 60:
        return RiskLevel.HIGH
    if score >= 30:
        return RiskLevel.MEDIUM
    return RiskLevel.LOW


def _allocate(total: int, weights: list[float]) -> list[int]:
    if not weights:
        return []
    weight_sum = sum(weights) or 1.0
    raw = [total * weight / weight_sum for weight in weights]
    allocated = [int(value) for value in raw]
    remainder = total - sum(allocated)
    order = sorted(range(len(raw)), key=lambda index: raw[index] - allocated[index], reverse=True)
    for index in order[:remainder]:
        allocated[index] += 1
    return allocated


def calculate_risk(
    detections: list[RuleDetection],
    organization_result: OrganizationModelResult,
    financial_score: float,
) -> RiskComputation:
    ordered = sorted(detections, key=lambda item: item.severity, reverse=True)
    rule_score = min(
        100.0,
        ordered[0].severity + sum(item.severity for item in ordered[1:]) * 0.15,
    )
    organization_score = organization_result.score
    raw_score = 0.55 * rule_score + 0.30 * organization_score + 0.15 * financial_score
    score = max(0, min(100, round(raw_score)))
    component_parts = _allocate(
        score,
        [0.55 * rule_score, 0.30 * organization_score, 0.15 * financial_score],
    )
    rule_contribution, organization_contribution, financial_contribution = component_parts
    rule_parts = _allocate(rule_contribution, [item.severity for item in ordered])
    factors = [
        RiskFactorValue(
            name=detection_label(detection.anomaly_type),
            contribution=rule_parts[index],
            actual_value=detection.actual_value,
            typical_value=detection.typical_value,
            explanation=detection.explanation,
        )
        for index, detection in enumerate(ordered)
    ]
    factors.append(
        RiskFactorValue(
            name="Аномальность поведения организации",
            contribution=organization_contribution,
            actual_value=f"{_decimal_text(organization_score)} из 100",
            typical_value="сопоставимая группа организаций",
            explanation=organization_result.explanation,
        )
    )
    factors.append(
        RiskFactorValue(
            name="Финансовая значимость",
            contribution=financial_contribution,
            actual_value=f"{_decimal_text(financial_score)} из 100",
            typical_value="распределение сумм той же выборки",
            explanation=(
                "Финансовый вклад отражает положение суммы услуги в распределении "
                "обработанных медицинских услуг."
            ),
        )
    )
    limitations = list(REQUIRED_LIMITATIONS)
    if organization_result.peer_group.limitation:
        limitations.append(organization_result.peer_group.limitation)
    recommendation = (
        "Рекомендуется приоритетная экспертная проверка."
        if score >= 60
        else "Рекомендуется включить запись в плановую экспертную проверку."
    )
    return RiskComputation(
        score=score,
        level=risk_level_for_score(score),
        rule_score=round(rule_score, 2),
        organization_score=round(organization_score, 2),
        financial_score=round(financial_score, 2),
        factors=tuple(factors),
        limitations=tuple(limitations),
        recommendation=recommendation,
    )
