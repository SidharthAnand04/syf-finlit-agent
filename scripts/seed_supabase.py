"""
scripts/seed_supabase.py – Bootstrap Supabase and run a full ingestion.

Run from the repo root:
    python scripts/seed_supabase.py

What it does:
  1. Creates all application tables (sources, documents, ingestion_runs,
     settings, chat_logs) if they don't exist.
  2. Creates kb_chunks with pgvector extension, HNSW index, and GIN FTS index.
  3. Creates / replaces the match_chunks and search_chunks_text RPC functions.
  4. Seeds the `sources` table from kb/url_sources.json (idempotent — skips
     sources whose URL is already present).
  5. Runs a full ingestion pass: fetches each enabled source, chunks it,
     embeds with sentence-transformers, and writes vectors to kb_chunks.

Run it any time to sync new sources or re-index changed content.
The ingestion pipeline is hash-aware: unchanged content is skipped.
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

# ── Path setup ────────────────────────────────────────────────────────────────
_REPO_ROOT = Path(__file__).resolve().parents[1]
_BACKEND_SRC = _REPO_ROOT / "backend" / "src"
sys.path.insert(0, str(_BACKEND_SRC))

# Load .env before any supabase_client / ingest imports
from dotenv import load_dotenv
load_dotenv(_REPO_ROOT / ".env")

# Windows: force UTF-8 stdout/stderr before any embedding model prints
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
os.environ.setdefault("PYTHONUTF8", "1")
try:
    import stdio_utf8  # noqa: F401
except ImportError:
    pass


# ── Main bootstrap ────────────────────────────────────────────────────────────

async def main() -> None:
    from supabase_client import (
        ensure_app_tables,
        ensure_kb_chunks_table,
        ensure_search_functions,
    )
    from ingest.pipeline import seed_sources_from_config, run_ingestion

    print("=" * 60)
    print("  Supabase KB Bootstrap & Ingestion")
    print("=" * 60)

    # ── Step 1: Ensure all application tables ─────────────────────────────────
    print("\n[1/4] Ensuring application tables...")
    await ensure_app_tables()
    print("      ✓ sources, documents, ingestion_runs, settings, chat_logs")

    # ── Step 2: Ensure kb_chunks (pgvector) ───────────────────────────────────
    print("\n[2/4] Ensuring kb_chunks table with pgvector indexes...")
    await ensure_kb_chunks_table()
    print("      ✓ kb_chunks, HNSW vector index, GIN FTS index")

    # ── Step 3: Ensure RPC search functions ───────────────────────────────────
    print("\n[3/4] Ensuring search RPC functions...")
    await ensure_search_functions()
    print("      ✓ match_chunks (dense ANN), search_chunks_text (FTS)")

    # ── Step 4: Seed sources ──────────────────────────────────────────────────
    print("\n[4/4] Seeding sources from kb/url_sources.json...")
    seed = await seed_sources_from_config()
    print(f"      ✓ {seed['seeded']} new, {seed['skipped']} already existed", end="")
    if seed.get("errors"):
        print(f", {len(seed['errors'])} errors: {seed['errors']}")
    else:
        print()

    # ── Step 5: Run full ingestion ────────────────────────────────────────────
    print("\n[5/5] Running ingestion for all enabled sources...")
    print("      (This may take a few minutes — fetching, chunking, embedding)\n")
    result = await run_ingestion()

    print("\n" + "=" * 60)
    print("  Ingestion Complete")
    print("=" * 60)
    print(f"  Run ID  : {result.get('run_id')}")
    print(f"  Total   : {result.get('total', 0)} sources")
    print(f"  OK      : {result.get('ok', 0)}")
    print(f"  Skipped : {result.get('skipped', 0)} (content unchanged)")
    print(f"  Errors  : {result.get('errors', 0)}")

    details = result.get("details", [])
    for d in details:
        status_icon = "✓" if d["status"] == "ok" else "✗"
        skipped_note = " (skipped)" if d.get("skipped") else f" → {d.get('chunks_stored', 0)} chunks"
        err_note = f" ERROR: {d.get('error')}" if d.get("error") else ""
        print(f"  {status_icon} [{d.get('source_id')}] {d.get('name', '?')}{skipped_note}{err_note}")

    print("\nAll done. Supabase kb_chunks is now populated and ready.")


if __name__ == "__main__":
    asyncio.run(main())
