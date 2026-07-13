"""Add recurring deviation patterns, participants, history and reviews."""

import sqlalchemy as sa

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    existing = set(sa.inspect(op.get_bind()).get_table_names())
    if "recurring_patterns" not in existing:
        op.create_table(
            "recurring_patterns",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("fingerprint", sa.String(64), nullable=False, unique=True),
            sa.Column("name", sa.String(220), nullable=False),
            sa.Column("pattern_type", sa.String(80), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("first_seen", sa.Date(), nullable=False),
            sa.Column("last_seen", sa.Date(), nullable=False),
            sa.Column("period_count", sa.Integer(), nullable=False),
            sa.Column("signal_count", sa.Integer(), nullable=False),
            sa.Column("organization_count", sa.Integer(), nullable=False),
            sa.Column("doctor_count", sa.Integer(), nullable=False),
            sa.Column("patient_count", sa.Integer(), nullable=False),
            sa.Column("service_count", sa.Integer(), nullable=False),
            sa.Column("financial_significance", sa.Numeric(16, 2), nullable=False),
            sa.Column("average_risk", sa.Float(), nullable=False),
            sa.Column("average_priority", sa.Float(), nullable=False),
            sa.Column("stability_score", sa.Integer(), nullable=False),
            sa.Column("stability_level", sa.String(40), nullable=False),
            sa.Column("importance_score", sa.Integer(), nullable=False),
            sa.Column("importance_level", sa.String(20), nullable=False),
            sa.Column("review_status", sa.String(60), nullable=False),
            sa.Column(
                "first_analysis_run_id",
                sa.Integer(),
                sa.ForeignKey("analysis_runs.id"),
                nullable=False,
            ),
            sa.Column(
                "last_analysis_run_id",
                sa.Integer(),
                sa.ForeignKey("analysis_runs.id"),
                nullable=False,
            ),
            sa.Column("recurrence_runs", sa.Integer(), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("formed_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )
    tables: dict[str, list[sa.Column[object] | sa.Constraint]] = {
        "pattern_signals": [
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "pattern_id", sa.Integer(), sa.ForeignKey("recurring_patterns.id"), nullable=False
            ),
            sa.Column("signal_id", sa.Integer(), sa.ForeignKey("risk_signals.id"), nullable=False),
            sa.Column(
                "analysis_run_id", sa.Integer(), sa.ForeignKey("analysis_runs.id"), nullable=False
            ),
            sa.Column("strength", sa.Float(), nullable=False),
            sa.Column("relationship_explanation", sa.Text(), nullable=False),
            sa.UniqueConstraint("pattern_id", "signal_id"),
        ],
        "pattern_organizations": [
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "pattern_id", sa.Integer(), sa.ForeignKey("recurring_patterns.id"), nullable=False
            ),
            sa.Column(
                "organization_id",
                sa.Integer(),
                sa.ForeignKey("medical_organizations.id"),
                nullable=False,
            ),
            sa.Column("signal_count", sa.Integer(), nullable=False),
            sa.Column("financial_significance", sa.Numeric(16, 2), nullable=False),
            sa.Column("is_primary", sa.Boolean(), nullable=False),
            sa.UniqueConstraint("pattern_id", "organization_id"),
        ],
        "pattern_doctors": [
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "pattern_id", sa.Integer(), sa.ForeignKey("recurring_patterns.id"), nullable=False
            ),
            sa.Column("doctor_id", sa.Integer(), sa.ForeignKey("doctors.id"), nullable=False),
            sa.Column("signal_count", sa.Integer(), nullable=False),
            sa.Column("share", sa.Float(), nullable=False),
            sa.Column("is_primary", sa.Boolean(), nullable=False),
            sa.UniqueConstraint("pattern_id", "doctor_id"),
        ],
        "pattern_patients": [
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "pattern_id", sa.Integer(), sa.ForeignKey("recurring_patterns.id"), nullable=False
            ),
            sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id"), nullable=False),
            sa.Column("signal_count", sa.Integer(), nullable=False),
            sa.Column("share", sa.Float(), nullable=False),
            sa.UniqueConstraint("pattern_id", "patient_id"),
        ],
        "pattern_services": [
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "pattern_id", sa.Integer(), sa.ForeignKey("recurring_patterns.id"), nullable=False
            ),
            sa.Column(
                "service_id", sa.Integer(), sa.ForeignKey("medical_services.id"), nullable=False
            ),
            sa.Column("signal_count", sa.Integer(), nullable=False),
            sa.Column("financial_significance", sa.Numeric(16, 2), nullable=False),
            sa.Column("is_primary", sa.Boolean(), nullable=False),
            sa.UniqueConstraint("pattern_id", "service_id"),
        ],
        "pattern_factors": [
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "pattern_id", sa.Integer(), sa.ForeignKey("recurring_patterns.id"), nullable=False
            ),
            sa.Column("factor_group", sa.String(40), nullable=False),
            sa.Column("name", sa.String(160), nullable=False),
            sa.Column("weight", sa.Integer(), nullable=False),
            sa.Column("normalized_value", sa.Float(), nullable=False),
            sa.Column("contribution", sa.Integer(), nullable=False),
            sa.Column("actual_value", sa.String(180), nullable=False),
            sa.Column("typical_value", sa.String(180), nullable=False),
            sa.Column("explanation", sa.Text(), nullable=False),
        ],
        "pattern_snapshots": [
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "pattern_id", sa.Integer(), sa.ForeignKey("recurring_patterns.id"), nullable=False
            ),
            sa.Column(
                "analysis_run_id", sa.Integer(), sa.ForeignKey("analysis_runs.id"), nullable=False
            ),
            sa.Column("signal_count", sa.Integer(), nullable=False),
            sa.Column("financial_significance", sa.Numeric(16, 2), nullable=False),
            sa.Column("stability_score", sa.Integer(), nullable=False),
            sa.Column("importance_score", sa.Integer(), nullable=False),
            sa.Column("organization_count", sa.Integer(), nullable=False),
            sa.Column("patient_count", sa.Integer(), nullable=False),
            sa.Column("first_seen", sa.Date(), nullable=False),
            sa.Column("last_seen", sa.Date(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.UniqueConstraint("pattern_id", "analysis_run_id"),
        ],
        "pattern_reviews": [
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "pattern_id", sa.Integer(), sa.ForeignKey("recurring_patterns.id"), nullable=False
            ),
            sa.Column("status", sa.String(60), nullable=False),
            sa.Column("comment", sa.Text(), nullable=False),
            sa.Column("reviewer_name", sa.String(100), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        ],
    }
    for table_name, columns in tables.items():
        if table_name not in existing:
            op.create_table(table_name, *columns)

    indexes = {
        "recurring_patterns": [
            "fingerprint",
            "name",
            "pattern_type",
            "first_seen",
            "last_seen",
            "financial_significance",
            "stability_score",
            "stability_level",
            "importance_score",
            "importance_level",
            "review_status",
            "first_analysis_run_id",
            "last_analysis_run_id",
            "is_active",
        ],
        "pattern_signals": ["pattern_id", "signal_id", "analysis_run_id"],
        "pattern_organizations": ["pattern_id", "organization_id"],
        "pattern_doctors": ["pattern_id", "doctor_id"],
        "pattern_patients": ["pattern_id", "patient_id"],
        "pattern_services": ["pattern_id", "service_id"],
        "pattern_factors": ["pattern_id", "factor_group"],
        "pattern_snapshots": ["pattern_id", "analysis_run_id"],
        "pattern_reviews": ["pattern_id"],
    }
    for table_name, columns in indexes.items():
        inspector = sa.inspect(op.get_bind())
        current = {index["name"] for index in inspector.get_indexes(table_name)}
        for column in columns:
            name = f"ix_{table_name}_{column}"
            if name not in current:
                op.create_index(name, table_name, [column])


def downgrade() -> None:
    existing = set(sa.inspect(op.get_bind()).get_table_names())
    for table_name in [
        "pattern_reviews",
        "pattern_snapshots",
        "pattern_factors",
        "pattern_services",
        "pattern_patients",
        "pattern_doctors",
        "pattern_organizations",
        "pattern_signals",
        "recurring_patterns",
    ]:
        if table_name in existing:
            op.drop_table(table_name)
