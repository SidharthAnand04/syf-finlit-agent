"""
retrieval.py – Public retrieval API with in-memory BM25+dense and Supabase pgvector paths.

main.py imports get_index, refresh_url_sources, retrieve, and retrieve_async.

Retrieval strategy (auto-selected):
  • retrieve_async()  – preferred; queries Supabase kb_chunks via pgvector (dense
                        ANN) + PostgreSQL FTS (lexical), fused with RRF.
  • retrieve()        – synchronous fallback using the in-memory BM25 + numpy
                        dense index.  Used by admin query-test and as a safety net.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

from rag.config import RAGConfig, SOURCES_DIR, URL_SOURCES_CONFIG
from rag.indexing.dense import DenseIndex
from rag.indexing.lexical import LexicalIndex
from rag.retrieval.hybrid import retrieve as _hybrid_retrieve
from rag.schemas import RichChunk
from rag.services.build_service import ensure_index, rebuild_index

_retrieval_cache: dict[tuple[str, int], tuple[float, list[dict]]] = {}
_RETRIEVAL_TTL_SECONDS = int(os.getenv("RETRIEVAL_CACHE_TTL_SECONDS", "180"))


def _cache_key(query: str, k: int) -> tuple[str, int]:
    return (" ".join(query.lower().split()), k)


# ──────────────────────────────────────────────
# Public API – sync (BM25 + numpy dense)
# ──────────────────────────────────────────────

def get_index(
    force_rebuild: bool = False,
) -> tuple[list[RichChunk], LexicalIndex, DenseIndex]:
    """Pre-warm or return the current index. Called from main.py lifespan."""
    return ensure_index(force_rebuild=force_rebuild)


def retrieve(query: str, k: int = 4) -> list[dict]:
    """
    Synchronous hybrid retrieval (BM25 + dense cosine, in-memory).

    Each result dict contains:
      source, chunk_id, snippet          – backward-compat keys
      display_title, display_url         – user-facing source info
      source_type, section_heading,
      page_number, text, score           – rich metadata
    """
    cfg = RAGConfig.from_env()
    cfg.final_top_k = k
    chunks, lexical, dense = ensure_index(config=cfg)
    results = _hybrid_retrieve(query, chunks, lexical, dense, cfg)
    return [
        {**chunk.to_citation_dict(), "text": chunk.text, "score": chunk.score}
        for chunk in results
    ]


# ──────────────────────────────────────────────
# Public API – async (Supabase pgvector + FTS)
# ──────────────────────────────────────────────

async def retrieve_async(query: str, k: int = 4) -> list[dict]:
    """
    Async hybrid retrieval via Supabase RPC (HTTPS, no direct PostgreSQL needed).

    Dense:   match_chunks() RPC function using pgvector HNSW index.
    Lexical: search_chunks_text() RPC function using PostgreSQL FTS.
    Fusion:  Reciprocal Rank Fusion (k=60).

    Falls back to the synchronous in-memory BM25 retrieve() on any error.
    """
    key = _cache_key(query, k)
    now = time.monotonic()
    cached = _retrieval_cache.get(key)
    if cached and cached[0] > now:
        return [dict(row) for row in cached[1]]

    try:
        from supabase_client import search_dense, search_lexical
        from rag.indexing.pgvector_index import rrf_fuse
        from rag.embedder import embed_query, is_available

        dense_rows: list[dict] = []
        if is_available():
            q_vec_raw = embed_query(query)
            if q_vec_raw is not None:
                dense_rows = await search_dense(
                    list(float(v) for v in q_vec_raw),
                    top_k=max(k * 3, 10),
                )

        lexical_rows = await search_lexical(query, top_k=max(k * 3, 10))

        if not dense_rows and not lexical_rows:
            raise RuntimeError("No results from Supabase RPC")

        # rrf_fuse expects dicts with a "score" key; map similarity/rank → score
        for r in dense_rows:
            r.setdefault("score", r.get("similarity", 0.0))
        for r in lexical_rows:
            r.setdefault("score", r.get("rank", 0.0))

        fused = rrf_fuse(dense_rows, lexical_rows, top_k=k)

        rows = [
            {
                "source":          row["display_title"],
                "chunk_id":        row["chunk_index"],
                "snippet":         row["snippet"],
                "display_title":   row["display_title"],
                "display_url":     row.get("display_url"),
                "source_type":     row.get("source_type", "unknown"),
                "section_heading": row.get("section_heading"),
                "page_number":     row.get("page_number"),
                "text":            row["text"],
                "score":           row["score"],
            }
            for row in fused
        ]
        _retrieval_cache[key] = (now + _RETRIEVAL_TTL_SECONDS, rows)
        return [dict(row) for row in rows]

    except Exception as exc:
        if os.getenv("VERCEL") == "1":
            print(f"[WARN] Supabase retrieval failed on Vercel; returning no chunks: {exc}")
            return []
        print(f"[WARN] Supabase retrieval failed, using BM25 fallback: {exc}")
        rows = retrieve(query, k=k)
        _retrieval_cache[key] = (now + _RETRIEVAL_TTL_SECONDS, rows)
        return [dict(row) for row in rows]


async def refresh_url_sources(force: bool = False) -> list[str]:
    """
    Fetch URL sources from kb/url_sources.json that are not yet cached.
    Writes each as a .md file to kb/sources/ with an embedded Source header.
    Returns a list of filenames written/updated.
    """
    if not URL_SOURCES_CONFIG.exists():
        return []

    try:
        entries = json.loads(URL_SOURCES_CONFIG.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        print(f"[WARN]  Could not read {URL_SOURCES_CONFIG}: {exc}")
        return []

    SOURCES_DIR.mkdir(parents=True, exist_ok=True)
    updated: list[str] = []

    for entry in entries:
        url: str = entry.get("url", "").strip()
        filename: str = entry.get("filename", "").strip()
        name: str = entry.get("name", url)

        if not url or not filename:
            continue

        # Validate URL scheme to prevent SSRF with non-http schemes
        if not url.startswith(("http://", "https://")):
            print(f"[WARN]  Skipping URL with unsupported scheme: {url}")
            continue

        cache_file = SOURCES_DIR / filename
        if cache_file.exists() and not force:
            continue

        try:
            from ingest.fetch import extract_main_text, fetch_url  # type: ignore
            raw_bytes = await fetch_url(url)
            text, title = extract_main_text(raw_bytes, url=url)
            header = f"# {title or name}\n\nSource: {url}\n\n"
            cache_file.write_text(header + text, encoding="utf-8")
            updated.append(filename)
            print(f"[OK] URL source cached: {filename} ({len(text)} chars from {url})")
        except Exception as exc:  # noqa: BLE001
            print(f"[WARN]  Could not fetch URL source '{url}': {exc}")

    return updated
