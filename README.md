# Synchrony Financial Literacy Assistant

Full-stack AI assistant for Synchrony financial education. The app includes a public chat UI, a FastAPI backend, Supabase/Postgres RAG storage, and an admin console for content, FAQs, personality settings, and analytics.

The assistant is informational only. It cannot access customer accounts, approve applications, make credit decisions, or request sensitive personal information.

## Live URLs

- Frontend: `https://syf-finlit.vercel.app`
- Backend API: `https://syf-finlit-agent.vercel.app`
- Admin panel: `https://syf-finlit.vercel.app/admin`

## Repository Layout

- `api/` - Vercel Python serverless entrypoints.
- `backend/src/` - FastAPI app, chat orchestration, retrieval, ingestion, admin API, and Supabase integration.
- `frontend/` - Next.js chat UI and admin console.
- `kb/` - Seed knowledge base content and local fallback artifacts.
- `alembic/` - Database migration history.
- `docs/` - Handoff documentation.

## Production RAG Path

Production retrieval is Supabase-first. The chat endpoint calls `retrieve_async()`, which searches Supabase `kb_chunks` through pgvector/FTS helpers and fuses dense and lexical results. On Vercel, local index warmup is skipped. If Supabase retrieval fails on Vercel, the backend returns no chunks instead of falling back to the old local KB index.

The `kb/` folder is still kept because admin ingestion and source seeding use `kb/url_sources.json`, and the committed processed files support local fallback workflows.

## Local Development

Backend:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.src.main:app --reload --port 8000
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

The frontend defaults to `http://localhost:8000` for the backend unless `NEXT_PUBLIC_BACKEND_URL` is set.

## Deployment

Backend deploys from the repository root:

```powershell
vercel deploy --prod
```

Frontend deploys from `frontend/`:

```powershell
cd frontend
vercel deploy --prod
```

Vercel settings:

- Backend project: `syf-finlit-agent`, root directory `.`.
- Frontend project: `frontend`, root directory `frontend`.
- Backend alias: `syf-finlit-agent.vercel.app`.
- Frontend alias: `syf-finlit.vercel.app`.

## Environment Variables

Backend:

```env
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-haiku-4-5
ADMIN_TOKEN=...
CRON_SECRET=...
CORS_ORIGIN=https://syf-finlit.vercel.app
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
SUPABASE_ACCESS_TOKEN=...
```

Frontend:

```env
NEXT_PUBLIC_BACKEND_URL=https://syf-finlit-agent.vercel.app
```

More details are in `docs/`.
