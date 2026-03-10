-- setup_db.sql  ──  bootstrap script for local dev + Neon/Supabase
-- Run once:  psql "$DATABASE_URL" -f scripts/setup_db.sql

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. sources
CREATE TABLE IF NOT EXISTS sources (
    id          BIGSERIAL PRIMARY KEY,
    type        TEXT NOT NULL CHECK (type IN ('url', 'pdf')),
    name        TEXT NOT NULL,
    url         TEXT,                          -- NULL for PDFs stored as bytes
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    tags        JSONB    NOT NULL DEFAULT '{}',
    storage_key TEXT,                          -- object-storage key for PDFs (optional)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sources_enabled ON sources (enabled);

-- 3. documents
CREATE TABLE IF NOT EXISTS documents (
    id              BIGSERIAL PRIMARY KEY,
    source_id       BIGINT NOT NULL REFERENCES sources (id) ON DELETE CASCADE,
    canonical_url   TEXT,
    title           TEXT,
    content_hash    TEXT,                      -- SHA-256 of extracted text
    last_fetched_at TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','ok','error')),
    error           TEXT,
    raw_text        TEXT,                      -- optional; set STORAGE EXTERNAL in prod
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_docs_source_id    ON documents (source_id);
CREATE INDEX IF NOT EXISTS idx_docs_content_hash ON documents (content_hash);
CREATE INDEX IF NOT EXISTS idx_docs_last_fetched ON documents (last_fetched_at);

-- 4. chunks  (embedding dim = 1536 for text-embedding-3-small)
CREATE TABLE IF NOT EXISTS chunks (
    id           BIGSERIAL PRIMARY KEY,
    document_id  BIGINT NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    chunk_index  INT    NOT NULL,
    text         TEXT   NOT NULL,
    token_count  INT,
    embedding    vector(1536),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks (document_id);
-- HNSW vector index (pgvector >= 0.5.0)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding
    ON chunks USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- 5. ingestion_runs
CREATE TABLE IF NOT EXISTS ingestion_runs (
    id          BIGSERIAL PRIMARY KEY,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    status      TEXT NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running','ok','error')),
    summary     JSONB NOT NULL DEFAULT '{}'
);

-- helper function: auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sources_updated_at ON sources;
CREATE TRIGGER trg_sources_updated_at
    BEFORE UPDATE ON sources
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
