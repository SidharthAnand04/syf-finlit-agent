"""
retrieval.py – Backward-compatible public retrieval API.

This module is a thin facade over the new rag/ hybrid pipeline.
main.py imports get_index, refresh_url_sources, and retrieve from here;
those signatures are preserved unchanged.

The underlying implementation now uses:
  - BM25 (rank-bm25) for lexical retrieval
  - sentence-transformers for dense embedding retrieval
  - Reciprocal Rank Fusion (RRF) for hybrid reranking
  - Rich metadata (display_title, display_url, section_heading, page_number)
    so citations point to the original public URL, not internal filenames.
"""
from __future__ import annotations

import json
from pathlib import Path

from rag.config import RAGConfig, SOURCES_DIR, URL_SOURCES_CONFIG
from rag.indexing.dense import DenseIndex
from rag.indexing.lexical import LexicalIndex
from rag.retrieval.hybrid import retrieve as _hybrid_retrieve
from rag.schemas import RichChunk
from rag.services.build_service import ensure_index, rebuild_index


# ──────────────────────────────────────────────
# Public API (backward-compatible with main.py)
# ──────────────────────────────────────────────

def get_index(
    force_rebuild: bool = False,
) -> tuple[list[RichChunk], LexicalIndex, DenseIndex]:
    """Pre-warm or return the current index. Called from main.py lifespan."""
    return ensure_index(force_rebuild=force_rebuild)


def retrieve(query: str, k: int = 4) -> list[dict]:
    """
    Return the top-k most relevant chunks for *query* using hybrid retrieval.

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
        print(f"⚠  Could not read {URL_SOURCES_CONFIG}: {exc}")
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
            print(f"⚠  Skipping URL with unsupported scheme: {url}")
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
            print(f"✓ URL source cached: {filename} ({len(text)} chars from {url})")
        except Exception as exc:  # noqa: BLE001
            print(f"⚠  Could not fetch URL source '{url}': {exc}")

    return updated
