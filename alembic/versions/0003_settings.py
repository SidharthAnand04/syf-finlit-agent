"""Add settings table for configurable key-value store (personality, etc.)

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-21
"""
from __future__ import annotations
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_DEFAULT_PERSONALITY = """{
  "persona_name": "Synchrony virtual assistant",
  "tone_description": "warm, calm, professional",
  "system_prompt_override": null,
  "extra_rules": []
}"""


def upgrade() -> None:
    op.create_table(
        "settings",
        sa.Column("key", sa.Text, primary_key=True),
        sa.Column("value", sa.Text, nullable=False),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    # Seed the default personality config
    op.execute(
        sa.text(
            "INSERT INTO settings (key, value) VALUES ('personality', :v)"
        ).bindparams(v=_DEFAULT_PERSONALITY)
    )


def downgrade() -> None:
    op.drop_table("settings")
