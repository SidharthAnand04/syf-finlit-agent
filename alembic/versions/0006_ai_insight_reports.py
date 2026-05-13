"""Add persisted AI insight reports

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-12
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        "ai_insight_reports",
        sa.Column("id", sa.Text, primary_key=True, server_default=sa.text("gen_random_uuid()::text")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("report_type", sa.Text, nullable=False, server_default="insights"),
        sa.Column("time_range_start", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("time_range_end", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("status", sa.Text, nullable=False, server_default="completed"),
        sa.Column("health_score", sa.Numeric, nullable=True),
        sa.Column("health_status", sa.Text, nullable=True),
        sa.Column("risk_level", sa.Text, nullable=True),
        sa.Column("executive_summary", sa.Text, nullable=True),
        sa.Column("main_problem", sa.Text, nullable=True),
        sa.Column("top_action", sa.Text, nullable=True),
        sa.Column("model_name", sa.Text, nullable=True),
        sa.Column("input_snapshot", sa.JSON, nullable=True),
        sa.Column("report", sa.JSON, nullable=False),
        sa.Column("created_by", sa.Text, nullable=True),
        sa.Column("metadata", sa.JSON, nullable=True),
        sa.CheckConstraint("status IN ('running','completed','failed')", name="ck_ai_insight_reports_status"),
    )
    op.create_index("ix_ai_insight_reports_created_at", "ai_insight_reports", ["created_at"])
    op.create_index("ix_ai_insight_reports_report_type", "ai_insight_reports", ["report_type"])
    op.create_index("ix_ai_insight_reports_status", "ai_insight_reports", ["status"])


def downgrade() -> None:
    op.drop_index("ix_ai_insight_reports_status", table_name="ai_insight_reports")
    op.drop_index("ix_ai_insight_reports_report_type", table_name="ai_insight_reports")
    op.drop_index("ix_ai_insight_reports_created_at", table_name="ai_insight_reports")
    op.drop_table("ai_insight_reports")
