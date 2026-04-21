"""initial schema: sources, documents, chunks, ingestion_runs + pgvector

Revision ID: 0001
Revises:
Create Date: 2026-03-04
"""
from __future__ import annotations
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.types import JSON

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # pgvector extension (Postgres only)
    if op.get_context().dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # sources
    tags_column = postgresql.JSONB if op.get_context().dialect.name == "postgresql" else JSON
    op.create_table(
        "sources",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("type", sa.Text, nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("url", sa.Text, nullable=True),
        sa.Column("enabled", sa.Boolean, nullable=False, server_default="1"),
        sa.Column("tags", tags_column, nullable=False, server_default="{}"),
        sa.Column("storage_key", sa.Text, nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint("type IN ('url','pdf')", name="ck_sources_type"),
    )
    op.create_index("idx_sources_enabled", "sources", ["enabled"])

    # documents
    op.create_table(
        "documents",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("source_id", sa.BigInteger,
                  sa.ForeignKey("sources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("canonical_url", sa.Text, nullable=True),
        sa.Column("title", sa.Text, nullable=True),
        sa.Column("content_hash", sa.Text, nullable=True),
        sa.Column("last_fetched_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("status", sa.Text, nullable=False, server_default="'pending'"),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("raw_text", sa.Text, nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint("status IN ('pending','ok','error')", name="ck_docs_status"),
    )
    op.create_index("idx_docs_source_id", "documents", ["source_id"])
    op.create_index("idx_docs_content_hash", "documents", ["content_hash"])
    op.create_index("idx_docs_last_fetched", "documents", ["last_fetched_at"])

    # chunks – use TEXT for embedding column; handled via raw SQL for vector type
    op.create_table(
        "chunks",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("document_id", sa.BigInteger,
                  sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_index", sa.Integer, nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("token_count", sa.Integer, nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    # Add vector column manually (SQLAlchemy doesn't know the type)
    # pgvector is Postgres-only; SQLite gets a BLOB or TEXT fallback
    if op.get_context().dialect.name == "postgresql":
        op.execute("ALTER TABLE chunks ADD COLUMN embedding vector(384)")
        # HNSW index (Postgres only)
        op.create_index("idx_chunks_embedding", "chunks", ["embedding"],
                       postgresql_using="hnsw",
                       postgresql_with={"m": 16, "ef_construction": 64})
    else:
        # SQLite: use BLOB for embeddings (no native vector type)
        op.execute("ALTER TABLE chunks ADD COLUMN embedding BLOB")
        op.create_index("idx_chunks_embedding", "chunks", ["embedding"])
    
    op.create_index("idx_chunks_document_id", "chunks", ["document_id"])

    # ingestion_runs
    summary_column = postgresql.JSONB if op.get_context().dialect.name == "postgresql" else JSON
    op.create_table(
        "ingestion_runs",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("started_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("finished_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("status", sa.Text, nullable=False, server_default="'running'"),
        sa.Column("summary", summary_column, nullable=False, server_default="{}"),
        sa.CheckConstraint("status IN ('running','ok','error')", name="ck_runs_status"),
    )

    # updated_at trigger (Postgres only)
    if op.get_context().dialect.name == "postgresql":
        op.execute("""
        CREATE OR REPLACE FUNCTION set_updated_at()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$
        """)
        op.execute("""
        CREATE TRIGGER trg_sources_updated_at
            BEFORE UPDATE ON sources
            FOR EACH ROW EXECUTE FUNCTION set_updated_at()
        """)


def downgrade() -> None:
    if op.get_context().dialect.name == "postgresql":
        op.execute("DROP FUNCTION IF EXISTS set_updated_at CASCADE")
    op.drop_table("ingestion_runs")
    op.drop_table("chunks")
    op.drop_table("documents")
    op.drop_table("sources")
