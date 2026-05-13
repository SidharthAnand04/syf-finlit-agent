"""Add chat_logs table for interaction analytics

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-04
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chat_logs",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.Text, nullable=True),
        sa.Column("user_message", sa.Text, nullable=False),
        sa.Column("answer", sa.Text, nullable=False),
        sa.Column("question_type", sa.Text, nullable=True),
        sa.Column("citations", sa.JSON, nullable=False, server_default="[]"),
        sa.Column("cited_urls", sa.JSON, nullable=False, server_default="[]"),
        sa.Column("followups", sa.JSON, nullable=False, server_default="[]"),
        sa.Column("chunks_retrieved", sa.Integer, nullable=True),
        sa.Column("response_time_ms", sa.Integer, nullable=True),
        sa.Column("is_followup", sa.Boolean, nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    # Index for fast session lookups and time-range analytics
    op.create_index("ix_chat_logs_session_id", "chat_logs", ["session_id"])
    op.create_index("ix_chat_logs_created_at", "chat_logs", ["created_at"])
    op.create_index("ix_chat_logs_question_type", "chat_logs", ["question_type"])


def downgrade() -> None:
    op.drop_index("ix_chat_logs_question_type", table_name="chat_logs")
    op.drop_index("ix_chat_logs_created_at", table_name="chat_logs")
    op.drop_index("ix_chat_logs_session_id", table_name="chat_logs")
    op.drop_table("chat_logs")
