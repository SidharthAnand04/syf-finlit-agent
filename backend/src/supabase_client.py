"""
supabase_client.py – All Supabase access over HTTPS (port 443).

Two access layers:
  REST API  (service key)  – simple CRUD (chat_logs, settings, RPC functions)
  Mgmt API  (access token) – arbitrary SQL (insights, DDL, complex queries)

Neither requires a direct PostgreSQL connection (no asyncpg / port 5432).
"""

from __future__ import annotations

import json
import os
from typing import Any

import httpx


# ── SQL text helpers ──────────────────────────────────────────────────────────

def _pg_text(s: str) -> str:
    """
    Encode an arbitrary Python string as a safe PostgreSQL text literal using
    hex encoding: convert_from(decode('...', 'hex'), 'UTF8')
    Completely immune to SQL injection regardless of content.
    """
    return f"convert_from(decode('{s.encode('utf-8').hex()}', 'hex'), 'UTF8')"


def _pg_nullable(s: str | None) -> str:
    """Return NULL or a safe pg text literal."""
    return "NULL" if s is None else _pg_text(s)


def _chat_time_conditions(
    time_range_start: str | None = None,
    time_range_end: str | None = None,
    *,
    alias: str = "",
) -> list[str]:
    """Build safe chat_logs created_at filters for analytics queries."""
    prefix = f"{alias}." if alias else ""
    conditions: list[str] = []
    if time_range_start:
        conditions.append(f"{prefix}created_at >= {_pg_text(time_range_start)}::timestamptz")
    if time_range_end:
        conditions.append(f"{prefix}created_at <= {_pg_text(time_range_end)}::timestamptz")
    return conditions


def _where_sql(conditions: list[str]) -> str:
    return f"WHERE {' AND '.join(conditions)}" if conditions else ""


def _and_sql(conditions: list[str]) -> str:
    return f" AND {' AND '.join(conditions)}" if conditions else ""


# ── Config ───────────────────────────────────────────────────────────────────

def _base_url() -> str:
    url = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")
    if not url:
        raise EnvironmentError("SUPABASE_URL is not set in .env")
    return url


def _project_ref() -> str:
    # Derive ref from https://{ref}.supabase.co
    return _base_url().replace("https://", "").split(".")[0]


def _service_key() -> str:
    k = (os.getenv("SUPABASE_SERVICE_KEY") or "").strip()
    if not k:
        raise EnvironmentError("SUPABASE_SERVICE_KEY is not set in .env")
    return k


def _access_token() -> str:
    t = (os.getenv("SUPABASE_ACCESS_TOKEN") or "").strip()
    if not t:
        raise EnvironmentError("SUPABASE_ACCESS_TOKEN is not set in .env")
    return t


def _rest_headers(prefer: str = "return=minimal") -> dict:
    h = {
        "apikey": _service_key(),
        "Authorization": f"Bearer {_service_key()}",
        "Content-Type": "application/json",
    }
    if prefer:
        h["Prefer"] = prefer
    return h


def _mgmt_headers() -> dict:
    return {
        "Authorization": f"Bearer {_access_token()}",
        "Content-Type": "application/json",
        # Browser-like UA required to pass Cloudflare bot check on api.supabase.com
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
    }


# ── Management API: run arbitrary SQL ────────────────────────────────────────

async def query(sql: str) -> list[dict]:
    """Execute arbitrary SQL against Supabase via the Management API."""
    ref = _project_ref()
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"https://api.supabase.com/v1/projects/{ref}/database/query",
            headers=_mgmt_headers(),
            json={"query": sql},
        )
        resp.raise_for_status()
        return resp.json()


# ── App table bootstrap ───────────────────────────────────────────────────────

async def ensure_app_tables() -> None:
    """Create the ingestion/admin tables in Supabase if they don't exist."""
    import asyncio
    await query("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    await asyncio.gather(
        query("""
            CREATE TABLE IF NOT EXISTS sources (
                id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                type    TEXT    NOT NULL,
                name    TEXT    NOT NULL,
                url     TEXT,
                enabled BOOLEAN NOT NULL DEFAULT TRUE,
                tags    JSONB   NOT NULL DEFAULT '{}',
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """),
        query("""
            CREATE TABLE IF NOT EXISTS documents (
                id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                source_id      BIGINT NOT NULL,
                canonical_url  TEXT,
                title          TEXT,
                content_hash   TEXT,
                raw_text       TEXT,
                chunk_count    INTEGER,
                last_fetched_at TIMESTAMPTZ,
                status         TEXT NOT NULL DEFAULT 'pending',
                error          TEXT,
                created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """),
        query("""
            CREATE TABLE IF NOT EXISTS ingestion_runs (
                id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                started_at  TIMESTAMPTZ NOT NULL,
                finished_at TIMESTAMPTZ,
                status      TEXT NOT NULL DEFAULT 'running',
                summary     JSONB,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """),
        query("""
            CREATE TABLE IF NOT EXISTS settings (
                key        TEXT PRIMARY KEY,
                value      TEXT NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """),
        query("""
            CREATE TABLE IF NOT EXISTS chat_logs (
                id                 BIGSERIAL PRIMARY KEY,
                session_id         TEXT,
                user_message       TEXT NOT NULL,
                answer             TEXT NOT NULL,
                question_type      TEXT,
                citations          JSONB NOT NULL DEFAULT '[]',
                cited_urls         JSONB NOT NULL DEFAULT '[]',
                followups          JSONB NOT NULL DEFAULT '[]',
                chunks_retrieved   INTEGER,
                response_time_ms   INTEGER,
                is_followup        BOOLEAN NOT NULL DEFAULT FALSE,
                created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """),
        query("""
            CREATE TABLE IF NOT EXISTS faqs (
                id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                category    TEXT    NOT NULL DEFAULT 'General',
                question    TEXT    NOT NULL,
                answer_note TEXT    NOT NULL DEFAULT '',
                active      BOOLEAN NOT NULL DEFAULT TRUE,
                sort_order  INTEGER NOT NULL DEFAULT 0,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """),
        query("""
            CREATE TABLE IF NOT EXISTS ai_insight_reports (
                id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                report_type        TEXT NOT NULL DEFAULT 'insights',
                time_range_start   TIMESTAMPTZ,
                time_range_end     TIMESTAMPTZ,
                status             TEXT NOT NULL DEFAULT 'completed',
                health_score       NUMERIC,
                health_status      TEXT,
                risk_level         TEXT,
                executive_summary  TEXT,
                main_problem       TEXT,
                top_action         TEXT,
                model_name         TEXT,
                input_snapshot     JSONB,
                report             JSONB NOT NULL,
                created_by         TEXT,
                metadata           JSONB,
                CONSTRAINT ck_ai_insight_reports_status
                    CHECK (status IN ('running','completed','failed'))
            )
        """),
    )
    await asyncio.gather(
        query("""
            CREATE INDEX IF NOT EXISTS ix_ai_insight_reports_created_at
            ON ai_insight_reports (created_at DESC)
        """),
        query("""
            CREATE INDEX IF NOT EXISTS ix_ai_insight_reports_report_type
            ON ai_insight_reports (report_type)
        """),
        query("""
            CREATE INDEX IF NOT EXISTS ix_ai_insight_reports_status
            ON ai_insight_reports (status)
        """),
    )


# ── Settings (REST API — fast for key/value) ──────────────────────────────────

async def get_setting(key: str) -> str | None:
    """Fetch a single setting value by key."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{_base_url()}/rest/v1/settings",
            headers=_rest_headers(""),
            params={"key": f"eq.{key}", "select": "value", "limit": "1"},
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows[0]["value"] if rows else None


async def set_setting(key: str, value: str) -> None:
    """Upsert a setting (insert or update on primary key conflict)."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            f"{_base_url()}/rest/v1/settings",
            headers={**_rest_headers("return=minimal"), "Prefer": "resolution=merge-duplicates"},
            json={"key": key, "value": value},
        )
        resp.raise_for_status()


# ── Sources REST helpers ───────────────────────────────────────────────────────

async def rest_get(table: str, params: dict | None = None) -> list[dict]:
    """GET rows from a table via PostgREST."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{_base_url()}/rest/v1/{table}",
            headers=_rest_headers(""),
            params=params or {},
        )
        resp.raise_for_status()
        return resp.json()


async def rest_post(table: str, data: dict, returning: bool = False) -> dict | None:
    """INSERT a row and optionally return it."""
    prefer = "return=representation" if returning else "return=minimal"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{_base_url()}/rest/v1/{table}",
            headers=_rest_headers(prefer),
            json=data,
        )
        resp.raise_for_status()
        return resp.json()[0] if returning else None


async def rest_patch(table: str, filters: dict, data: dict) -> None:
    """UPDATE rows matching filters."""
    params = {k: f"eq.{v}" for k, v in filters.items()}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.patch(
            f"{_base_url()}/rest/v1/{table}",
            headers=_rest_headers("return=minimal"),
            params=params,
            json=data,
        )
        resp.raise_for_status()


async def rest_delete(table: str, filters: dict) -> None:
    """DELETE rows matching filters."""
    params = {k: f"eq.{v}" for k, v in filters.items()}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.delete(
            f"{_base_url()}/rest/v1/{table}",
            headers=_rest_headers("return=minimal"),
            params=params,
        )
        resp.raise_for_status()


# ── AI insight report helpers ─────────────────────────────────────────────────

def _report_summary_fields(report: dict) -> dict:
    health = report.get("health") if isinstance(report.get("health"), dict) else {}
    return {
        "health_score": report.get("health_score") or health.get("score"),
        "health_status": health.get("status") or report.get("health_status"),
        "risk_level": health.get("riskLevel") or health.get("risk_level") or report.get("risk_level"),
        "executive_summary": report.get("executiveSummary") or report.get("executive_summary"),
        "main_problem": health.get("mainProblem") or health.get("main_problem") or report.get("main_problem"),
        "top_action": health.get("topAction") or health.get("top_action") or report.get("top_action"),
    }


async def save_ai_insight_report(
    report: dict,
    input_snapshot: dict | None = None,
    *,
    status: str = "completed",
    report_type: str = "insights",
    time_range_start: str | None = None,
    time_range_end: str | None = None,
    model_name: str | None = None,
    metadata: dict | None = None,
) -> dict:
    """Persist an AI insight report snapshot. Reports are append-only."""
    summary = _report_summary_fields(report)
    row = await rest_post(
        "ai_insight_reports",
        {
            "report_type": report_type,
            "time_range_start": time_range_start,
            "time_range_end": time_range_end,
            "status": status,
            "health_score": summary["health_score"],
            "health_status": summary["health_status"],
            "risk_level": summary["risk_level"],
            "executive_summary": summary["executive_summary"],
            "main_problem": summary["main_problem"],
            "top_action": summary["top_action"],
            "model_name": model_name,
            "input_snapshot": input_snapshot,
            "report": report,
            "metadata": metadata or {},
        },
        returning=True,
    )
    return row or {}


async def save_failed_ai_insight_report(
    error: str,
    input_snapshot: dict | None = None,
    *,
    time_range_start: str | None = None,
    time_range_end: str | None = None,
    model_name: str | None = None,
) -> dict:
    report = {
        "executiveSummary": "AI analysis failed before a report could be generated.",
        "health": {
            "score": None,
            "status": "Unknown",
            "riskLevel": "Unknown",
            "mainProblem": "AI analysis failed",
            "topAction": "Retry analysis or review backend logs.",
        },
        "priorityFixes": [],
        "questionThemes": [],
        "contentGaps": [],
        "riskComplianceSignals": [],
        "sourceRecommendations": [],
        "retrievalDiagnostics": [],
        "faqDrafts": [],
        "kbDrafts": [],
        "visualizationData": {},
    }
    return await save_ai_insight_report(
        report,
        input_snapshot,
        status="failed",
        time_range_start=time_range_start,
        time_range_end=time_range_end,
        model_name=model_name,
        metadata={"error": error},
    )


async def list_ai_insight_reports(limit: int = 20) -> list[dict]:
    """Return report summaries in reverse chronological order."""
    return await rest_get(
        "ai_insight_reports",
        {
            "select": (
                "id,created_at,updated_at,report_type,time_range_start,time_range_end,status,"
                "health_score,health_status,risk_level,executive_summary,main_problem,"
                "top_action,model_name,metadata"
            ),
            "order": "created_at.desc",
            "limit": str(limit),
        },
    )


async def get_ai_insight_report(report_id: str) -> dict | None:
    rows = await rest_get(
        "ai_insight_reports",
        {
            "id": f"eq.{report_id}",
            "select": "*",
            "limit": "1",
        },
    )
    return rows[0] if rows else None


# ── kb_chunks table bootstrap ─────────────────────────────────────────────────

async def ensure_kb_chunks_table() -> None:
    """
    Create the kb_chunks table, indexes, and pgvector extension in Supabase
    if they don't already exist. Safe to call on every startup.
    """
    # Enable pgvector (idempotent)
    await query("CREATE EXTENSION IF NOT EXISTS vector")

    # Create table
    await query("""
        CREATE TABLE IF NOT EXISTS kb_chunks (
            id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            chunk_id        TEXT    NOT NULL,
            chunk_index     INTEGER NOT NULL,
            source_name     TEXT    NOT NULL,
            display_title   TEXT    NOT NULL,
            display_url     TEXT,
            source_type     TEXT    NOT NULL,
            section_heading TEXT,
            page_number     INTEGER,
            text            TEXT    NOT NULL,
            snippet         TEXT    NOT NULL,
            token_count     INTEGER,
            embedding       vector(384),
            created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Unique index on chunk_id for upserts
    await query("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_kb_chunks_chunk_id
        ON kb_chunks (chunk_id)
    """)

    # HNSW index for fast ANN vector search
    await query("""
        CREATE INDEX IF NOT EXISTS ix_kb_chunks_embedding
        ON kb_chunks USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)

    # GIN index for full-text search
    await query("""
        CREATE INDEX IF NOT EXISTS ix_kb_chunks_tsv
        ON kb_chunks USING gin (to_tsvector('english', text))
    """)

    # Index for filtering by source
    await query("""
        CREATE INDEX IF NOT EXISTS ix_kb_chunks_source
        ON kb_chunks (source_name)
    """)


# ── Stored-function bootstrap ─────────────────────────────────────────────────

async def ensure_search_functions() -> None:
    """
    Create (or replace) the two search RPC functions in Supabase.
    Safe to call on every startup; uses CREATE OR REPLACE.
    Both DDL statements fire concurrently via asyncio.gather.
    """
    import asyncio
    await asyncio.gather(
        query("""
            CREATE OR REPLACE FUNCTION match_chunks(
                query_embedding text,
                match_count     int  DEFAULT 4
            )
            RETURNS TABLE (
                chunk_id        text,
                chunk_index     int,
                source_name     text,
                display_title   text,
                display_url     text,
                source_type     text,
                section_heading text,
                page_number     int,
                text            text,
                snippet         text,
                similarity      float8
            )
            LANGUAGE sql STABLE AS $$
                SELECT
                    chunk_id, chunk_index, source_name,
                    display_title, display_url, source_type,
                    section_heading, page_number, text, snippet,
                    1 - (embedding <=> query_embedding::vector) AS similarity
                FROM kb_chunks
                ORDER BY embedding <=> query_embedding::vector
                LIMIT match_count;
            $$;
        """),
        query("""
            CREATE OR REPLACE FUNCTION search_chunks_text(
                search_query text,
                match_count  int DEFAULT 4
            )
            RETURNS TABLE (
                chunk_id        text,
                chunk_index     int,
                source_name     text,
                display_title   text,
                display_url     text,
                source_type     text,
                section_heading text,
                page_number     int,
                text            text,
                snippet         text,
                rank            float8
            )
            LANGUAGE sql STABLE AS $$
                SELECT
                    chunk_id, chunk_index, source_name,
                    display_title, display_url, source_type,
                    section_heading, page_number, text, snippet,
                    ts_rank(
                        to_tsvector('english', text),
                        plainto_tsquery('english', search_query)
                    ) AS rank
                FROM kb_chunks
                WHERE to_tsvector('english', text)
                      @@ plainto_tsquery('english', search_query)
                ORDER BY rank DESC
                LIMIT match_count;
            $$;
        """),
    )


# ── Chat log INSERT ───────────────────────────────────────────────────────────

async def log_interaction(
    *,
    session_id:       str | None,
    user_message:     str,
    answer:           str,
    question_type:    str,
    citations:        list[dict],
    followups:        list[str],
    chunks_retrieved: int,
    response_time_ms: int,
    is_followup:      bool,
) -> None:
    """Insert one chat turn into chat_logs via the REST API."""
    msg_preview = user_message.replace("\n", " ")[:200]
    print(f"[CHAT_LOG] request sent session={session_id!r} message={msg_preview!r}")

    cited_urls = [
        {
            "title": c.get("display_title") or c.get("source", ""),
            "url":   c.get("display_url"),
        }
        for c in citations
        if c.get("display_url") or c.get("display_title") or c.get("source")
    ]

    payload = {
        "session_id":       session_id,
        "user_message":     user_message,
        "answer":           answer,
        "question_type":    question_type,
        "citations":        citations,
        "cited_urls":       cited_urls,
        "followups":        followups,
        "chunks_retrieved": chunks_retrieved,
        "response_time_ms": response_time_ms,
        "is_followup":      is_followup,
    }

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            f"{_base_url()}/rest/v1/chat_logs",
            headers={
                **_rest_headers("return=minimal"),
                "Accept": "application/json",
            },
            json=payload,
        )
        if resp.is_error:
            body = (resp.text or "")[:800]
            print(
                f"[CHAT_LOG] request FAILED session={session_id!r} "
                f"message={msg_preview!r} status={resp.status_code} body={body!r}"
            )
            resp.raise_for_status()

    print(
        f"[CHAT_LOG] request completed session={session_id!r} "
        f"message={msg_preview!r} http_status={resp.status_code}"
    )


# ── Vector / lexical search via RPC ──────────────────────────────────────────

async def search_dense(query_embedding: list[float], top_k: int = 12) -> list[dict]:
    """Dense ANN search via the match_chunks RPC function."""
    vec_str = "[" + ",".join(f"{v:.6f}" for v in query_embedding) + "]"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{_base_url()}/rest/v1/rpc/match_chunks",
            headers=_rest_headers(""),
            json={"query_embedding": vec_str, "match_count": top_k},
        )
        resp.raise_for_status()
        return resp.json()


async def search_lexical(search_query: str, top_k: int = 12) -> list[dict]:
    """Full-text search via the search_chunks_text RPC function."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{_base_url()}/rest/v1/rpc/search_chunks_text",
            headers=_rest_headers(""),
            json={"search_query": search_query, "match_count": top_k},
        )
        resp.raise_for_status()
        return resp.json()


# ── Insights via Management API SQL ──────────────────────────────────────────

async def get_insights(
    time_range_start: str | None = None,
    time_range_end: str | None = None,
) -> dict:
    """
    Fetch all analytics in a single Management API round-trip using CTEs.
    One HTTP request → all metrics returned as a JSON object.
    """
    time_conditions = _chat_time_conditions(time_range_start, time_range_end)
    chat_where = _where_sql(time_conditions)
    chat_and = _and_sql(time_conditions)
    gap_where = _where_sql([*time_conditions, "(chunks_retrieved = 0 OR chunks_retrieved IS NULL)"])
    low_cite_where = _where_sql([
        *time_conditions,
        "json_array_length(citations::json) = 0",
        "chunks_retrieved > 0",
    ])

    rows = await query(f"""
        WITH
        kpi AS (
            SELECT
                COUNT(*)::int                                              AS total_interactions,
                COUNT(DISTINCT session_id)::int                            AS unique_sessions,
                ROUND(AVG(response_time_ms))::int                          AS avg_response_ms,
                ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP
                      (ORDER BY response_time_ms))::int                    AS p95_response_ms,
                ROUND(100.0 * COUNT(*) FILTER (WHERE is_followup)
                      / NULLIF(COUNT(*), 0), 1)::float                     AS followup_pct,
                ROUND(AVG(chunks_retrieved), 2)::float                     AS avg_chunks_retrieved,
                COUNT(*) FILTER (WHERE chunks_retrieved = 0)::int          AS zero_chunk_queries
            FROM chat_logs
            {chat_where}
        ),
        qt AS (
            SELECT COALESCE(question_type, 'unknown') AS question_type,
                   COUNT(*)::int AS count
            FROM chat_logs
            {chat_where}
            GROUP BY 1 ORDER BY 2 DESC
        ),
        tq AS (
            SELECT user_message,
                   COUNT(*)::int                           AS times_asked,
                   COALESCE(MAX(question_type), 'unknown') AS question_type,
                   MAX(created_at)::text                   AS last_asked
            FROM chat_logs
            {chat_where}
            GROUP BY user_message
            ORDER BY times_asked DESC
            LIMIT 25
        ),
        dc AS (
            SELECT DATE(created_at AT TIME ZONE 'UTC')::text AS day,
                   COUNT(*)::int                             AS interactions,
                   COUNT(DISTINCT session_id)::int           AS sessions
            FROM chat_logs
            WHERE created_at >= NOW() - INTERVAL '30 days'
            {chat_and}
            GROUP BY 1 ORDER BY 1 DESC
        ),
        src AS (
            SELECT url_item->>'title' AS title,
                   url_item->>'url'   AS url,
                   COUNT(*)::int      AS citation_count
            FROM chat_logs,
                 json_array_elements(cited_urls::json) AS url_item
            WHERE json_array_length(cited_urls::json) > 0
            {chat_and}
            GROUP BY 1, 2
            ORDER BY citation_count DESC
        ),
        nc AS (
            SELECT DISTINCT display_title AS title, display_url AS url
            FROM kb_chunks
            WHERE display_title NOT IN (
                SELECT DISTINCT url_item->>'title'
                FROM chat_logs,
                     json_array_elements(cited_urls::json) AS url_item
                WHERE json_array_length(cited_urls::json) > 0
                {chat_and}
            )
            ORDER BY title
        ),
        kg AS (
            SELECT user_message,
                   COUNT(*)::int        AS times_asked,
                   MAX(created_at)::text AS last_asked
            FROM chat_logs
            {gap_where}
            GROUP BY user_message
            ORDER BY times_asked DESC
            LIMIT 20
        ),
        lc AS (
            SELECT user_message,
                   COUNT(*)::int                         AS times_asked,
                   ROUND(AVG(chunks_retrieved), 1)::float AS avg_chunks,
                   MAX(created_at)::text                 AS last_asked
            FROM chat_logs
            {low_cite_where}
            GROUP BY user_message
            ORDER BY times_asked DESC
            LIMIT 20
        ),
        hh AS (
            SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::int AS hour_utc,
                   COUNT(*)::int AS count
            FROM chat_logs
            {chat_where}
            GROUP BY 1 ORDER BY 1
        )
        SELECT json_build_object(
            'summary',        (SELECT row_to_json(kpi) FROM kpi),
            'question_types', (SELECT COALESCE(json_agg(row_to_json(qt)), '[]'::json) FROM qt),
            'top_questions',  (SELECT COALESCE(json_agg(row_to_json(tq)), '[]'::json) FROM tq),
            'daily_counts',   (SELECT COALESCE(json_agg(row_to_json(dc)), '[]'::json) FROM dc),
            'source_rows',    (SELECT COALESCE(json_agg(row_to_json(src)), '[]'::json) FROM src),
            'never_cited',    (SELECT COALESCE(json_agg(row_to_json(nc)), '[]'::json) FROM nc),
            'knowledge_gaps', (SELECT COALESCE(json_agg(row_to_json(kg)), '[]'::json) FROM kg),
            'low_citation',   (SELECT COALESCE(json_agg(row_to_json(lc)), '[]'::json) FROM lc),
            'hourly',         (SELECT COALESCE(json_agg(row_to_json(hh)), '[]'::json) FROM hh)
        ) AS result
    """)

    d            = rows[0]["result"]
    summary      = d.get("summary") or {}
    source_rows  = d.get("source_rows") or []
    hh_rows      = d.get("hourly") or []
    by_hour      = {r["hour_utc"]: r["count"] for r in hh_rows}
    hourly_heatmap = [{"hour_utc": h, "count": by_hour.get(h, 0)} for h in range(24)]

    return {
        "summary":        summary,
        "question_types": d.get("question_types") or [],
        "top_questions":  d.get("top_questions") or [],
        "daily_counts":   d.get("daily_counts") or [],
        "source_usage": {
            "most_cited":  source_rows[:10],
            "least_cited": [r for r in reversed(source_rows) if r["citation_count"] <= 2][:10],
            "never_cited": d.get("never_cited") or [],
        },
        "knowledge_gaps": d.get("knowledge_gaps") or [],
        "low_citation":   d.get("low_citation") or [],
        "hourly_heatmap": hourly_heatmap,
    }


# ── LLM analysis data fetch ───────────────────────────────────────────────────

async def get_insights_for_llm(
    time_range_start: str | None = None,
    time_range_end: str | None = None,
) -> dict:
    """
    Fetch richer data for LLM-based analysis: questions, gaps, source info,
    and a sample of KB chunk topics/headings so the LLM understands KB coverage.
    """
    time_conditions = _chat_time_conditions(time_range_start, time_range_end)
    chat_where = _where_sql(time_conditions)
    gap_where = _where_sql([*time_conditions, "(chunks_retrieved = 0 OR chunks_retrieved IS NULL)"])
    low_cite_where = _where_sql([
        *time_conditions,
        "json_array_length(citations::json) = 0",
        "chunks_retrieved > 0",
    ])
    chat_and = _and_sql(time_conditions)

    rows = await query(f"""
        WITH
        all_questions AS (
            SELECT user_message,
                   COUNT(*)::int                           AS times_asked,
                   COALESCE(MAX(question_type), 'unknown') AS question_type,
                   ROUND(AVG(chunks_retrieved), 1)::float  AS avg_chunks,
                   ROUND(AVG(
                       CASE WHEN json_array_length(citations::json) > 0 THEN 1 ELSE 0 END
                   ) * 100, 0)::int                        AS citation_rate_pct,
                   MAX(created_at)::text                   AS last_asked
            FROM chat_logs
            {chat_where}
            GROUP BY user_message
            ORDER BY times_asked DESC
            LIMIT 50
        ),
        gap_questions AS (
            SELECT user_message,
                   COUNT(*)::int        AS times_asked,
                   MAX(created_at)::text AS last_asked
            FROM chat_logs
            {gap_where}
            GROUP BY user_message
            ORDER BY times_asked DESC
            LIMIT 30
        ),
        low_cite AS (
            SELECT user_message,
                   COUNT(*)::int                         AS times_asked,
                   ROUND(AVG(chunks_retrieved), 1)::float AS avg_chunks,
                   MAX(created_at)::text                 AS last_asked
            FROM chat_logs
            {low_cite_where}
            GROUP BY user_message
            ORDER BY times_asked DESC
            LIMIT 20
        ),
        source_stats AS (
            SELECT s.name                                               AS source_name,
                   s.type                                              AS source_type,
                   s.enabled,
                   COALESCE(d.chunk_count, 0)::int                    AS chunk_count,
                   COALESCE(cites.citation_count, 0)::int             AS citation_count
            FROM sources s
            LEFT JOIN (
                SELECT source_id, SUM(chunk_count)::int AS chunk_count
                FROM documents
                WHERE status = 'done'
                GROUP BY source_id
            ) d ON d.source_id = s.id
            LEFT JOIN (
                SELECT url_item->>'title' AS title, COUNT(*)::int AS citation_count
                FROM chat_logs,
                     json_array_elements(cited_urls::json) AS url_item
                WHERE json_array_length(cited_urls::json) > 0
                {chat_and}
                GROUP BY 1
            ) cites ON cites.title = s.name
            ORDER BY COALESCE(cites.citation_count, 0) DESC
        ),
        kb_topics AS (
            SELECT DISTINCT
                   COALESCE(section_heading, display_title) AS topic,
                   display_title                            AS source_title,
                   COUNT(*)::int                           AS chunk_count
            FROM kb_chunks
            WHERE section_heading IS NOT NULL OR display_title IS NOT NULL
            GROUP BY 1, 2
            ORDER BY chunk_count DESC
            LIMIT 60
        ),
        qt_summary AS (
            SELECT COALESCE(question_type, 'unknown') AS question_type,
                   COUNT(*)::int AS count
            FROM chat_logs
            {chat_where}
            GROUP BY 1
        ),
        kpi AS (
            SELECT
                COUNT(*)::int                                              AS total_interactions,
                COUNT(DISTINCT session_id)::int                            AS unique_sessions,
                ROUND(100.0 * COUNT(*) FILTER (WHERE is_followup)
                      / NULLIF(COUNT(*), 0), 1)::float                     AS followup_pct,
                COUNT(*) FILTER (WHERE chunks_retrieved = 0)::int          AS zero_chunk_queries,
                ROUND(AVG(chunks_retrieved), 2)::float                     AS avg_chunks_retrieved
            FROM chat_logs
            {chat_where}
        )
        SELECT json_build_object(
            'kpi',            (SELECT row_to_json(kpi) FROM kpi),
            'question_types', (SELECT COALESCE(json_agg(row_to_json(qt_summary)), '[]'::json) FROM qt_summary),
            'all_questions',  (SELECT COALESCE(json_agg(row_to_json(all_questions)), '[]'::json) FROM all_questions),
            'gap_questions',  (SELECT COALESCE(json_agg(row_to_json(gap_questions)), '[]'::json) FROM gap_questions),
            'low_cite',       (SELECT COALESCE(json_agg(row_to_json(low_cite)), '[]'::json) FROM low_cite),
            'source_stats',   (SELECT COALESCE(json_agg(row_to_json(source_stats)), '[]'::json) FROM source_stats),
            'kb_topics',      (SELECT COALESCE(json_agg(row_to_json(kb_topics)), '[]'::json) FROM kb_topics)
        ) AS result
    """)

    d = rows[0]["result"]
    return {
        "kpi":            d.get("kpi") or {},
        "question_types": d.get("question_types") or [],
        "all_questions":  d.get("all_questions") or [],
        "gap_questions":  d.get("gap_questions") or [],
        "low_cite":       d.get("low_cite") or [],
        "source_stats":   d.get("source_stats") or [],
        "kb_topics":      d.get("kb_topics") or [],
    }
