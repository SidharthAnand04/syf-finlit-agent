"""
rag/indexing/pgvector_index.py – Supabase/pgvector-backed retrieval index.

Replaces the in-memory dense (numpy cosine) + BM25 pipeline with two
PostgreSQL queries per request:

  Dense  : ORDER BY embedding <=> $query_vec LIMIT k          (HNSW ANN)
  Lexical: ORDER BY ts_rank_cd(tsv, plainto_tsquery(...)) DESC (GIN FTS)

Results from both passes are fused with Reciprocal Rank Fusion (same as the
in-memory hybrid pipeline) before returning the top-k chunks.

Public API
----------
  sync_chunks(chunks, dense_matrix)   – upsert all chunks+embeddings to DB
  search_dense(query_vec, top_k)      – async pgvector cosine ANN
  search_lexical(query, top_k)        – async PostgreSQL FTS
  is_populated()                      – async check whether kb_chunks has rows
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from rag.schemas import RichChunk


# ──────────────────────────────────────────────
# Sync chunks → Supabase
# ──────────────────────────────────────────────

async def sync_chunks(
    chunks: "list[RichChunk]",
    dense_matrix: np.ndarray,
) -> None:
    """
    Upsert all chunks (with embeddings) into the kb_chunks table.

    Uses ON CONFLICT (chunk_id) DO UPDATE so re-ingestion is idempotent.
    Runs in a single transaction for atomicity.
    """
    from db import get_session

    print(f"[pgvector] Syncing {len(chunks)} chunks to Supabase kb_chunks...")

    from sqlalchemy import text as sa_text

    # asyncpg cannot mix named-param syntax with the ::vector cast, so we embed
    # the vector literal directly in the SQL string.  This is safe because the
    # values come from our own numpy matrix, never from user input.
    upsert_template = """
        INSERT INTO kb_chunks
            (chunk_id, chunk_index, source_name, display_title, display_url,
             source_type, section_heading, page_number, text, snippet,
             token_count, embedding)
        VALUES
            (:chunk_id, :chunk_index, :source_name, :display_title, :display_url,
             :source_type, :section_heading, :page_number, :text, :snippet,
             :token_count, '{vec}'::vector)
        ON CONFLICT (chunk_id) DO UPDATE SET
            chunk_index     = EXCLUDED.chunk_index,
            source_name     = EXCLUDED.source_name,
            display_title   = EXCLUDED.display_title,
            display_url     = EXCLUDED.display_url,
            source_type     = EXCLUDED.source_type,
            section_heading = EXCLUDED.section_heading,
            page_number     = EXCLUDED.page_number,
            text            = EXCLUDED.text,
            snippet         = EXCLUDED.snippet,
            token_count     = EXCLUDED.token_count,
            embedding       = EXCLUDED.embedding
    """

    async with get_session() as session:
        for i, chunk in enumerate(chunks):
            vec_str = "[" + ",".join(f"{v:.6f}" for v in dense_matrix[i].tolist()) + "]"
            sql = sa_text(upsert_template.format(vec=vec_str))

            await session.execute(
                sql,
                {
                    "chunk_id":        chunk.chunk_id,
                    "chunk_index":     chunk.chunk_index,
                    "source_name":     chunk.source.source_name,
                    "display_title":   chunk.source.display_title,
                    "display_url":     chunk.source.display_url,
                    "source_type":     chunk.source.source_type,
                    "section_heading": chunk.section_heading,
                    "page_number":     chunk.page_number,
                    "text":            chunk.text,
                    "snippet":         chunk.snippet,
                    "token_count":     chunk.token_count,
                },
            )

        await session.commit()

    print(f"[pgvector] Sync complete -- {len(chunks)} chunks upserted.")


# ──────────────────────────────────────────────
# Dense search (pgvector ANN)
# ──────────────────────────────────────────────

async def search_dense(
    query_vec: np.ndarray,
    top_k: int = 10,
) -> list[dict]:
    """
    Return top-k chunks by cosine similarity using the pgvector HNSW index.

    Returns list of dicts with keys matching RichChunk fields plus a 'score'.
    Score = 1 - cosine_distance (higher is better).
    """
    from db import get_session
    from sqlalchemy import text as sa_text

    vec_str = "[" + ",".join(f"{v:.6f}" for v in query_vec.tolist()) + "]"

    # Embed vector literal directly in SQL (safe: derived from our own embedder).
    sql = sa_text(f"""
        SELECT
            chunk_id, chunk_index, source_name, display_title, display_url,
            source_type, section_heading, page_number, text, snippet, token_count,
            1 - (embedding <=> '{vec_str}'::vector) AS score
        FROM kb_chunks
        ORDER BY embedding <=> '{vec_str}'::vector
        LIMIT :top_k
    """)

    async with get_session() as session:
        result = await session.execute(sql, {"top_k": top_k})
        rows = result.mappings().fetchall()

    return [dict(r) for r in rows]


# ──────────────────────────────────────────────
# Lexical search (PostgreSQL FTS)
# ──────────────────────────────────────────────

async def search_lexical(
    query: str,
    top_k: int = 10,
) -> list[dict]:
    """
    Return top-k chunks by PostgreSQL full-text ranking using the GIN index.

    Uses plainto_tsquery for robust parsing (no special characters needed).
    Falls back to an ilike search if FTS returns no results.
    """
    from db import get_session
    from sqlalchemy import text as sa_text

    fts_sql = sa_text("""
        SELECT
            chunk_id, chunk_index, source_name, display_title, display_url,
            source_type, section_heading, page_number, text, snippet, token_count,
            ts_rank_cd(to_tsvector('english', text), plainto_tsquery('english', :q)) AS score
        FROM kb_chunks
        WHERE to_tsvector('english', text) @@ plainto_tsquery('english', :q)
        ORDER BY score DESC
        LIMIT :top_k
    """)

    async with get_session() as session:
        result = await session.execute(fts_sql, {"q": query, "top_k": top_k})
        rows = result.mappings().fetchall()

    return [dict(r) for r in rows]


# ──────────────────────────────────────────────
# Availability check
# ──────────────────────────────────────────────

async def is_populated() -> bool:
    """Return True if the kb_chunks table has at least one row."""
    from db import get_session
    from sqlalchemy import text as sa_text

    try:
        async with get_session() as session:
            result = await session.execute(
                sa_text("SELECT 1 FROM kb_chunks LIMIT 1")
            )
            return result.fetchone() is not None
    except Exception:
        return False


# ──────────────────────────────────────────────
# RRF fusion (same algorithm as hybrid.py)
# ──────────────────────────────────────────────

def rrf_fuse(
    dense_rows: list[dict],
    lexical_rows: list[dict],
    *,
    k: int = 60,
    top_k: int = 4,
) -> list[dict]:
    """
    Merge dense and lexical result lists with Reciprocal Rank Fusion.

    Returns the top-k rows from the fused ranking, each augmented with
    a 'rrf_score' key.
    """
    scores: dict[str, float] = {}
    rows_by_id: dict[str, dict] = {}

    for rank, row in enumerate(dense_rows):
        cid = row["chunk_id"]
        scores[cid] = scores.get(cid, 0.0) + 1.0 / (k + rank + 1)
        rows_by_id[cid] = row

    for rank, row in enumerate(lexical_rows):
        cid = row["chunk_id"]
        scores[cid] = scores.get(cid, 0.0) + 1.0 / (k + rank + 1)
        rows_by_id.setdefault(cid, row)

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
    result = []
    for cid, rrf_score in ranked:
        row = dict(rows_by_id[cid])
        row["score"] = rrf_score
        result.append(row)
    return result
