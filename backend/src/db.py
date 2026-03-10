"""
db.py – SQLAlchemy async engine, session factory, and ORM models.

Uses asyncpg under the hood.  The DATABASE_URL env var should be the
*pooled* Neon/Supabase URL (postgres://…?pgbouncer=true&connection_limit=1).
For migrations (Alembic) a sync URL is used; see alembic/env.py.
"""

from __future__ import annotations

import os
import pathlib

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    ForeignKey,
    Integer,
    JSON,
    Text,
    TIMESTAMP,
    text,
)
from sqlalchemy.ext.asyncio import AsyncAttrs, AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, relationship
from sqlalchemy.pool import NullPool

# Resolve paths relative to backend/ directory (consistent for uvicorn + alembic)
_BACKEND_DIR = pathlib.Path(__file__).resolve().parent.parent  # backend/src/../ = backend/


# ──────────────────────────────────────────────
# Engine
# ──────────────────────────────────────────────

def _build_url() -> str:
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        raise EnvironmentError(
            "DATABASE_URL is not set. Add it to your .env file."
        )
    # Neon pooled URL uses postgres:// – swap scheme for asyncpg
    if url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://") and "+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    # Resolve relative SQLite paths against the backend/ directory so that
    # running uvicorn from backend/ and alembic from the project root both
    # always point at the same db file.
    if "sqlite" in url and "///" in url:
        sep = "///"
        idx = url.index(sep) + len(sep)
        path_part = url[idx:]
        query = ""
        if "?" in path_part:
            path_part, query = path_part.split("?", 1)
            query = "?" + query
        abs_path = (_BACKEND_DIR / path_part).resolve()
        url = url[:idx] + str(abs_path).replace("\\", "/") + query
    return url


def get_engine():
    """Return a singleton async engine (NullPool for serverless)."""
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            _build_url(),
            poolclass=NullPool,  # essential for serverless – no persistent pool
            echo=False,
        )
    return _engine


_engine = None


from contextlib import asynccontextmanager


@asynccontextmanager
async def get_session():
    """Async context manager yielding an AsyncSession.

    Usage::

        async with get_session() as session:
            ...
    """
    session = AsyncSession(get_engine(), expire_on_commit=False)
    try:
        yield session
    finally:
        await session.close()


# ──────────────────────────────────────────────
# ORM Models
# ──────────────────────────────────────────────

class Base(AsyncAttrs, DeclarativeBase):
    pass


class Source(Base):
    __tablename__ = "sources"

    id          = Column(BigInteger, primary_key=True, autoincrement=True)
    type        = Column(Text, nullable=False)
    name        = Column(Text, nullable=False)
    url         = Column(Text, nullable=True)
    enabled     = Column(Boolean, nullable=False, default=True)
    tags        = Column(JSON, nullable=False, default=dict)
    storage_key = Column(Text, nullable=True)
    created_at  = Column(TIMESTAMP(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at  = Column(TIMESTAMP(timezone=True), server_default=text("CURRENT_TIMESTAMP"),
                         onupdate=text("CURRENT_TIMESTAMP"))

    __table_args__ = (
        CheckConstraint("type IN ('url','pdf')", name="ck_sources_type"),
    )

    documents: Mapped[list["Document"]] = relationship(
        "Document", back_populates="source", cascade="all, delete-orphan"
    )


class Document(Base):
    __tablename__ = "documents"

    id              = Column(BigInteger, primary_key=True, autoincrement=True)
    source_id       = Column(BigInteger, ForeignKey("sources.id", ondelete="CASCADE"),
                             nullable=False)
    canonical_url   = Column(Text, nullable=True)
    title           = Column(Text, nullable=True)
    content_hash    = Column(Text, nullable=True)
    last_fetched_at = Column(TIMESTAMP(timezone=True), nullable=True)
    status          = Column(Text, nullable=False, default="pending")
    error           = Column(Text, nullable=True)
    raw_text        = Column(Text, nullable=True)
    created_at      = Column(TIMESTAMP(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    __table_args__ = (
        CheckConstraint("status IN ('pending','ok','error')", name="ck_docs_status"),
    )

    source: Mapped["Source"] = relationship("Source", back_populates="documents")
    chunks: Mapped[list["Chunk"]] = relationship(
        "Chunk", back_populates="document", cascade="all, delete-orphan"
    )


class Chunk(Base):
    __tablename__ = "chunks"

    id          = Column(BigInteger, primary_key=True, autoincrement=True)
    document_id = Column(BigInteger, ForeignKey("documents.id", ondelete="CASCADE"),
                         nullable=False)
    chunk_index = Column(Integer, nullable=False)
    content     = Column(Text, nullable=False)
    token_count = Column(Integer, nullable=True)
    # embedding column is vector(384); not representable with standard SA types.
    # We manage it via raw SQL in the pipeline / retrieval modules.
    created_at  = Column(TIMESTAMP(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    document: Mapped["Document"] = relationship("Document", back_populates="chunks")


class IngestionRun(Base):
    __tablename__ = "ingestion_runs"

    id          = Column(BigInteger, primary_key=True, autoincrement=True)
    started_at  = Column(TIMESTAMP(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    finished_at = Column(TIMESTAMP(timezone=True), nullable=True)
    status      = Column(Text, nullable=False, default="running")
    summary     = Column(JSON, nullable=False, default=dict)

    __table_args__ = (
        CheckConstraint("status IN ('running','ok','error')", name="ck_runs_status"),
    )
