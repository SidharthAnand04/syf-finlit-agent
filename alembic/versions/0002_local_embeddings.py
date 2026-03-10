"""change embedding dims to 384 for local sentence-transformers

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-04
"""
from __future__ import annotations
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    dialect = op.get_context().dialect.name
    
    if dialect == "postgresql":
        # Postgres: DROP INDEX → ALTER TYPE → RECREATE INDEX
        op.execute("DROP INDEX IF EXISTS idx_chunks_embedding")
        op.execute("ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(384)")
        op.execute(
            "CREATE INDEX idx_chunks_embedding ON chunks "
            "USING hnsw (embedding vector_cosine_ops) "
            "WITH (m = 16, ef_construction = 64)"
        )
    elif dialect == "sqlite":
        # SQLite: BLOB column is already suitable for embeddings (serialized JSON/bytes)
        # No schema change needed; this is a no-op for SQLite
        pass


def downgrade() -> None:
    dialect = op.get_context().dialect.name
    
    if dialect == "postgresql":
        op.execute("DROP INDEX IF EXISTS idx_chunks_embedding")
        op.execute("ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(1536)")
        op.execute(
            "CREATE INDEX idx_chunks_embedding ON chunks "
            "USING hnsw (embedding vector_cosine_ops) "
            "WITH (m = 16, ef_construction = 64)"
        )
