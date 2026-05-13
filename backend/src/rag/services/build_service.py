"""
rag/services/build_service.py – Index lifecycle management.

Exposes two public functions:
  ensure_index(force_rebuild, config) – return current index, building if needed
  rebuild_index(config)               – force a full rebuild from source files

The build flow:
  1. load_sources()       → list[LoadedDocument]
  2. chunk_document()     → list[RichChunk] (per doc, flattened)
  3. LexicalIndex(chunks) → BM25 index over tokenized chunk texts
  4. DenseIndex.build()   → embed all chunks with sentence-transformers
  5. save_index()         → persist artifacts to disk
  6. sync_chunks()        → upsert chunks+embeddings to Supabase kb_chunks (async)

On next startup, load_index() restores from disk in milliseconds without
re-embedding, provided the source files have not changed.
"""
from __future__ import annotations

import asyncio

from rag.chunking.chunker import chunk_document
from rag.config import RAGConfig
from rag.indexing.dense import DenseIndex
from rag.indexing.lexical import LexicalIndex
from rag.indexing.store import load_index, save_index
from rag.ingestion.loaders import load_sources
from rag.schemas import RichChunk

# Module-level in-process cache (one per worker process)
_cache: tuple[list[RichChunk], LexicalIndex, DenseIndex] | None = None


def _build(
    config: RAGConfig,
) -> tuple[list[RichChunk], LexicalIndex, DenseIndex]:
    """Full index build: load → chunk → lexical index → dense index → save."""
    docs = load_sources()
    if not docs:
        raise ValueError(
            "No source files found in kb/sources/. "
            "Add .md, .txt, .html, or .pdf files before building the index."
        )

    all_chunks: list[RichChunk] = []
    for doc in docs:
        doc_chunks = chunk_document(doc, config)
        all_chunks.extend(doc_chunks)

    if not all_chunks:
        raise ValueError("Chunking produced no chunks. Check source file contents.")

    print(f"  {len(all_chunks)} chunks from {len(docs)} documents.")

    lexical = LexicalIndex(all_chunks)
    dense = DenseIndex.build(all_chunks)
    save_index(all_chunks, lexical._bm25, dense.matrix)

    # Sync to Supabase pgvector in the background (non-blocking)
    _schedule_pgvector_sync(all_chunks, dense.matrix)

    return all_chunks, lexical, dense


def _schedule_pgvector_sync(chunks: list[RichChunk], dense_matrix) -> None:
    """Fire-and-forget: sync chunks+embeddings to Supabase asynchronously."""
    try:
        from rag.indexing.pgvector_index import sync_chunks

        async def _run():
            try:
                await sync_chunks(chunks, dense_matrix)
            except Exception as exc:
                print(f"[WARN] pgvector sync failed (retrieval still works): {exc}")

        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(_run())
        else:
            loop.run_until_complete(_run())
    except Exception as exc:
        print(f"[WARN] Could not schedule pgvector sync: {exc}")


def ensure_index(
    force_rebuild: bool = False,
    config: RAGConfig | None = None,
) -> tuple[list[RichChunk], LexicalIndex, DenseIndex]:
    """
    Return a ready-to-use (chunks, lexical_index, dense_index) triple.

    Priority:
      1. In-process cache (instant)
      2. Disk-persisted artifacts (fast, avoids re-embedding)
      3. Full rebuild from source files (slow, ~seconds for embedding)
    """
    global _cache

    if _cache is not None and not force_rebuild:
        return _cache

    cfg = config or RAGConfig.from_env()

    if not force_rebuild:
        saved = load_index()
        if saved is not None:
            chunks, bm25_obj, dense_matrix = saved
            lexical = LexicalIndex.from_saved(chunks, bm25_obj)
            dense = DenseIndex(chunks, dense_matrix)
            _cache = (chunks, lexical, dense)
            print(f"[OK] Index loaded from disk ({len(chunks)} chunks).")
            return _cache

    print("Building RAG index from source files...")
    _cache = _build(cfg)
    return _cache


def rebuild_index(
    config: RAGConfig | None = None,
) -> tuple[list[RichChunk], LexicalIndex, DenseIndex]:
    """Force a full rebuild from source files, ignoring any cached state."""
    global _cache
    _cache = None
    return ensure_index(force_rebuild=True, config=config)


async def seed_pgvector_from_disk() -> None:
    """
    Sync the existing on-disk index to Supabase kb_chunks if the table is empty.
    Called from main.py lifespan so Supabase is seeded without a full rebuild.
    """
    try:
        from rag.indexing.pgvector_index import is_populated, sync_chunks

        if await is_populated():
            print("[OK] kb_chunks already populated -- skipping seed.")
            return

        saved = load_index()
        if saved is None:
            print("[WARN]  No disk index found -- cannot seed kb_chunks.")
            return

        chunks, _bm25, dense_matrix = saved
        await sync_chunks(chunks, dense_matrix)
    except Exception as exc:
        print(f"[WARN]  pgvector seed failed (BM25 fallback still active): {exc}")
