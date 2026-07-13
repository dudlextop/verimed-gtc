"""Explainable anomaly analysis and validation storage."""

import sqlalchemy as sa

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def _column_names(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    if table_name not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def _add_columns(table_name: str, columns: list[sa.Column[object]]) -> None:
    existing = _column_names(table_name)
    for column in columns:
        if column.name not in existing:
            op.add_column(table_name, column)


def _ensure_index(table_name: str, column_name: str) -> None:
    inspector = sa.inspect(op.get_bind())
    existing = {index["name"] for index in inspector.get_indexes(table_name)}
    index_name = f"ix_{table_name}_{column_name}"
    if index_name not in existing:
        op.create_index(index_name, table_name, [column_name])


def upgrade() -> None:
    _add_columns(
        "medical_organizations",
        [
            sa.Column(
                "specialization",
                sa.String(length=100),
                nullable=False,
                server_default="Общий профиль",
            ),
            sa.Column("capacity", sa.Integer(), nullable=False, server_default="500"),
        ],
    )
    _add_columns(
        "medical_services",
        [
            sa.Column("minimum_interval_days", sa.Integer(), nullable=False, server_default="0"),
            sa.Column(
                "expected_duration_minutes", sa.Integer(), nullable=False, server_default="30"
            ),
            sa.Column("maximum_frequency_30d", sa.Integer(), nullable=False, server_default="4"),
            sa.Column("allowed_organization_types", sa.JSON(), nullable=False, server_default="[]"),
        ],
    )
    _add_columns(
        "medical_records",
        [
            sa.Column("service_time", sa.Time(), nullable=False, server_default="09:00:00"),
            sa.Column(
                "is_ground_truth_anomaly", sa.Boolean(), nullable=False, server_default=sa.false()
            ),
            sa.Column("ground_truth_anomaly_type", sa.String(length=80), nullable=True),
            sa.Column("anomaly_injection_id", sa.String(length=64), nullable=True),
        ],
    )
    _add_columns(
        "risk_signals",
        [
            sa.Column("related_record_ids", sa.JSON(), nullable=False, server_default="[]"),
            sa.Column("severity", sa.Float(), nullable=False, server_default="0"),
            sa.Column("rule_score", sa.Float(), nullable=False, server_default="0"),
            sa.Column("organization_score", sa.Float(), nullable=False, server_default="0"),
            sa.Column("financial_score", sa.Float(), nullable=False, server_default="0"),
            sa.Column("limitations", sa.JSON(), nullable=False, server_default="[]"),
            sa.Column(
                "recommendation",
                sa.Text(),
                nullable=False,
                server_default="Рекомендуется экспертная проверка.",
            ),
        ],
    )
    _add_columns(
        "analysis_runs",
        [
            sa.Column("random_seed", sa.Integer(), nullable=False, server_default="20260712"),
            sa.Column("anomalies_injected", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("signals_created", sa.Integer(), nullable=False, server_default="0"),
        ],
    )

    inspector = sa.inspect(op.get_bind())
    existing_tables = set(inspector.get_table_names())
    if "ground_truth_anomalies" not in existing_tables:
        op.create_table(
            "ground_truth_anomalies",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("injection_id", sa.String(length=64), nullable=False, unique=True),
            sa.Column("anomaly_type", sa.String(length=80), nullable=False),
            sa.Column(
                "primary_record_id",
                sa.Integer(),
                sa.ForeignKey("medical_records.id"),
                nullable=False,
            ),
            sa.Column("related_record_ids", sa.JSON(), nullable=False),
            sa.Column("parameters", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        )
    if "organization_features" not in existing_tables:
        op.create_table(
            "organization_features",
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
            sa.Column("feature_name", sa.String(length=100), nullable=False),
            sa.Column("value", sa.Float(), nullable=False),
            sa.Column("peer_median", sa.Float(), nullable=False),
            sa.Column("deviation", sa.Float(), nullable=False),
        )
    if "organization_anomaly_scores" not in existing_tables:
        op.create_table(
            "organization_anomaly_scores",
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
            sa.Column("score", sa.Float(), nullable=False),
            sa.Column("peer_group_key", sa.String(length=180), nullable=False),
            sa.Column("peer_group_size", sa.Integer(), nullable=False),
            sa.Column("limitation", sa.Text(), nullable=False),
            sa.Column("explanation", sa.Text(), nullable=False),
        )
    if "analysis_metrics" not in existing_tables:
        op.create_table(
            "analysis_metrics",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "analysis_run_id", sa.Integer(), sa.ForeignKey("analysis_runs.id"), nullable=False
            ),
            sa.Column("anomaly_type", sa.String(length=80), nullable=True),
            sa.Column("precision", sa.Float(), nullable=False),
            sa.Column("recall", sa.Float(), nullable=False),
            sa.Column("f1", sa.Float(), nullable=False),
            sa.Column("false_positive_rate", sa.Float(), nullable=False),
            sa.Column("true_positive_count", sa.Integer(), nullable=False),
            sa.Column("false_positive_count", sa.Integer(), nullable=False),
            sa.Column("false_negative_count", sa.Integer(), nullable=False),
            sa.Column("selected_for_review_rate", sa.Float(), nullable=False),
            sa.Column("manual_review_reduction", sa.Float(), nullable=False),
        )
    for table_name, column_name in [
        ("medical_records", "is_ground_truth_anomaly"),
        ("medical_records", "ground_truth_anomaly_type"),
        ("medical_records", "anomaly_injection_id"),
        ("ground_truth_anomalies", "anomaly_type"),
        ("organization_features", "analysis_run_id"),
        ("organization_anomaly_scores", "analysis_run_id"),
        ("analysis_metrics", "analysis_run_id"),
    ]:
        _ensure_index(table_name, column_name)


def downgrade() -> None:
    for table_name in [
        "analysis_metrics",
        "organization_anomaly_scores",
        "organization_features",
        "ground_truth_anomalies",
    ]:
        if table_name in sa.inspect(op.get_bind()).get_table_names():
            op.drop_table(table_name)
    for table_name, columns in [
        (
            "risk_signals",
            [
                "recommendation",
                "limitations",
                "financial_score",
                "organization_score",
                "rule_score",
                "severity",
                "related_record_ids",
            ],
        ),
        (
            "medical_records",
            [
                "anomaly_injection_id",
                "ground_truth_anomaly_type",
                "is_ground_truth_anomaly",
                "service_time",
            ],
        ),
        (
            "medical_services",
            [
                "allowed_organization_types",
                "maximum_frequency_30d",
                "expected_duration_minutes",
                "minimum_interval_days",
            ],
        ),
        ("medical_organizations", ["capacity", "specialization"]),
        ("analysis_runs", ["signals_created", "anomalies_injected", "random_seed"]),
    ]:
        existing_columns = _column_names(table_name)
        for column_name in columns:
            if column_name in existing_columns:
                op.drop_column(table_name, column_name)
