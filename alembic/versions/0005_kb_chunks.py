"""Add kb_chunks table for pgvector-backed retrieval

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-04
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ensure pgvector extension exists (idempotent)
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "kb_chunks",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("chunk_id", sa.Text, nullable=False),
        sa.Column("chunk_index", sa.Integer, nullable=False),
        sa.Column("source_name", sa.Text, nullable=False),
        sa.Column("display_title", sa.Text, nullable=False),
        sa.Column("display_url", sa.Text, nullable=True),
        sa.Column("source_type", sa.Text, nullable=False),
        sa.Column("section_heading", sa.Text, nullable=True),
        sa.Column("page_number", sa.Integer, nullable=True),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("snippet", sa.Text, nullable=False),
        sa.Column("token_count", sa.Integer, nullable=True),
        # Vector column – managed via raw DDL since SA has no native vector type
        sa.Column("created_at", sa.TIMESTAMP(timezone=True),
                  server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )

    # Add the vector column separately (requires pgvector)
    op.execute("ALTER TABLE kb_chunks ADD COLUMN embedding vector(384)")

    # Unique index on chunk_id for upsert
    op.create_index("uq_kb_chunks_chunk_id", "kb_chunks", ["chunk_id"], unique=True)

    # HNSW index for fast approximate nearest-neighbor search
    op.execute(
        "CREATE INDEX ix_kb_chunks_embedding ON kb_chunks "
        "USING hnsw (embedding vector_cosine_ops) "
        "WITH (m = 16, ef_construction = 64)"
    )

    # GIN index for PostgreSQL full-text search (lexical retrieval)
    op.execute(
        "CREATE INDEX ix_kb_chunks_tsv ON kb_chunks "
        "USING gin (to_tsvector('english', text))"
    )

    op.create_index("ix_kb_chunks_source", "kb_chunks", ["source_name"])


def downgrade() -> None:
    op.drop_index("ix_kb_chunks_source", table_name="kb_chunks")
    op.drop_index("ix_kb_chunks_tsv", table_name="kb_chunks")
    op.drop_index("ix_kb_chunks_embedding", table_name="kb_chunks")
    op.drop_index("uq_kb_chunks_chunk_id", table_name="kb_chunks")
    op.drop_table("kb_chunks")
