"""Add stable signal fingerprints and append-only expert decision journal."""

import sqlalchemy as sa

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    signal_columns = {column["name"] for column in inspector.get_columns("risk_signals")}
    if "analysis_run_id" not in signal_columns or "fingerprint" not in signal_columns:
        with op.batch_alter_table("risk_signals") as batch_op:
            if "analysis_run_id" not in signal_columns:
                batch_op.add_column(
                    sa.Column(
                        "analysis_run_id",
                        sa.Integer(),
                        sa.ForeignKey("analysis_runs.id"),
                        nullable=True,
                    )
                )
            if "fingerprint" not in signal_columns:
                batch_op.add_column(
                    sa.Column("fingerprint", sa.String(length=64), nullable=True)
                )

    existing = set(inspector.get_table_names())
    if "expert_decision_events" not in existing:
        op.create_table(
            "expert_decision_events",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("entity_type", sa.String(length=20), nullable=False),
            sa.Column("entity_fingerprint", sa.String(length=64), nullable=False),
            sa.Column("current_entity_id", sa.Integer(), nullable=True),
            sa.Column(
                "analysis_run_id",
                sa.Integer(),
                sa.ForeignKey("analysis_runs.id"),
                nullable=True,
            ),
            sa.Column("medical_organization_id", sa.Integer(), nullable=True),
            sa.Column("action_type", sa.String(length=100), nullable=False),
            sa.Column("decision_status", sa.String(length=100), nullable=False),
            sa.Column("reason_code", sa.String(length=120), nullable=False),
            sa.Column("comment", sa.Text(), nullable=False),
            sa.Column("reviewer_id", sa.String(length=64), nullable=False),
            sa.Column("reviewer_display_name", sa.String(length=100), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column(
                "supersedes_event_id",
                sa.Integer(),
                sa.ForeignKey("expert_decision_events.id"),
                nullable=True,
            ),
            sa.Column("metadata_json", sa.JSON(), nullable=False),
            sa.Column("event_hash", sa.String(length=64), nullable=False, unique=True),
            sa.Column("previous_event_hash", sa.String(length=64), nullable=True),
        )
    if "expert_feedback" not in existing:
        op.create_table(
            "expert_feedback",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "event_id",
                sa.Integer(),
                sa.ForeignKey("expert_decision_events.id"),
                nullable=False,
                unique=True,
            ),
            sa.Column("usefulness", sa.String(length=40), nullable=True),
            sa.Column("explanation_quality", sa.String(length=40), nullable=True),
            sa.Column("data_sufficiency", sa.String(length=40), nullable=True),
            sa.Column("priority_correctness", sa.String(length=40), nullable=True),
            sa.Column("grouping_correctness", sa.String(length=40), nullable=True),
            sa.Column("graph_usefulness", sa.String(length=40), nullable=True),
            sa.Column("comment", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        )
    if "signal_fingerprint_history" not in existing:
        op.create_table(
            "signal_fingerprint_history",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("entity_fingerprint", sa.String(length=64), nullable=False),
            sa.Column(
                "analysis_run_id",
                sa.Integer(),
                sa.ForeignKey("analysis_runs.id"),
                nullable=False,
            ),
            sa.Column("current_signal_id", sa.Integer(), nullable=False),
            sa.Column("medical_record_id", sa.Integer(), nullable=False),
            sa.Column("medical_organization_id", sa.Integer(), nullable=False),
            sa.Column("anomaly_type", sa.String(length=80), nullable=False),
            sa.Column("risk_score", sa.Integer(), nullable=False),
            sa.Column("priority_score", sa.Integer(), nullable=True),
            sa.Column("financial_significance", sa.Numeric(16, 2), nullable=True),
            sa.Column("status_at_run", sa.String(length=100), nullable=False),
            sa.Column("context_signature", sa.JSON(), nullable=False),
            sa.Column("appeared_at", sa.DateTime(), nullable=False),
            sa.UniqueConstraint("entity_fingerprint", "analysis_run_id"),
        )
    if "pattern_fingerprint_history" not in existing:
        op.create_table(
            "pattern_fingerprint_history",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("entity_fingerprint", sa.String(length=64), nullable=False),
            sa.Column(
                "analysis_run_id",
                sa.Integer(),
                sa.ForeignKey("analysis_runs.id"),
                nullable=False,
            ),
            sa.Column("current_pattern_id", sa.Integer(), nullable=False),
            sa.Column("pattern_type", sa.String(length=80), nullable=False),
            sa.Column("stability_score", sa.Integer(), nullable=False),
            sa.Column("importance_score", sa.Integer(), nullable=False),
            sa.Column("financial_significance", sa.Numeric(16, 2), nullable=False),
            sa.Column("signal_count", sa.Integer(), nullable=False),
            sa.Column("participant_signature", sa.JSON(), nullable=False),
            sa.Column("status_at_run", sa.String(length=100), nullable=False),
            sa.Column("appeared_at", sa.DateTime(), nullable=False),
            sa.UniqueConstraint("entity_fingerprint", "analysis_run_id"),
        )
    if "decision_journal_integrity_checks" not in existing:
        op.create_table(
            "decision_journal_integrity_checks",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("is_valid", sa.Boolean(), nullable=False),
            sa.Column("checked_events", sa.Integer(), nullable=False),
            sa.Column("mismatch_count", sa.Integer(), nullable=False),
            sa.Column("details", sa.JSON(), nullable=False),
            sa.Column("checked_at", sa.DateTime(), nullable=False),
        )

    indexes = {
        "risk_signals": ["analysis_run_id", "fingerprint"],
        "expert_decision_events": [
            "entity_type",
            "entity_fingerprint",
            "current_entity_id",
            "analysis_run_id",
            "medical_organization_id",
            "action_type",
            "decision_status",
            "reviewer_id",
            "created_at",
            "supersedes_event_id",
            "event_hash",
        ],
        "expert_feedback": [
            "event_id",
            "usefulness",
            "explanation_quality",
            "data_sufficiency",
            "priority_correctness",
            "grouping_correctness",
            "graph_usefulness",
        ],
        "signal_fingerprint_history": [
            "entity_fingerprint",
            "analysis_run_id",
            "current_signal_id",
            "medical_record_id",
            "medical_organization_id",
            "anomaly_type",
        ],
        "pattern_fingerprint_history": [
            "entity_fingerprint",
            "analysis_run_id",
            "current_pattern_id",
            "pattern_type",
        ],
        "decision_journal_integrity_checks": ["is_valid", "checked_at"],
    }
    for table_name, columns in indexes.items():
        current = {
            index["name"] for index in sa.inspect(op.get_bind()).get_indexes(table_name)
        }
        for column in columns:
            name = f"ix_{table_name}_{column}"
            if name not in current:
                op.create_index(name, table_name, [column])


def downgrade() -> None:
    existing = set(sa.inspect(op.get_bind()).get_table_names())
    for table_name in [
        "decision_journal_integrity_checks",
        "pattern_fingerprint_history",
        "signal_fingerprint_history",
        "expert_feedback",
        "expert_decision_events",
    ]:
        if table_name in existing:
            op.drop_table(table_name)
    signal_columns = {
        column["name"]
        for column in sa.inspect(op.get_bind()).get_columns("risk_signals")
    }
    with op.batch_alter_table("risk_signals") as batch_op:
        for column_name in ["fingerprint", "analysis_run_id"]:
            if column_name in signal_columns:
                batch_op.drop_column(column_name)
