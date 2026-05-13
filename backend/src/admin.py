"""
admin.py – FastAPI router for admin / knowledge-base management endpoints.

All routes are protected by Bearer token: Authorization: Bearer <ADMIN_TOKEN>
Set the ADMIN_TOKEN environment variable to a strong random secret.

Routes:
  GET  /admin/sources               – list all sources
  POST /admin/sources/url           – add a URL source
  POST /admin/sources/pdf           – upload a PDF source
  PATCH /admin/sources/{id}         – update (toggle enabled, rename, etc.)
  DELETE /admin/sources/{id}        – remove a source + its documents/chunks

  POST /admin/ingest/run            – run ingestion for all enabled sources
  POST /admin/ingest/source/{id}    – run ingestion for one source
  GET  /admin/ingest/runs           – list recent ingestion runs (last 20)

  GET  /admin/sources/{id}/status   – last document status for a source

  GET  /admin/personality           – get current personality config
  PUT  /admin/personality           – update personality config

  POST /admin/query-test            – run retrieval and return ranked chunks (debug)
"""

from __future__ import annotations

import base64
import json
import os
from datetime import datetime
from typing import Any, Optional

# Ensure UTF-8 encoding on Windows before any third-party code prints
try:
    import stdio_utf8  # noqa: F401
except ImportError:
    pass

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, field_validator

import safety
import supabase_client as _sb
from ingest.pipeline import run_ingestion

router = APIRouter(tags=["admin"])
_bearer = HTTPBearer(auto_error=True)


# ──────────────────────────────────────────────
# Auth
# ──────────────────────────────────────────────

def _verify_token(creds: HTTPAuthorizationCredentials = Depends(_bearer)) -> None:
    admin_token = os.environ.get("ADMIN_TOKEN", "")
    if not admin_token:
        raise HTTPException(
            status_code=500,
            detail="ADMIN_TOKEN is not configured on the server.",
        )
    if creds.credentials != admin_token:
        raise HTTPException(status_code=401, detail="Invalid admin token.")


# ──────────────────────────────────────────────
# Pydantic models
# ──────────────────────────────────────────────

class SourceOut(BaseModel):
    id: int
    type: str
    name: str
    url: Optional[str]
    enabled: bool
    tags: dict
    created_at: datetime
    updated_at: datetime
    last_fetched_at: Optional[datetime] = None
    doc_status: Optional[str] = None
    doc_error: Optional[str] = None
    chunk_count: Optional[int] = None


class AddUrlRequest(BaseModel):
    name: str
    url: str
    tags: dict = {}

    @field_validator("url")
    @classmethod
    def url_must_be_http(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError("url must start with http:// or https://")
        return v


class PatchSourceRequest(BaseModel):
    name: Optional[str] = None
    enabled: Optional[bool] = None
    tags: Optional[dict] = None


class PersonalityUpdate(BaseModel):
    persona_name: Optional[str] = None
    tone_description: Optional[str] = None
    system_prompt_override: Optional[str] = None
    extra_rules: Optional[list[str]] = None
    clear_override: bool = False  # explicitly set system_prompt_override to null


class QueryTestRequest(BaseModel):
    query: str
    k: int = 4


class FAQOut(BaseModel):
    id: int
    category: str
    question: str
    answer_note: str
    active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime


class AddFAQRequest(BaseModel):
    category: str = "General"
    question: str
    answer_note: str = ""
    active: bool = True
    sort_order: int = 0


class PatchFAQRequest(BaseModel):
    category: Optional[str] = None
    question: Optional[str] = None
    answer_note: Optional[str] = None
    active: Optional[bool] = None
    sort_order: Optional[int] = None


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

async def _get_sources_with_status(source_id: int | None = None) -> list[dict]:
    where = f"WHERE s.id = {source_id}" if source_id is not None else ""
    rows = await _sb.query(f"""
        WITH ranked_docs AS (
            SELECT id, source_id, last_fetched_at, status, error, chunk_count,
                   ROW_NUMBER() OVER (PARTITION BY source_id ORDER BY created_at DESC) AS rn
            FROM documents
        )
        SELECT s.id, s.type, s.name, s.url, s.enabled, s.tags,
               s.created_at, s.updated_at,
               d.last_fetched_at, d.status AS doc_status,
               d.error AS doc_error, d.chunk_count
        FROM sources s
        LEFT JOIN ranked_docs d ON s.id = d.source_id AND d.rn = 1
        {where}
        ORDER BY s.created_at DESC
    """)
    return rows


def _health_status(score: float | int | None) -> str:
    if score is None:
        return "Unknown"
    if score >= 8:
        return "Excellent"
    if score >= 6:
        return "Good"
    if score >= 4:
        return "Needs Attention"
    return "Critical"


def _normalize_insight_report(raw: dict) -> dict:
    """Normalize LLM output into the saved-report contract while preserving legacy keys."""
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            raw = {"_raw": raw}
    if not isinstance(raw, dict):
        raw = {"_raw": str(raw)}

    health = raw.get("health") if isinstance(raw.get("health"), dict) else {}
    score = raw.get("health_score", health.get("score"))
    try:
        score = float(score) if score is not None else None
    except (TypeError, ValueError):
        score = None

    status = health.get("status") or raw.get("health_status") or _health_status(score)
    risk_signals = raw.get("riskComplianceSignals") or raw.get("risk_compliance_signals") or []
    risk_level = health.get("riskLevel") or health.get("risk_level") or raw.get("risk_level")
    if not risk_level:
        risk_level = "Medium" if risk_signals else "Low"

    executive = raw.get("executiveSummary") or raw.get("executive_summary") or "No executive summary generated."
    main_problem = health.get("mainProblem") or health.get("main_problem") or raw.get("main_problem")
    if not main_problem:
        main_problem = raw.get("health_reasoning") or "Review priority fixes and content gaps."
    top_action = health.get("topAction") or health.get("top_action") or raw.get("top_action")
    if not top_action:
        quick_wins = raw.get("quick_wins") or []
        top_action = quick_wins[0] if quick_wins else "Run AI Analysis again after adding more chat data."

    content_gaps = raw.get("contentGaps") or raw.get("content_gaps") or []
    normalized_gaps = []
    for gap in content_gaps if isinstance(content_gaps, list) else []:
        if not isinstance(gap, dict):
            continue
        suggested = gap.get("suggestedAction") or gap.get("suggested_action") or "Review this gap."
        normalized_gaps.append({
            **gap,
            "suggestedAction": suggested,
            "suggested_action": suggested,
        })

    source_recs = raw.get("sourceRecommendations") or raw.get("source_recommendations") or []
    retrieval = raw.get("retrievalDiagnostics") or raw.get("retrieval_issues") or []
    priority_fixes = raw.get("priorityFixes") or []
    if not priority_fixes:
        priority_fixes = [
            {
                "problem": str(win),
                "severity": "Medium",
                "evidence": "Identified as an AI quick win.",
                "impact": "Improves answer quality or knowledge-base coverage.",
                "recommendedFix": str(win),
                "effort": "Quick",
                "confidence": "Medium",
                "owner": "Admin",
                "actionType": "kb",
            }
            for win in (raw.get("quick_wins") or [])[:5]
        ]

    report = {
        **raw,
        "executiveSummary": executive,
        "executive_summary": executive,
        "health": {
            "score": score,
            "status": status,
            "riskLevel": risk_level,
            "mainProblem": main_problem,
            "topAction": top_action,
        },
        "health_score": score,
        "health_reasoning": raw.get("health_reasoning") or main_problem,
        "priorityFixes": priority_fixes,
        "questionThemes": raw.get("questionThemes") or [],
        "contentGaps": normalized_gaps,
        "content_gaps": [
            {
                "title": gap.get("title", "Content gap"),
                "description": gap.get("description", ""),
                "evidence": gap.get("evidence", []),
                "priority": gap.get("priority", "medium"),
                "suggested_action": gap.get("suggested_action") or gap.get("suggestedAction") or "Review this gap.",
            }
            for gap in normalized_gaps
        ],
        "riskComplianceSignals": risk_signals if isinstance(risk_signals, list) else [],
        "sourceRecommendations": source_recs if isinstance(source_recs, list) else [],
        "source_recommendations": source_recs if isinstance(source_recs, list) else [],
        "retrievalDiagnostics": retrieval if isinstance(retrieval, list) else [],
        "retrieval_issues": retrieval if isinstance(retrieval, list) else [],
        "faqDrafts": raw.get("faqDrafts") or [],
        "kbDrafts": raw.get("kbDrafts") or [],
        "visualizationData": raw.get("visualizationData") or {},
    }
    return report


# ──────────────────────────────────────────────
# Source CRUD routes
# ──────────────────────────────────────────────

@router.get("/sources", dependencies=[Depends(_verify_token)])
async def list_sources() -> list[dict]:
    return await _get_sources_with_status()


@router.post("/sources/url", dependencies=[Depends(_verify_token)], status_code=201)
async def add_url_source(req: AddUrlRequest) -> dict:
    row = await _sb.rest_post(
        "sources",
        {"type": "url", "name": req.name, "url": req.url, "tags": req.tags},
        returning=True,
    )
    return {"id": row["id"], "message": "URL source added."}


@router.post("/sources/pdf", dependencies=[Depends(_verify_token)], status_code=201)
async def upload_pdf_source(
    name: str = Form(...),
    file: UploadFile = File(...),
) -> dict:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only .pdf files are accepted.")

    pdf_bytes = await file.read()
    if len(pdf_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="PDF too large (max 20 MB).")
    b64 = base64.b64encode(pdf_bytes).decode("ascii")

    src_row = await _sb.rest_post("sources", {"type": "pdf", "name": name}, returning=True)
    source_id = src_row["id"]
    await _sb.rest_post("documents", {
        "source_id": source_id,
        "canonical_url": f"pdf://{name}",
        "status": "pending",
        "raw_text": b64,
    })
    return {"id": source_id, "message": "PDF uploaded; run ingestion to index it."}


@router.patch("/sources/{source_id}", dependencies=[Depends(_verify_token)])
async def update_source(source_id: int, req: PatchSourceRequest) -> dict:
    data: dict[str, Any] = {}
    if req.name is not None:
        data["name"] = req.name
    if req.enabled is not None:
        data["enabled"] = req.enabled
    if req.tags is not None:
        data["tags"] = req.tags
    if not data:
        raise HTTPException(status_code=400, detail="Nothing to update.")
    await _sb.rest_patch("sources", {"id": source_id}, data)
    return {"message": "Updated."}


@router.delete("/sources/{source_id}", dependencies=[Depends(_verify_token)])
async def delete_source(source_id: int) -> dict:
    # Also delete associated chunks from kb_chunks
    await _sb.query(f"DELETE FROM kb_chunks WHERE chunk_id LIKE 's{source_id}c%'")
    await _sb.rest_delete("documents", {"source_id": source_id})
    await _sb.rest_delete("sources", {"id": source_id})
    return {"message": "Deleted."}


@router.get("/sources/{source_id}/status", dependencies=[Depends(_verify_token)])
async def source_status(source_id: int) -> dict:
    rows = await _get_sources_with_status(source_id)
    if not rows:
        raise HTTPException(status_code=404, detail="Source not found.")
    return rows[0]


# ──────────────────────────────────────────────
# Ingestion trigger routes
# ──────────────────────────────────────────────

@router.post("/ingest/run", dependencies=[Depends(_verify_token)])
async def ingest_all() -> dict:
    result = await run_ingestion()
    return result


@router.post("/ingest/source/{source_id}", dependencies=[Depends(_verify_token)])
async def ingest_one(source_id: int) -> dict:
    result = await run_ingestion(source_id=source_id)
    return result


@router.get("/ingest/runs", dependencies=[Depends(_verify_token)])
async def list_runs() -> list[dict]:
    rows = await _sb.rest_get(
        "ingestion_runs",
        {"select": "id,started_at,finished_at,status,summary",
         "order": "started_at.desc", "limit": "20"},
    )
    return rows


# ──────────────────────────────────────────────
# Personality routes
# ──────────────────────────────────────────────

@router.get("/personality", dependencies=[Depends(_verify_token)])
async def get_personality() -> dict:
    """Return the current personality config."""
    return safety.get_personality()


@router.put("/personality", dependencies=[Depends(_verify_token)])
async def set_personality(update: PersonalityUpdate) -> dict:
    """Merge a partial personality update, persist to Supabase, update in-memory cache."""
    patch = update.model_dump(exclude={"clear_override"}, exclude_none=True)
    if update.clear_override:
        patch["system_prompt_override"] = None

    new_config = safety.update_personality(patch)
    await _sb.set_setting("personality", json.dumps(new_config))
    return {"message": "Personality updated.", "config": new_config}


@router.post("/personality/reset", dependencies=[Depends(_verify_token)])
async def reset_personality() -> dict:
    """Reset personality to factory defaults and persist to Supabase."""
    defaults = {
        "persona_name": "Synchrony virtual assistant",
        "tone_description": "warm, calm, professional",
        "system_prompt_override": None,
        "extra_rules": [],
    }
    safety.load_personality(defaults)
    await _sb.set_setting("personality", json.dumps(defaults))
    return {"message": "Personality reset to defaults.", "config": defaults}


# ──────────────────────────────────────────────
# FAQ CRUD routes
# ──────────────────────────────────────────────

@router.get("/faqs", dependencies=[Depends(_verify_token)])
async def list_faqs() -> list[dict]:
    return await _sb.rest_get(
        "faqs",
        {"order": "sort_order.asc,created_at.asc"},
    )


@router.post("/faqs", dependencies=[Depends(_verify_token)], status_code=201)
async def add_faq(req: AddFAQRequest) -> dict:
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    row = await _sb.rest_post(
        "faqs",
        {
            "category":    req.category,
            "question":    req.question.strip(),
            "answer_note": req.answer_note.strip(),
            "active":      req.active,
            "sort_order":  req.sort_order,
        },
        returning=True,
    )
    return row


@router.patch("/faqs/{faq_id}", dependencies=[Depends(_verify_token)])
async def update_faq(faq_id: int, req: PatchFAQRequest) -> dict:
    data: dict[str, Any] = {
        "updated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f") + "Z",
    }
    if req.category    is not None: data["category"]    = req.category
    if req.question    is not None: data["question"]    = req.question.strip()
    if req.answer_note is not None: data["answer_note"] = req.answer_note.strip()
    if req.active      is not None: data["active"]      = req.active
    if req.sort_order  is not None: data["sort_order"]  = req.sort_order
    if len(data) == 1:
        raise HTTPException(status_code=400, detail="Nothing to update.")
    await _sb.rest_patch("faqs", {"id": faq_id}, data)
    return {"message": "Updated."}


@router.delete("/faqs/{faq_id}", dependencies=[Depends(_verify_token)])
async def delete_faq(faq_id: int) -> dict:
    await _sb.rest_delete("faqs", {"id": faq_id})
    return {"message": "Deleted."}


# ──────────────────────────────────────────────
# Query test route
# ──────────────────────────────────────────────

@router.post("/query-test", dependencies=[Depends(_verify_token)])
async def query_test(req: QueryTestRequest) -> dict:
    """
    Run hybrid retrieval for a query and return ranked chunks (for debugging).
    Tries Supabase pgvector first; falls back to in-memory BM25 if Supabase fails.
    """
    from retrieval import retrieve_async

    if not req.query.strip():
        raise HTTPException(status_code=422, detail="Query cannot be empty.")

    chunks = await retrieve_async(req.query.strip(), k=min(req.k, 10))
    return {
        "query": req.query,
        "chunks": [
            {
                "rank": i + 1,
                "score": round(c.get("score", 0), 4),
                "source": c.get("display_title") or c.get("source", ""),
                "url": c.get("display_url"),
                "section_heading": c.get("section_heading"),
                "page_number": c.get("page_number"),
                "source_type": c.get("source_type", "unknown"),
                "text_preview": c.get("text", "")[:400],
            }
            for i, c in enumerate(chunks)
        ],
    }


# ──────────────────────────────────────────────
# Insights route
# ──────────────────────────────────────────────

@router.get("/insights", dependencies=[Depends(_verify_token)])
async def get_insights(
    time_range_start: Optional[str] = Query(None),
    time_range_end: Optional[str] = Query(None),
) -> dict:
    """
    Aggregate analytics from Supabase chat_logs via REST API.
    Fetches raw rows over HTTPS and computes metrics in Python.
    """
    from supabase_client import get_insights as _get_insights
    return await _get_insights(time_range_start, time_range_end)


@router.post("/insights/llm-analysis", dependencies=[Depends(_verify_token)])
async def get_llm_analysis(
    time_range_start: Optional[str] = Query(None),
    time_range_end: Optional[str] = Query(None),
) -> dict:
    """
    Run an LLM-powered analysis of chat logs, KB sources, and chunk coverage.
    Calls Anthropic with aggregated analytics data and returns structured insights:
    topic clusters, content gaps, source recommendations, retrieval issues, quick wins.
    This is intentionally a POST so the client can trigger it on demand (it's slow + costly).
    """
    import asyncio
    from supabase_client import get_insights_for_llm as _get_data
    from chat import analyze_insights as _analyze

    data: dict | None = None

    try:
        data = await _get_data(time_range_start, time_range_end)

        if not data.get("all_questions") and not data.get("kpi", {}).get("total_interactions"):
            report = _normalize_insight_report({
                "executive_summary": "No chat data available yet. Start chatting with the assistant to generate analytics.",
                "health_score": 0,
                "health_reasoning": "No data",
                "topic_clusters": [],
                "content_gaps": [],
                "source_recommendations": [],
                "retrieval_issues": [],
                "quick_wins": [],
            })
            saved = await _sb.save_ai_insight_report(
                report,
                data,
                time_range_start=time_range_start,
                time_range_end=time_range_end,
                model_name=os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5"),
            )
            return {**report, "_saved_report": saved}

        # analyze_insights is sync (Anthropic SDK) – run in thread pool to avoid blocking event loop
        loop = asyncio.get_event_loop()
        raw_result = await loop.run_in_executor(None, _analyze, data)
        report = _normalize_insight_report(raw_result)
        saved = await _sb.save_ai_insight_report(
            report,
            data,
            time_range_start=time_range_start,
            time_range_end=time_range_end,
            model_name=os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5"),
        )
        return {**report, "_saved_report": saved}
    except Exception as exc:
        try:
            await _sb.save_failed_ai_insight_report(
                str(exc),
                data,
                time_range_start=time_range_start,
                time_range_end=time_range_end,
                model_name=os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5"),
            )
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {exc}") from exc


@router.get("/insights/reports", dependencies=[Depends(_verify_token)])
async def list_insight_reports(limit: int = Query(20, ge=1, le=100)) -> list[dict]:
    return await _sb.list_ai_insight_reports(limit)


@router.get("/insights/reports/{report_id}", dependencies=[Depends(_verify_token)])
async def get_insight_report(report_id: str) -> dict:
    report = await _sb.get_ai_insight_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Insight report not found.")
    return report
