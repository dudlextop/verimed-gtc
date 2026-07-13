"""Add indexes for read-heavy public serving.

Revision ID: 0007
Revises: 0006
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    def ensure_index(name: str, table: str, columns: list[str]) -> None:
        existing = {index["name"] for index in sa.inspect(op.get_bind()).get_indexes(table)}
        if name not in existing:
            op.create_index(name, table, columns)

    ensure_index("ix_risk_signals_created_at", "risk_signals", ["created_at"])
    ensure_index(
        "ix_risk_signals_status_level_created",
        "risk_signals",
        ["status", "level", "created_at"],
    )
    ensure_index(
        "ix_review_priorities_analysis_score",
        "review_priorities",
        ["analysis_run_id", "score"],
    )
    ensure_index(
        "ix_review_priorities_level_score",
        "review_priorities",
        ["level", "score"],
    )
    ensure_index(
        "ix_review_priorities_financial_significance",
        "review_priorities",
        ["financial_significance"],
    )
    ensure_index(
        "ix_organization_priority_snapshots_run_score",
        "organization_priority_snapshots",
        ["analysis_run_id", "score", "organization_id"],
    )
    ensure_index(
        "ix_recurring_patterns_active_importance",
        "recurring_patterns",
        ["is_active", "importance_score", "id"],
    )
    ensure_index(
        "ix_recurring_patterns_active_stability",
        "recurring_patterns",
        ["is_active", "stability_score", "id"],
    )


def downgrade() -> None:
    op.drop_index("ix_recurring_patterns_active_stability", table_name="recurring_patterns")
    op.drop_index("ix_recurring_patterns_active_importance", table_name="recurring_patterns")
    op.drop_index(
        "ix_organization_priority_snapshots_run_score",
        table_name="organization_priority_snapshots",
    )
    op.drop_index("ix_review_priorities_financial_significance", table_name="review_priorities")
    op.drop_index("ix_review_priorities_level_score", table_name="review_priorities")
    op.drop_index("ix_review_priorities_analysis_score", table_name="review_priorities")
    op.drop_index("ix_risk_signals_status_level_created", table_name="risk_signals")
    op.drop_index("ix_risk_signals_created_at", table_name="risk_signals")
