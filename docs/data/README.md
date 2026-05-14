# Data And RAG

Production RAG is Supabase-first.

## Production Flow

1. Chat calls `retrieve_async()` in `backend/src/retrieval.py`.
2. Retrieval queries Supabase `kb_chunks` using dense pgvector search and PostgreSQL full-text search.
3. Results are fused and returned to the prompt builder.
4. The model returns an answer with inline citations and links where source URLs are available.

On Vercel, if Supabase retrieval fails, the backend returns no chunks instead of using local fallback retrieval.

## Supabase Tables

The backend manages tables for:

- Knowledge sources.
- Documents.
- `kb_chunks`.
- FAQs.
- Settings/personality.
- Chat logs.
- AI insight reports.

## Local KB Files

The `kb/` folder contains seed source metadata and local fallback artifacts:

- `kb/url_sources.json` - source URLs used by the ingestion seeding flow.
- `kb/sources/` - markdown source snapshots.
- `kb/processed/` - committed fallback retrieval artifacts.

These are retained because admin ingestion and local fallback workflows reference them.
