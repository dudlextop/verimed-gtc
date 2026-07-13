"""Store comparable snapshots for the specialist command center."""

import sqlalchemy as sa

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def _column_names() -> set[str]:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns("analysis_runs")}


def upgrade() -> None:
    existing = _column_names()
    columns: list[sa.Column[object]] = [
        sa.Column("signal_record_ids", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("high_risk_record_ids", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("organization_risk_scores", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("review_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("selected_for_review_rate", sa.Float(), nullable=False, server_default="0"),
        sa.Column("completed_reviews_count", sa.Integer(), nullable=False, server_default="0"),
    ]
    for column in columns:
        if column.name not in existing:
            op.add_column("analysis_runs", column)


def downgrade() -> None:
    existing = _column_names()
    for column_name in [
        "completed_reviews_count",
        "selected_for_review_rate",
        "review_amount",
        "organization_risk_scores",
        "high_risk_record_ids",
        "signal_record_ids",
    ]:
        if column_name in existing:
            op.drop_column("analysis_runs", column_name)
