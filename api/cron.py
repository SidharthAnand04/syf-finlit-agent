"""
api/cron.py – Vercel Cron handler for scheduled ingestion.

Called by Vercel every 6 hours (configured in vercel.json).
Vercel automatically adds:
  Authorization: Bearer <CRON_SECRET>   (set in Vercel project settings)

We verify either:
  - Vercel's CRON_SECRET   (production cron)
  - ADMIN_TOKEN            (manual / curl trigger)

The handler runs ingestion for all enabled sources synchronously within
the serverless function's execution window (max 300 s on Pro).
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend" / "src"))

from dotenv import load_dotenv

load_dotenv()


class handler(BaseHTTPRequestHandler):
    """Vercel Python serverless functions use this BaseHTTPRequestHandler pattern."""

    def do_GET(self) -> None:
        self._run()

    def do_POST(self) -> None:
        self._run()

    def _run(self) -> None:
        print("Starting Vercel cron job: /api/cron", flush=True)
        # ── Auth: accept CRON_SECRET or ADMIN_TOKEN ──
        cron_secret = os.environ.get("CRON_SECRET", "")
        admin_token = os.environ.get("ADMIN_TOKEN", "")
        auth_header = self.headers.get("Authorization", "")
        bearer = auth_header.removeprefix("Bearer ").strip()

        valid_tokens = {t for t in [cron_secret, admin_token] if t}
        if bearer not in valid_tokens:
            print("Vercel cron job failed: Unauthorized", flush=True)
            self._respond(401, b'{"error":"Unauthorized"}')
            return

        print("Vercel cron job authorized. Running ingestion...", flush=True)
        # ── Run ingestion ──
        try:
            from ingest.pipeline import run_ingestion, seed_sources_from_config  # type: ignore
            from supabase_client import (  # type: ignore
                ensure_app_tables,
                ensure_kb_chunks_table,
                ensure_search_functions,
            )

            async def _run() -> dict:
                await ensure_app_tables()
                await ensure_kb_chunks_table()
                await ensure_search_functions()
                seed = await seed_sources_from_config()
                if seed.get("seeded", 0) > 0:
                    print(f"Seeded {seed['seeded']} new sources.", flush=True)
                return await run_ingestion()

            result = asyncio.run(_run())
            import json
            body = json.dumps(result).encode()
            print("Vercel cron job completed successfully.", flush=True)
            self._respond(200, body)
        except Exception as exc:
            import json
            print(f"Vercel cron job failed with exception: {exc}", flush=True)
            body = json.dumps({"error": str(exc)}).encode()
            self._respond(500, body)

    def _respond(self, code: int, body: bytes) -> None:
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):  # silence default HTTP server logging
        pass
