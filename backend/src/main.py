"""
main.py – FastAPI application entry point.
"""

from __future__ import annotations

import os
import sys
import time
import warnings
from contextlib import asynccontextmanager
from pathlib import Path

# CRITICAL: Set UTF-8 encoding FIRST, before any other imports
os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["PYTHONWARNINGS"] = "ignore"

# Suppress all warnings that might contain unicode characters
warnings.filterwarnings("ignore")

# Allow imports from this package when run as `uvicorn src.main:app`
sys.path.insert(0, str(Path(__file__).resolve().parent))

# Before any other imports that might print (HF hub, torch, etc.) — Windows cp1252 + U+26A0.
import stdio_utf8  # noqa: F401

import asyncio

# Logging configured via the logging module was replaced with plain prints
def _force_utf8_handlers() -> None:
    """No-op replacement: logging handlers are not used; prefer prints."""
    print("[CONFIG] _force_utf8_handlers is disabled (using prints instead)")
_force_utf8_handlers()

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from typing import Optional

load_dotenv()  # Load .env from cwd or parent dirs

from chat import build_prompt, call_anthropic, format_citations, generate_followups, classify_mode, SESSION_MEMORY
from retrieval import get_index, refresh_url_sources, retrieve, retrieve_async
from safety import sanitize_input
import safety as _safety


# ──────────────────────────────────────────────
# Lifespan – pre-warm the index on startup
# ──────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    import json
    from supabase_client import ensure_app_tables, ensure_search_functions, get_setting

    # ── 0. Force UTF-8 on uvicorn handlers (created at app startup) ──────────────────
    _force_utf8_handlers()  # Re-apply to any handlers created by uvicorn

    # ── 1. Supabase table bootstrap (BLOCKING — must complete before anything else) ──
    print("[STARTUP] Ensuring Supabase tables exist...")
    from supabase_client import ensure_kb_chunks_table
    await ensure_app_tables()
    await ensure_kb_chunks_table()
    print("[OK] Supabase tables ready.")

    # ── 2. Load personality from Supabase (required — uses the tables we just created) ──
    stored = await get_setting("personality")
    if stored:
        _safety.load_personality(json.loads(stored))
        print("[OK] Personality config loaded from Supabase.")
    else:
        print("[INFO] No personality in Supabase yet -- using defaults.")

    # ── 3. Load embedding model ───────────────────────────────────────────────────────
    try:
        import rag.embedder as _emb  # noqa: F401
    except Exception as e:
        print(f"[WARN] Embedding model could not be loaded: {e}")

    # ── 4. Refresh local URL source cache + warm in-memory index ─────────────────────
    force_rebuild = False
    try:
        updated = await refresh_url_sources()
        if updated:
            print(f"[OK] URL sources fetched: {', '.join(updated)}")
            force_rebuild = True
    except Exception as e:
        print(f"[WARN] URL sources refresh warning: {e}")

    try:
        get_index(force_rebuild=force_rebuild)
        print("[OK] Index loaded successfully.")
    except ValueError as e:
        print(f"[WARN] {e}")

    # ── 5. Create Supabase search functions + seed sources in the background ────────────
    async def _bootstrap_search_and_seed():
        try:
            await ensure_search_functions()
            print("[OK] Supabase search functions ready.")
        except Exception as e:
            print(f"[WARN] Search function setup failed: {e}")
        try:
            from ingest.pipeline import seed_sources_from_config
            seed_result = await seed_sources_from_config()
            if seed_result.get("seeded", 0) > 0:
                print(f"[OK] Seeded {seed_result['seeded']} new sources into Supabase.")
        except Exception as e:
            print(f"[WARN] Source seeding failed: {e}")
    asyncio.create_task(_bootstrap_search_and_seed())

    yield


# ──────────────────────────────────────────────
# App
# ──────────────────────────────────────────────

app = FastAPI(title="SYF FinLit Chatbot", version="0.1.0", lifespan=lifespan)

_default_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
_extra = os.getenv("CORS_ORIGIN", "")  # e.g. https://your-app.vercel.app
_allowed_origins = _default_origins + [o.strip() for o in _extra.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from admin import router as admin_router  # noqa: E402
app.include_router(admin_router, prefix="/admin")


from supabase_client import log_interaction as _log_interaction


# ──────────────────────────────────────────────
# Models
# ──────────────────────────────────────────────

class ChatRequest(BaseModel):
    session_id: str | None = None
    message: str
    markdown: bool = True

    @field_validator("message")
    @classmethod
    def message_must_not_be_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("message cannot be empty")
        return v


class Citation(BaseModel):
    # Backward-compatible keys
    source: str
    chunk_id: int
    snippet: str
    # Rich metadata for UI citation display
    display_title: str = ""
    display_url: Optional[str] = None
    source_type: str = "unknown"
    section_heading: Optional[str] = None
    page_number: Optional[int] = None


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
    followups: list[str] = []


# ──────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/faqs")
async def get_active_faqs() -> list[dict]:
    """Return active FAQs as suggested prompts for the chat widget. No auth required."""
    from supabase_client import rest_get
    try:
        rows = await rest_get(
            "faqs",
            {
                "active":  "eq.true",
                "order":   "sort_order.asc,created_at.asc",
                "select":  "id,category,question,answer_note",
            },
        )
        return rows
    except Exception as e:
        print(f"[FAQS] Failed to fetch active FAQs: {e}")
        return []


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    t_start = time.monotonic()
    print(f"[CHAT] Received message: '{req.message}' | session_id={req.session_id}")

    # Sanitize
    try:
        clean_message = sanitize_input(req.message)
        print(f"[CHAT] Sanitized message: '{clean_message}'")
    except ValueError as e:
        print(f"[CHAT] Sanitization rejected message: {e}")
        raise HTTPException(status_code=422, detail=str(e))

    # Detect whether this is a follow-up turn in an existing session
    prior_turns = len(SESSION_MEMORY.get(req.session_id or "", []))
    is_followup = prior_turns > 0
    print(f"[CHAT] is_followup={is_followup} | prior_turns={prior_turns}")

    # Retrieve — prefer Supabase pgvector, fall back to in-memory BM25
    try:
        print(f"[CHAT] Retrieving chunks for query...")
        chunks = await retrieve_async(clean_message, k=4)
        print(f"[CHAT] Retrieved {len(chunks)} chunks.")
    except Exception as e:
        print(f"[CHAT] Retrieval error: {e}")
        raise HTTPException(status_code=503, detail=str(e))

    # Build prompt + call Anthropic
    print(f"[CHAT] Classifying mode...")
    mode = classify_mode(clean_message)
    print(f"[CHAT] Mode classified as: '{mode}'")
    prompt = build_prompt(clean_message, chunks)
    try:
        print(f"[CHAT] Calling Anthropic (model={os.getenv('ANTHROPIC_MODEL', 'claude-haiku-4-5')})...")
        answer = call_anthropic(prompt, session_id=req.session_id, markdown=req.markdown, mode=mode)
        print(f"[CHAT] Anthropic response received ({len(answer)} chars).")
    except EnvironmentError as e:
        print(f"[CHAT] Environment error (missing API key?): {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        print(f"[CHAT] Anthropic API error: {e}")
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {e}")

    raw_citations = format_citations(chunks)
    citations = [Citation(**c) for c in raw_citations]
    print(f"[CHAT] Formatted {len(citations)} citations.")

    try:
        followups = generate_followups(clean_message, answer, chunks)
        print(f"[CHAT] Generated {len(followups)} follow-up suggestions.")
    except Exception as e:
        print(f"[CHAT] Follow-up generation failed: {e}")
        followups = []

    response_time_ms = int((time.monotonic() - t_start) * 1000)
    print(f"[CHAT] Total response time: {response_time_ms}ms")

    # Log to Supabase — required, not optional.
    try:
        await _log_interaction(
            session_id=req.session_id,
            user_message=clean_message,
            answer=answer,
            question_type=mode,
            citations=raw_citations,
            followups=followups,
            chunks_retrieved=len(chunks),
            response_time_ms=response_time_ms,
            is_followup=is_followup,
        )
    except Exception as e:
        print(f"[CHAT_LOG] FATAL: could not write to Supabase chat_logs: {e}")
        raise HTTPException(status_code=502, detail=f"Supabase chat_logs write failed: {e}")

    return ChatResponse(answer=answer, citations=citations, followups=followups)
