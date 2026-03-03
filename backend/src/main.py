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

load_dotenv()  # Load .env from cwd or parent dirs

from chat import build_prompt, call_anthropic, format_citations
from retrieval import get_index, retrieve
from safety import sanitize_input


# ──────────────────────────────────────────────
# Lifespan – pre-warm the index on startup
# ──────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        get_index()
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

    @field_validator("message")
    @classmethod
    def message_must_not_be_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("message cannot be empty")
        return v


class Citation(BaseModel):
    source: str
    chunk_id: int
    snippet: str


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]


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
    try:
        answer = call_anthropic(prompt)
    except EnvironmentError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {e}")

    citations = format_citations(chunks)
    return ChatResponse(answer=answer, citations=citations)
