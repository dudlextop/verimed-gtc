from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    AnalysisRun,
    FinancialImpactSnapshot,
    MedicalOrganization,
    OrganizationPrioritySnapshot,
    ReviewPriority,
    RiskSignal,
)
from app.schemas import RegionalLeadingOrganization, RegionalMonitoringItem
from app.services.regions import canonicalize_region


@dataclass
class _RegionAggregate:
    name: str
    code: str
    signal_count: int = 0
    fallback_record_count: int = 0
    record_ids: set[int] = field(default_factory=set)
    financial_significance: Decimal = Decimal("0")
    organization_ids: set[int] = field(default_factory=set)
    maximum_priority: int = 0
    leading_organization: RegionalLeadingOrganization | None = None


def get_regional_monitoring(db: Session) -> list[RegionalMonitoringItem]:
    latest_run_id = db.scalar(select(func.max(AnalysisRun.id)))
    aggregates: dict[str, _RegionAggregate] = {}

    def aggregate_for(raw_region: str) -> _RegionAggregate:
        canonical = canonicalize_region(raw_region)
        return aggregates.setdefault(
            canonical.code,
            _RegionAggregate(name=canonical.name, code=canonical.code),
        )

    signal_rows = db.execute(
        select(
            MedicalOrganization.region,
            func.count(RiskSignal.id),
            func.max(ReviewPriority.score),
        )
        .join(RiskSignal, RiskSignal.organization_id == MedicalOrganization.id)
        .outerjoin(ReviewPriority, ReviewPriority.signal_id == RiskSignal.id)
        .group_by(MedicalOrganization.region)
    ).all()
    for raw_region, signal_count, maximum_priority in signal_rows:
        aggregate = aggregate_for(raw_region)
        aggregate.signal_count += signal_count
        aggregate.maximum_priority = max(aggregate.maximum_priority, maximum_priority or 0)

    for raw_region, organization_id in db.execute(
        select(MedicalOrganization.region, MedicalOrganization.id).where(
            MedicalOrganization.id.in_(
                select(RiskSignal.organization_id).distinct()
            )
        )
    ).all():
        aggregate_for(raw_region).organization_ids.add(organization_id)

    if latest_run_id is not None:
        snapshots = db.scalars(
            select(FinancialImpactSnapshot).where(
                FinancialImpactSnapshot.analysis_run_id == latest_run_id,
                FinancialImpactSnapshot.scope_type == "region",
            )
        ).all()
        for snapshot in snapshots:
            aggregate = aggregate_for(snapshot.scope_key)
            aggregate.financial_significance += snapshot.signal_services_amount
            if snapshot.unique_record_ids:
                aggregate.record_ids.update(snapshot.unique_record_ids)
            else:
                aggregate.fallback_record_count += snapshot.affected_records

        leading_rows = db.execute(
            select(
                MedicalOrganization.region,
                MedicalOrganization.id,
                MedicalOrganization.name,
                OrganizationPrioritySnapshot.score,
            )
            .join(
                OrganizationPrioritySnapshot,
                OrganizationPrioritySnapshot.organization_id == MedicalOrganization.id,
            )
            .where(OrganizationPrioritySnapshot.analysis_run_id == latest_run_id)
            .order_by(
                MedicalOrganization.region,
                OrganizationPrioritySnapshot.score.desc(),
                MedicalOrganization.name,
            )
        ).all()
        for raw_region, organization_id, organization_name, priority_score in leading_rows:
            aggregate = aggregate_for(raw_region)
            candidate = RegionalLeadingOrganization(
                id=organization_id,
                name=organization_name,
                priority_score=priority_score,
            )
            current = aggregate.leading_organization
            if current is None or candidate.priority_score > current.priority_score or (
                candidate.priority_score == current.priority_score
                and candidate.name < current.name
            ):
                aggregate.leading_organization = candidate

    return [
        RegionalMonitoringItem(
            region_name=aggregate.name,
            region_code=aggregate.code,
            signal_count=aggregate.signal_count,
            unique_record_count=len(aggregate.record_ids) + aggregate.fallback_record_count,
            financial_significance=aggregate.financial_significance,
            organization_count=len(aggregate.organization_ids),
            maximum_priority=aggregate.maximum_priority,
            leading_organization=aggregate.leading_organization,
        )
        for aggregate in sorted(aggregates.values(), key=lambda item: (item.name, item.code))
        if aggregate.signal_count > 0
    ]
