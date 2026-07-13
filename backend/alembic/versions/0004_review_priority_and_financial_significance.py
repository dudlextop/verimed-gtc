"""Add review priority, financial significance and peer comparison snapshots."""

import sqlalchemy as sa

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    existing = set(sa.inspect(op.get_bind()).get_table_names())
    if "review_priorities" not in existing:
        op.create_table(
            "review_priorities",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "analysis_run_id", sa.Integer(), sa.ForeignKey("analysis_runs.id"), nullable=False
            ),
            sa.Column(
                "signal_id",
                sa.Integer(),
                sa.ForeignKey("risk_signals.id"),
                nullable=False,
                unique=True,
            ),
            sa.Column("score", sa.Integer(), nullable=False),
            sa.Column("level", sa.String(length=20), nullable=False),
            sa.Column("financial_significance", sa.Numeric(14, 2), nullable=False),
            sa.Column("linked_record_ids", sa.JSON(), nullable=False),
            sa.Column("repetition_count", sa.Integer(), nullable=False),
            sa.Column("affected_patients", sa.Integer(), nullable=False),
            sa.Column("duration_days", sa.Integer(), nullable=False),
            sa.Column("factors", sa.JSON(), nullable=False),
            sa.Column("explanation", sa.Text(), nullable=False),
        )
    if "financial_impact_snapshots" not in existing:
        op.create_table(
            "financial_impact_snapshots",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "analysis_run_id", sa.Integer(), sa.ForeignKey("analysis_runs.id"), nullable=False
            ),
            sa.Column("scope_type", sa.String(length=40), nullable=False),
            sa.Column("scope_key", sa.String(length=180), nullable=False),
            sa.Column("total_services_amount", sa.Numeric(16, 2), nullable=False),
            sa.Column("signal_services_amount", sa.Numeric(16, 2), nullable=False),
            sa.Column("high_critical_amount", sa.Numeric(16, 2), nullable=False),
            sa.Column("confirmed_amount", sa.Numeric(16, 2), nullable=False),
            sa.Column("rejected_amount", sa.Numeric(16, 2), nullable=False),
            sa.Column("unreviewed_amount", sa.Numeric(16, 2), nullable=False),
            sa.Column("affected_records", sa.Integer(), nullable=False),
            sa.Column("affected_patients", sa.Integer(), nullable=False),
            sa.Column("unique_record_ids", sa.JSON(), nullable=False),
        )
    if "organization_priority_snapshots" not in existing:
        op.create_table(
            "organization_priority_snapshots",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "analysis_run_id", sa.Integer(), sa.ForeignKey("analysis_runs.id"), nullable=False
            ),
            sa.Column(
                "organization_id",
                sa.Integer(),
                sa.ForeignKey("medical_organizations.id"),
                nullable=False,
            ),
            sa.Column("score", sa.Integer(), nullable=False),
            sa.Column("level", sa.String(length=20), nullable=False),
            sa.Column("financial_significance", sa.Numeric(16, 2), nullable=False),
            sa.Column("high_critical_signals", sa.Integer(), nullable=False),
            sa.Column("affected_patients", sa.Integer(), nullable=False),
            sa.Column("duration_days", sa.Integer(), nullable=False),
            sa.Column("unreviewed_share", sa.Float(), nullable=False),
            sa.Column("factors", sa.JSON(), nullable=False),
            sa.Column("explanation", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        )
    if "organization_comparison_snapshots" not in existing:
        op.create_table(
            "organization_comparison_snapshots",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "analysis_run_id", sa.Integer(), sa.ForeignKey("analysis_runs.id"), nullable=False
            ),
            sa.Column(
                "organization_id",
                sa.Integer(),
                sa.ForeignKey("medical_organizations.id"),
                nullable=False,
            ),
            sa.Column("metric_key", sa.String(length=100), nullable=False),
            sa.Column("metric_label", sa.String(length=180), nullable=False),
            sa.Column("value", sa.Float(), nullable=False),
            sa.Column("peer_median", sa.Float(), nullable=False),
            sa.Column("typical_low", sa.Float(), nullable=False),
            sa.Column("typical_high", sa.Float(), nullable=False),
            sa.Column("deviation_percent", sa.Float(), nullable=False),
            sa.Column("position", sa.Integer(), nullable=False),
            sa.Column("peer_group_size", sa.Integer(), nullable=False),
            sa.Column("reliability", sa.String(length=40), nullable=False),
            sa.Column("limitation", sa.Text(), nullable=False),
            sa.Column("explanation", sa.Text(), nullable=False),
        )
    for table_name, columns in {
        "review_priorities": ["analysis_run_id", "signal_id", "score", "level"],
        "financial_impact_snapshots": ["analysis_run_id", "scope_type", "scope_key"],
        "organization_priority_snapshots": ["analysis_run_id", "organization_id", "score"],
        "organization_comparison_snapshots": ["analysis_run_id", "organization_id", "metric_key"],
    }.items():
        inspector = sa.inspect(op.get_bind())
        indexes = {index["name"] for index in inspector.get_indexes(table_name)}
        for column in columns:
            name = f"ix_{table_name}_{column}"
            if name not in indexes:
                op.create_index(name, table_name, [column])


def downgrade() -> None:
    existing = set(sa.inspect(op.get_bind()).get_table_names())
    for table_name in [
        "organization_comparison_snapshots",
        "organization_priority_snapshots",
        "financial_impact_snapshots",
        "review_priorities",
    ]:
        if table_name in existing:
            op.drop_table(table_name)
