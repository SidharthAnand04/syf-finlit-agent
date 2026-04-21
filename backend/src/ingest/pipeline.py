"""
ingest/pipeline.py – Orchestration of the end-to-end ingestion pipeline.

Flow per source:
  1. Fetch content (URL → HTTP, PDF → raw_text base64 from documents row)
  2. Extract text
  3. Compute content_hash (SHA-256)
  4. If hash unchanged → skip re-chunk + re-embed (idempotent)
  5. Chunk text
  6. Embed chunks
  7. Store documents + chunks in Postgres (delete old chunks first)
  8. Update ingestion_run summary

All DB access uses raw SQL via sqlalchemy.text() because the `chunks.embedding`
column is a pgvector type that SQLAlchemy's ORM cannot represent natively.
"""

from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from ingest.chunker import chunk_text
from ingest.embedder import embed_texts
from ingest.fetch import extract_main_text, fetch_url
from ingest.pdf import parse_pdf

# Detect whether we're running against SQLite (local dev) or Postgres (production)
# Project root is 3 levels up from backend/src/ingest/pipeline.py
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_KB_SOURCES_DIR = _PROJECT_ROOT / "kb" / "sources"
_URL_SOURCES_CONFIG = _PROJECT_ROOT / "kb" / "url_sources.json"

# Lazy-loaded mapping: url → local markdown filename
_URL_TO_LOCAL_FILE: Optional[dict[str, str]] = None


def _get_url_to_local_map() -> dict[str, str]:
    global _URL_TO_LOCAL_FILE
    if _URL_TO_LOCAL_FILE is None:
        _URL_TO_LOCAL_FILE = {}
        if _URL_SOURCES_CONFIG.exists():
            try:
                entries = json.loads(_URL_SOURCES_CONFIG.read_text(encoding="utf-8"))
                for entry in entries:
                    url = entry.get("url", "").strip()
                    filename = entry.get("filename", "").strip()
                    if url and filename:
                        _URL_TO_LOCAL_FILE[url] = filename
            except Exception as exc:
                print(f"⚠  Could not load url_sources.json: {exc}")
    return _URL_TO_LOCAL_FILE


def _try_local_kb_fallback(url: str) -> Optional[tuple[str, Optional[str]]]:
    """
    Check if there is a pre-downloaded markdown file for *url* in kb/sources/.
    Returns (text, title) or None if no local file found.
    """
    mapping = _get_url_to_local_map()
    filename = mapping.get(url)
    if not filename:
        return None
    local_path = _KB_SOURCES_DIR / filename
    if not local_path.exists():
        return None
    raw = local_path.read_text(encoding="utf-8")
    # Extract title from first heading line if present
    title: Optional[str] = None
    for line in raw.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            title = stripped[2:].strip()
            break
    print(f"✓ Using local KB fallback for {url}: {filename} ({len(raw)} chars)")
    return raw, title
_IS_SQLITE = "sqlite" in os.environ.get("DATABASE_URL", "sqlite")


def _sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _vec_literal(vector: list[float]) -> str:
    """Convert a float list to the pgvector literal format '[0.1,0.2,…]'."""
    return "[" + ",".join(f"{v:.8f}" for v in vector) + "]"


# ──────────────────────────────────────────────
# Per-source ingestion
# ──────────────────────────────────────────────

async def ingest_source(source_id: int, session: AsyncSession) -> dict[str, Any]:
    """
    Ingest a single source row identified by *source_id*.
    Returns a summary dict.
    """
    summary: dict[str, Any] = {
        "source_id": source_id,
        "status": "ok",
        "chunks_stored": 0,
        "skipped": False,
        "error": None,
    }

    # Load source row
    row = (await session.execute(
        text("SELECT id, type, name, url FROM sources WHERE id = :id"),
        {"id": source_id},
    )).mappings().first()

    if row is None:
        summary["status"] = "error"
        summary["error"] = f"Source {source_id} not found."
        return summary

    summary["name"] = row["name"]

    try:
        # ── 1. Fetch/extract ─────────────────────────────────────────────
        if row["type"] == "url":
            if not row["url"]:
                raise ValueError("URL source has no url set.")
            extracted_text = ""
            title = None
            # Try live fetch first; fall back to pre-downloaded local KB file
            # (JS-rendered pages like synchrony.com return empty HTML to plain httpx)
            try:
                raw_bytes = await fetch_url(row["url"])
                extracted_text, title = extract_main_text(raw_bytes, url=row["url"])
            except Exception as live_exc:
                print(f"⚠  Live fetch failed for {row['url']}: {live_exc}. Trying local KB fallback.")
                fallback = _try_local_kb_fallback(row["url"])
                if fallback is not None:
                    extracted_text, title = fallback
                else:
                    raise
            # If live fetch succeeded but returned very little, prefer local file
            if len(extracted_text) < 500:
                fallback = _try_local_kb_fallback(row["url"])
                if fallback is not None:
                    extracted_text, title = fallback
            canonical_url = row["url"]

        elif row["type"] == "pdf":
            import base64
            # PDF bytes are stored as base64 in documents.raw_text
            pdf_row = (await session.execute(
                text(
                    "SELECT id, raw_text FROM documents "
                    "WHERE source_id = :sid AND raw_text IS NOT NULL "
                    "ORDER BY created_at DESC LIMIT 1"
                ),
                {"sid": source_id},
            )).mappings().first()
            if pdf_row is None or not pdf_row["raw_text"]:
                raise ValueError("No PDF bytes found for source.")
            pdf_bytes = base64.b64decode(pdf_row["raw_text"])
            extracted_text, title = parse_pdf(pdf_bytes)
            canonical_url = row["url"] or f"pdf://{row['name']}"
        else:
            raise ValueError(f"Unknown source type: {row['type']!r}")

        # ── 2. Hash ──────────────────────────────────────────────────────
        content_hash = _sha256(extracted_text)

        # ── 3. Existing document check ───────────────────────────────────
        existing = (await session.execute(
            text(
                "SELECT id, content_hash, status FROM documents "
                "WHERE source_id = :sid ORDER BY created_at DESC LIMIT 1"
            ),
            {"sid": source_id},
        )).mappings().first()

        now = datetime.now(timezone.utc)

        if existing and existing["content_hash"] == content_hash \
                and existing["status"] == "ok":
            # Unchanged – skip re-embed, just refresh last_fetched_at
            await session.execute(
                text(
                    "UPDATE documents SET last_fetched_at = :ts "
                    "WHERE id = :did"
                ),
                {"ts": now, "did": existing["id"]},
            )
            await session.commit()
            summary["skipped"] = True
            return summary

        # ── 4+5. Chunk + Embed ───────────────────────────────────────────
        chunks = chunk_text(extracted_text)
        if not chunks:
            raise ValueError("Chunking returned no chunks.")
        vectors = embed_texts([c.text for c in chunks])

        # ── 6. Upsert document ───────────────────────────────────────────
        if existing:
            # Delete stale chunks
            await session.execute(
                text("DELETE FROM chunks WHERE document_id = :did"),
                {"did": existing["id"]},
            )
            await session.execute(
                text(
                    "UPDATE documents SET canonical_url=:cu, title=:title, "
                    "content_hash=:hash, last_fetched_at=:ts, "
                    "status='ok', error=NULL WHERE id=:did"
                ),
                {
                    "cu": canonical_url,
                    "title": title or row["name"],
                    "hash": content_hash,
                    "ts": now,
                    "did": existing["id"],
                },
            )
            doc_id = existing["id"]
        else:
            res = await session.execute(
                text(
                    "INSERT INTO documents "
                    "(source_id, canonical_url, title, content_hash, "
                    "last_fetched_at, status) "
                    "VALUES (:sid, :cu, :title, :hash, :ts, 'ok') "
                    "RETURNING id"
                ),
                {
                    "sid": source_id,
                    "cu": canonical_url,
                    "title": title or row["name"],
                    "hash": content_hash,
                    "ts": now,
                },
            )
            doc_id = res.scalar_one()

        # ── 7. Insert chunks ─────────────────────────────────────────────
        # SQLite stores embeddings as plain text (BLOB column accepts text).
        # Postgres uses the pgvector ::vector cast for native vector type.
        if _IS_SQLITE:
            chunk_sql = (
                "INSERT INTO chunks "
                "(document_id, chunk_index, content, token_count, embedding) "
                "VALUES (:did, :idx, :txt, :tc, :emb)"
            )
        else:
            chunk_sql = (
                "INSERT INTO chunks "
                "(document_id, chunk_index, content, token_count, embedding) "
                "VALUES (:did, :idx, :txt, :tc, :emb::vector)"
            )
        for chunk, vector in zip(chunks, vectors):
            await session.execute(
                text(chunk_sql),
                {
                    "did": doc_id,
                    "idx": chunk.chunk_index,
                    "txt": chunk.text,
                    "tc": chunk.token_count,
                    "emb": _vec_literal(vector),
                },
            )

        await session.commit()
        summary["chunks_stored"] = len(chunks)

    except Exception as exc:  # noqa: BLE001
        await session.rollback()
        summary["status"] = "error"
        summary["error"] = str(exc)[:1000]
        try:
            await session.execute(
                text(
                    "UPDATE documents SET status='error', error=:err "
                    "WHERE source_id=:sid"
                ),
                {"err": summary["error"], "sid": source_id},
            )
            await session.commit()
        except Exception:  # noqa: BLE001
            pass

    return summary


# ──────────────────────────────────────────────
# Run coordinator
# ──────────────────────────────────────────────

async def run_ingestion(source_id: int | None = None) -> dict[str, Any]:
    """
    Run ingestion for all enabled sources, or one source if *source_id* given.
    Returns summary dict including `run_id`.
    """
    async with get_session() as session:
        _now = datetime.now(timezone.utc)
        run_res = await session.execute(
            text(
                "INSERT INTO ingestion_runs (started_at, status) "
                "VALUES (:ts, 'running') RETURNING id"
            ),
            {"ts": _now},
        )
        run_id: int = run_res.scalar_one()
        await session.commit()

        # Fetch applicable source IDs
        if source_id is not None:
            ids_res = await session.execute(
                text("SELECT id FROM sources WHERE id = :id AND enabled = TRUE"),
                {"id": source_id},
            )
        else:
            ids_res = await session.execute(
                text("SELECT id FROM sources WHERE enabled = TRUE")
            )
        source_ids = [r[0] for r in ids_res.fetchall()]

        summaries: list[dict] = []
        for sid in source_ids:
            s = await ingest_source(sid, session)
            summaries.append(s)

        errors = [s for s in summaries if s["status"] == "error"]
        agg_status = "error" if errors and len(errors) == len(summaries) else "ok"

        final_summary = {
            "total": len(summaries),
            "ok": sum(1 for s in summaries if s["status"] == "ok"),
            "skipped": sum(1 for s in summaries if s.get("skipped")),
            "errors": len(errors),
            "details": summaries,
        }

        await session.execute(
            text(
                "UPDATE ingestion_runs "
                "SET finished_at=:ft, status=:st, summary=:s "
                "WHERE id=:rid"
            ),
            {"ft": datetime.now(timezone.utc), "st": agg_status, "s": json.dumps(final_summary), "rid": run_id},
        )
        await session.commit()

        return {"run_id": run_id, **final_summary}
