# Backend

The backend is a FastAPI app under `backend/src/` and is exposed on Vercel through `api/index.py`.

## Main Files

- `main.py` - FastAPI app, lifecycle startup, chat route, FAQ route, admin router mounting.
- `chat.py` - prompt construction, Anthropic calls, citations, AI follow-up question generation, insight analysis.
- `retrieval.py` - public retrieval API. Production uses Supabase-first async retrieval.
- `admin.py` - protected admin endpoints for sources, ingestion, FAQs, personality, analytics, and insights.
- `supabase_client.py` - Supabase REST/RPC helpers, schema bootstrap helpers, analytics queries.
- `safety.py` - input sanitization and default system prompt/personality cache.
- `ingest/` - source ingestion pipeline for URLs and PDFs into Supabase.
- `rag/` - chunking, indexing, retrieval, and local fallback support.

## Runtime Notes

The chat route sanitizes input, retrieves chunks, builds a grounded prompt, calls Anthropic, generates follow-up questions, formats citations, and logs analytics in a background task.

Admin routes require `Authorization: Bearer <ADMIN_TOKEN>`.

On Vercel, local embedding/index warmup is skipped. Supabase is the production RAG source.
