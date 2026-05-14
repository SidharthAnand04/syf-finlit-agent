# Backend

FastAPI backend for chat, retrieval, ingestion, admin APIs, and analytics.

## Key Paths

- `src/main.py` - FastAPI app and public routes.
- `src/chat.py` - Anthropic calls, prompt handling, citations, and AI follow-up generation.
- `src/retrieval.py` - Supabase-first RAG retrieval entrypoint.
- `src/admin.py` - protected admin endpoints.
- `src/supabase_client.py` - Supabase REST/RPC helpers.
- `src/ingest/` - URL/PDF ingestion into Supabase.
- `src/rag/` - chunking, indexing, pgvector, and local fallback retrieval utilities.

## Runtime

Production chat retrieval uses Supabase `kb_chunks` through `retrieve_async()`. On Vercel, local index warmup is skipped.

Admin routes require `Authorization: Bearer <ADMIN_TOKEN>`.

## Local Run

From the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.src.main:app --reload --port 8000
```
