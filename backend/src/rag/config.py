"""
rag/config.py – Central configuration for the hybrid RAG pipeline.

All settings are overridable via environment variables so the same code
works for local dev (small corpora, CPU embeddings) and production.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

# Project root: backend/src/rag/config.py → parents[3] = project root
_BASE_DIR = Path(__file__).resolve().parents[3]

SOURCES_DIR = _BASE_DIR / "kb" / "sources"
PROCESSED_DIR = _BASE_DIR / "kb" / "processed"
URL_SOURCES_CONFIG = _BASE_DIR / "kb" / "url_sources.json"


def writable_index_dir() -> Path:
    """Return PROCESSED_DIR if writable, else /tmp fallback (Vercel)."""
    try:
        PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
        probe = PROCESSED_DIR / ".write_test"
        probe.touch()
        probe.unlink()
        return PROCESSED_DIR
    except OSError:
        fallback = Path("/tmp/syf_rag_index")
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


@dataclass
class RAGConfig:
    # ── Chunking ──────────────────────────────
    chunk_size: int = 1_600        # target characters per chunk
    chunk_overlap: int = 200       # overlap for fixed-size sliding window
    min_chunk_chars: int = 80      # discard chunks shorter than this

    # ── Retrieval ─────────────────────────────
    lexical_top_k: int = 10        # BM25 candidates
    dense_top_k: int = 10          # dense cosine candidates
    rerank_top_k: int = 8          # candidates kept after RRF rerank
    final_top_k: int = 4           # chunks returned to the LLM

    # ── Embedding ─────────────────────────────
    embedding_model: str = "all-MiniLM-L6-v2"

    # ── Reranker ──────────────────────────────
    reranker_enabled: bool = True
    rrf_k: int = 60                # RRF constant (standard: 60)

    @classmethod
    def from_env(cls) -> "RAGConfig":
        return cls(
            chunk_size=int(os.getenv("RAG_CHUNK_SIZE", "1600")),
            chunk_overlap=int(os.getenv("RAG_CHUNK_OVERLAP", "200")),
            min_chunk_chars=int(os.getenv("RAG_MIN_CHUNK_CHARS", "80")),
            lexical_top_k=int(os.getenv("RAG_LEXICAL_TOP_K", "10")),
            dense_top_k=int(os.getenv("RAG_DENSE_TOP_K", "10")),
            rerank_top_k=int(os.getenv("RAG_RERANK_TOP_K", "8")),
            final_top_k=int(os.getenv("RAG_FINAL_TOP_K", "4")),
            embedding_model=os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2"),
            reranker_enabled=os.getenv("RAG_RERANKER_ENABLED", "true").lower() == "true",
            rrf_k=int(os.getenv("RAG_RRF_K", "60")),
        )
