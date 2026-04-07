"""
main.py – FastAPI application entry point.
"""

from __future__ import annotations

import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

# Allow imports from this package when run as `uvicorn src.main:app`
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from typing import Optional

load_dotenv()  # Load .env from cwd or parent dirs

from chat import build_prompt, call_anthropic, format_citations, generate_followups, classify_mode
from retrieval import get_index, refresh_url_sources, retrieve
from safety import sanitize_input


# ──────────────────────────────────────────────
# Lifespan – pre-warm the index on startup
# ──────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Eagerly import the embedding model so it loads once at startup rather
    # than on the first query (avoids lazy-init hangs at request time).
    try:
        import rag.embedder as _emb  # noqa: F401 – triggers model load
    except Exception as e:
        print(f"[WARN] Embedding model could not be loaded: {e}")

    # Fetch any URL sources that are not yet cached in kb/sources/
    force_rebuild = False
    try:
        updated = await refresh_url_sources()
        if updated:
            print(f"✓ URL sources fetched: {', '.join(updated)}")
            force_rebuild = True
    except Exception as e:  # noqa: BLE001
        print(f"⚠  URL sources refresh warning: {e}")

    # Pre-warm the TF-IDF index (force rebuild if URL sources were updated)
    try:
        get_index(force_rebuild=force_rebuild)
        print("✓ Index loaded successfully.")
    except ValueError as e:
        print(f"⚠  Warning: {e}")
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


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    # Sanitize
    try:
        clean_message = sanitize_input(req.message)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Retrieve
    try:
        chunks = retrieve(clean_message, k=4)
    except ValueError as e:
        # No docs indexed yet
        raise HTTPException(status_code=503, detail=str(e))

    # Build prompt + call Anthropic
    prompt = build_prompt(clean_message, chunks)
    mode = classify_mode(clean_message)
    try:
        answer = call_anthropic(prompt, session_id=req.session_id, markdown=req.markdown, mode=mode)
    except EnvironmentError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {e}")

    citations = [Citation(**c) for c in format_citations(chunks)]

    try:
        followups = generate_followups(clean_message, answer, chunks)
    except Exception:
        followups = []

    return ChatResponse(answer=answer, citations=citations, followups=followups)
