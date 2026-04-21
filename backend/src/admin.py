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
"""

from __future__ import annotations

import base64
import os
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, field_validator
from sqlalchemy import text

from db import get_session
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
    # From documents join
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


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

async def _get_sources_with_status(source_id: int | None = None) -> list[dict]:
    """Fetch sources joined with their latest document status."""
    where = "WHERE s.id = :sid" if source_id is not None else ""
    sql = text(
        f"""
        WITH ranked_docs AS (
            SELECT 
                id, source_id, last_fetched_at, status, error,
                ROW_NUMBER() OVER (PARTITION BY source_id ORDER BY created_at DESC) as rn
            FROM documents
        )
        SELECT
            s.id, s.type, s.name, s.url, s.enabled, s.tags,
            s.created_at, s.updated_at,
            d.last_fetched_at,
            d.status  AS doc_status,
            d.error   AS doc_error,
            (SELECT COUNT(*) FROM chunks c WHERE c.document_id = d.id) AS chunk_count
        FROM sources s
        LEFT JOIN ranked_docs d ON s.id = d.source_id AND d.rn = 1
        {where}
        ORDER BY s.created_at DESC
        """
    )
    params: dict[str, Any] = {}
    if source_id is not None:
        params["sid"] = source_id
    async with get_session() as session:
        result = await session.execute(sql, params)
        rows = result.mappings().fetchall()
    return [dict(r) for r in rows]


# ──────────────────────────────────────────────
# Source CRUD routes
# ──────────────────────────────────────────────

@router.get("/sources", dependencies=[Depends(_verify_token)])
async def list_sources() -> list[dict]:
    return await _get_sources_with_status()


@router.post("/sources/url", dependencies=[Depends(_verify_token)], status_code=201)
async def add_url_source(req: AddUrlRequest) -> dict:
    import json
    async with get_session() as session:
        result = await session.execute(
            text(
                "INSERT INTO sources (type, name, url, tags) "
                "VALUES ('url', :name, :url, :tags) "
                "RETURNING id"
            ),
            {"name": req.name, "url": req.url, "tags": json.dumps(req.tags)},
        )
        new_id = result.scalar_one()
        await session.commit()
    return {"id": new_id, "message": "URL source added."}


@router.post("/sources/pdf", dependencies=[Depends(_verify_token)], status_code=201)
async def upload_pdf_source(
    name: str = Form(...),
    file: UploadFile = File(...),
) -> dict:
    """
    Upload a PDF.  The raw bytes are stored as base64 in documents.raw_text
    (MVP approach; suitable for files up to a few MB).
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only .pdf files are accepted.")

    pdf_bytes = await file.read()
    if len(pdf_bytes) > 20 * 1024 * 1024:  # 20 MB guard
        raise HTTPException(
            status_code=413, detail="PDF too large (max 20 MB for MVP storage)."
        )
    b64 = base64.b64encode(pdf_bytes).decode("ascii")

    async with get_session() as session:
        # Create source row
        src_res = await session.execute(
            text(
                "INSERT INTO sources (type, name) VALUES ('pdf', :name) RETURNING id"
            ),
            {"name": name},
        )
        source_id = src_res.scalar_one()

        # Create document row with raw bytes (base64)
        await session.execute(
            text(
                "INSERT INTO documents (source_id, canonical_url, status, raw_text) "
                "VALUES (:sid, :cu, 'pending', :raw)"
            ),
            {
                "sid": source_id,
                "cu": f"pdf://{name}",
                "raw": b64,
            },
        )
        await session.commit()

    return {"id": source_id, "message": "PDF uploaded; run ingestion to index it."}


@router.patch("/sources/{source_id}", dependencies=[Depends(_verify_token)])
async def update_source(source_id: int, req: PatchSourceRequest) -> dict:
    import json
    updates: list[str] = []
    params: dict[str, Any] = {"sid": source_id}
    if req.name is not None:
        updates.append("name = :name")
        params["name"] = req.name
    if req.enabled is not None:
        updates.append("enabled = :enabled")
        params["enabled"] = req.enabled
    if req.tags is not None:
        updates.append("tags = :tags")
        params["tags"] = json.dumps(req.tags)

    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update.")

    async with get_session() as session:
        result = await session.execute(
            text(f"UPDATE sources SET {', '.join(updates)} WHERE id = :sid RETURNING id"),
            params,
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"Source {source_id} not found.")
        await session.commit()
    return {"message": "Updated."}


@router.delete("/sources/{source_id}", dependencies=[Depends(_verify_token)])
async def delete_source(source_id: int) -> dict:
    async with get_session() as session:
        result = await session.execute(
            text("DELETE FROM sources WHERE id = :sid RETURNING id"),
            {"sid": source_id},
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"Source {source_id} not found.")
        await session.commit()
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
    """Trigger ingestion for all enabled sources."""
    result = await run_ingestion()
    return result


@router.post("/ingest/source/{source_id}", dependencies=[Depends(_verify_token)])
async def ingest_one(source_id: int) -> dict:
    """Trigger ingestion for one specific source."""
    result = await run_ingestion(source_id=source_id)
    return result


@router.get("/ingest/runs", dependencies=[Depends(_verify_token)])
async def list_runs() -> list[dict]:
    """Return the 20 most recent ingestion runs."""
    async with get_session() as session:
        result = await session.execute(
            text(
                "SELECT id, started_at, finished_at, status, summary "
                "FROM ingestion_runs ORDER BY started_at DESC LIMIT 20"
            )
        )
        rows = result.mappings().fetchall()
    return [dict(r) for r in rows]
