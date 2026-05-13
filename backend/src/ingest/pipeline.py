"""
ingest/pipeline.py – Orchestration of the end-to-end ingestion pipeline.

Flow per source:
  1. Fetch content (URL → HTTP, PDF → raw_text base64 from documents row)
  2. Extract text
  3. Compute content_hash (SHA-256)
  4. If hash unchanged → skip re-chunk + re-embed (idempotent)
  5. Chunk text
  6. Embed chunks
  7. Write to Supabase: documents row + kb_chunks rows (pgvector)
  8. Update ingestion_run summary

All DB access goes through supabase_client (Management API / REST API over HTTPS).
No direct PostgreSQL connection required.
"""

from __future__ import annotations

import stdio_utf8  # noqa: F401  # Windows: UTF-8 stdout before embedders / fetch

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from ingest.chunker import chunk_text
from ingest.embedder import embed_texts
from ingest.fetch import extract_main_text, fetch_url
from ingest.pdf import parse_pdf

# Local KB fallback for pre-downloaded sources
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_KB_SOURCES_DIR = _PROJECT_ROOT / "kb" / "sources"
_URL_SOURCES_CONFIG = _PROJECT_ROOT / "kb" / "url_sources.json"
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
                print(f"[WARN] Could not load url_sources.json: {exc}")
    return _URL_TO_LOCAL_FILE


def _try_local_kb_fallback(url: str) -> Optional[tuple[str, Optional[str]]]:
    mapping = _get_url_to_local_map()
    filename = mapping.get(url)
    if not filename:
        return None
    local_path = _KB_SOURCES_DIR / filename
    if not local_path.exists():
        return None
    raw = local_path.read_text(encoding="utf-8")
    title: Optional[str] = None
    for line in raw.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            title = stripped[2:].strip()
            break
    print(f"[OK] Using local KB fallback for {url}: {filename} ({len(raw)} chars)")
    return raw, title


def _sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _vec_literal(vector: list[float]) -> str:
    return "[" + ",".join(f"{v:.8f}" for v in vector) + "]"


# ── Per-source ingestion ──────────────────────────────────────────────────────

async def ingest_source(source_id: int) -> dict[str, Any]:
    """Ingest one source. Returns a summary dict."""
    from supabase_client import query as sb_query, _pg_text, _pg_nullable

    summary: dict[str, Any] = {
        "source_id": source_id,
        "status":    "ok",
        "chunks_stored": 0,
        "skipped":   False,
        "error":     None,
    }

    rows = await sb_query(
        f"SELECT id, type, name, url FROM sources WHERE id = {source_id}"
    )
    if not rows:
        summary["status"] = "error"
        summary["error"] = f"Source {source_id} not found."
        return summary

    row = rows[0]
    summary["name"] = row["name"]

    try:
        # ── 1. Fetch / extract ────────────────────────────────────────────────
        if row["type"] == "url":
            if not row["url"]:
                raise ValueError("URL source has no url set.")
            extracted_text = ""
            title = None
            try:
                raw_bytes = await fetch_url(row["url"])
                extracted_text, title = extract_main_text(raw_bytes, url=row["url"])
            except Exception as live_exc:
                print(f"[WARN] Live fetch failed for {row['url']}: {live_exc}. Trying local KB fallback.")
                fallback = _try_local_kb_fallback(row["url"])
                if fallback is not None:
                    extracted_text, title = fallback
                else:
                    raise
            if len(extracted_text) < 500:
                fallback = _try_local_kb_fallback(row["url"])
                if fallback is not None:
                    extracted_text, title = fallback
            canonical_url = row["url"]

        elif row["type"] == "pdf":
            import base64
            pdf_rows = await sb_query(
                f"SELECT id, raw_text FROM documents "
                f"WHERE source_id = {source_id} AND raw_text IS NOT NULL "
                f"ORDER BY created_at DESC LIMIT 1"
            )
            if not pdf_rows or not pdf_rows[0]["raw_text"]:
                raise ValueError("No PDF bytes found for source.")
            pdf_bytes = base64.b64decode(pdf_rows[0]["raw_text"])
            extracted_text, title = parse_pdf(pdf_bytes)
            canonical_url = row["url"] or f"pdf://{row['name']}"
        else:
            raise ValueError(f"Unknown source type: {row['type']!r}")

        # ── 2. Hash ───────────────────────────────────────────────────────────
        content_hash = _sha256(extracted_text)

        # ── 3. Check existing document ────────────────────────────────────────
        existing_rows = await sb_query(
            f"SELECT id, content_hash, status FROM documents "
            f"WHERE source_id = {source_id} ORDER BY created_at DESC LIMIT 1"
        )
        existing = existing_rows[0] if existing_rows else None
        now_iso = datetime.now(timezone.utc).isoformat()

        if existing and existing["content_hash"] == content_hash and existing["status"] == "ok":
            # Unchanged — just update last_fetched_at
            await sb_query(
                f"UPDATE documents SET last_fetched_at = '{now_iso}' WHERE id = {existing['id']}"
            )
            summary["skipped"] = True
            return summary

        # ── 4+5. Chunk + embed ────────────────────────────────────────────────
        chunks = chunk_text(extracted_text)
        if not chunks:
            raise ValueError("Chunking returned no chunks.")
        vectors = embed_texts([c.text for c in chunks])

        display_title = title or row["name"]
        display_url   = row["url"] if row["type"] == "url" else None
        source_name   = row["name"]

        # ── 6. Upsert document row ────────────────────────────────────────────
        if existing:
            await sb_query(
                f"DELETE FROM kb_chunks WHERE chunk_id LIKE 's{source_id}c%'"
            )
            await sb_query(
                f"UPDATE documents SET "
                f"  canonical_url = {_pg_text(canonical_url)}, "
                f"  title = {_pg_text(display_title)}, "
                f"  content_hash = {_pg_text(content_hash)}, "
                f"  last_fetched_at = '{now_iso}', "
                f"  chunk_count = {len(chunks)}, "
                f"  status = 'ok', error = NULL "
                f"WHERE id = {existing['id']}"
            )
            doc_id = existing["id"]
        else:
            doc_rows = await sb_query(
                f"INSERT INTO documents "
                f"  (source_id, canonical_url, title, content_hash, "
                f"   last_fetched_at, chunk_count, status) "
                f"VALUES ("
                f"  {source_id}, "
                f"  {_pg_text(canonical_url)}, "
                f"  {_pg_text(display_title)}, "
                f"  {_pg_text(content_hash)}, "
                f"  '{now_iso}', "
                f"  {len(chunks)}, "
                f"  'ok'"
                f") RETURNING id"
            )
            doc_id = doc_rows[0]["id"]

        # ── 7. Write chunks to kb_chunks ──────────────────────────────────────
        for chunk, vector in zip(chunks, vectors):
            chunk_id = f"s{source_id}c{chunk.chunk_index}"
            vec_str  = _vec_literal(vector)
            snippet  = chunk.text[:300].replace("\n", " ")
            await sb_query(
                f"INSERT INTO kb_chunks "
                f"  (chunk_id, chunk_index, source_name, display_title, display_url, "
                f"   source_type, text, snippet, token_count, embedding) "
                f"VALUES ("
                f"  {_pg_text(chunk_id)}, "
                f"  {chunk.chunk_index}, "
                f"  {_pg_text(source_name)}, "
                f"  {_pg_text(display_title)}, "
                f"  {_pg_nullable(display_url)}, "
                f"  {_pg_text(row['type'])}, "
                f"  {_pg_text(chunk.text)}, "
                f"  {_pg_text(snippet)}, "
                f"  {chunk.token_count}, "
                f"  '{vec_str}'::vector"
                f") ON CONFLICT (chunk_id) DO UPDATE SET "
                f"  text = EXCLUDED.text, snippet = EXCLUDED.snippet, "
                f"  display_title = EXCLUDED.display_title, "
                f"  display_url = EXCLUDED.display_url, "
                f"  token_count = EXCLUDED.token_count, "
                f"  embedding = EXCLUDED.embedding"
            )

        summary["chunks_stored"] = len(chunks)

    except Exception as exc:  # noqa: BLE001
        summary["status"] = "error"
        summary["error"] = str(exc)[:1000]
        try:
            now_iso = datetime.now(timezone.utc).isoformat()
            err_safe = exc.__class__.__name__ + ": " + str(exc)[:800]
            await sb_query(
                f"UPDATE documents SET status='error', error={_pg_text(err_safe)} "
                f"WHERE source_id = {source_id}"
            )
        except Exception:
            pass

    return summary


# ── Source seeding from url_sources.json ─────────────────────────────────────

async def seed_sources_from_config() -> dict[str, Any]:
    """
    Seed the Supabase `sources` table from kb/url_sources.json.

    Only inserts sources that don't already exist (matched by URL).
    Safe to call on every startup / cron run.
    Returns a summary of what was inserted.
    """
    from supabase_client import query as sb_query, _pg_text

    if not _URL_SOURCES_CONFIG.exists():
        return {"seeded": 0, "skipped": 0, "errors": []}

    try:
        entries = json.loads(_URL_SOURCES_CONFIG.read_text(encoding="utf-8"))
    except Exception as exc:
        return {"seeded": 0, "skipped": 0, "errors": [str(exc)]}

    # Fetch all URLs already in Supabase sources
    existing_rows = await sb_query("SELECT url FROM sources WHERE type = 'url'")
    existing_urls = {r["url"] for r in existing_rows if r.get("url")}

    seeded = 0
    skipped = 0
    errors: list[str] = []

    for entry in entries:
        url = entry.get("url", "").strip()
        name = entry.get("name", "").strip() or url
        if not url:
            continue
        if url in existing_urls:
            skipped += 1
            continue
        try:
            await sb_query(
                f"INSERT INTO sources (type, name, url, enabled) "
                f"VALUES ('url', {_pg_text(name)}, {_pg_text(url)}, TRUE) "
                f"ON CONFLICT DO NOTHING"
            )
            seeded += 1
            print(f"[SEED] Added source: {name} → {url}")
        except Exception as exc:
            errors.append(f"{url}: {exc}")

    print(f"[SEED] Sources seeded: {seeded} new, {skipped} already existed, {len(errors)} errors")
    return {"seeded": seeded, "skipped": skipped, "errors": errors}


# ── Run coordinator ───────────────────────────────────────────────────────────

async def run_ingestion(source_id: int | None = None) -> dict[str, Any]:
    """Run ingestion for all enabled sources, or one source if source_id given."""
    from supabase_client import query as sb_query

    now_iso = datetime.now(timezone.utc).isoformat()
    run_rows = await sb_query(
        f"INSERT INTO ingestion_runs (started_at, status) "
        f"VALUES ('{now_iso}', 'running') RETURNING id"
    )
    run_id: int = run_rows[0]["id"]

    if source_id is not None:
        id_rows = await sb_query(
            f"SELECT id FROM sources WHERE id = {source_id} AND enabled = TRUE"
        )
    else:
        id_rows = await sb_query(
            "SELECT id FROM sources WHERE enabled = TRUE"
        )
    source_ids = [r["id"] for r in id_rows]

    summaries: list[dict] = []
    for sid in source_ids:
        s = await ingest_source(sid)
        summaries.append(s)

    errors     = [s for s in summaries if s["status"] == "error"]
    agg_status = "error" if errors and len(errors) == len(summaries) else "ok"
    final_summary = {
        "total":   len(summaries),
        "ok":      sum(1 for s in summaries if s["status"] == "ok"),
        "skipped": sum(1 for s in summaries if s.get("skipped")),
        "errors":  len(errors),
        "details": summaries,
    }

    finished_iso = datetime.now(timezone.utc).isoformat()
    await sb_query(
        f"UPDATE ingestion_runs "
        f"SET finished_at = '{finished_iso}', "
        f"    status = '{agg_status}', "
        f"    summary = '{json.dumps(final_summary).replace(chr(39), chr(39)*2)}' "
        f"WHERE id = {run_id}"
    )

    return {"run_id": run_id, **final_summary}
