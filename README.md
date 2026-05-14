# Synchrony Financial Literacy Assistant

This repository contains a full-stack financial literacy assistant built for a Synchrony capstone project. The app combines a public chat experience, a FastAPI retrieval backend, a Supabase/Postgres knowledge base, and an admin console for managing sources, FAQs, personality settings, and analytics.

The assistant is informational only. It does not access customer accounts, make credit decisions, approve applications, or request sensitive personal information.

## Live Projects

- Frontend: `https://syf-finlit.vercel.app`
- Backend API: `https://syf-finlit-agent.vercel.app`
- Frontend Vercel project: `frontend`
- Backend Vercel project: `syf-finlit-agent`

Important: the frontend app lives in `frontend/`. If deploying from Vercel Git integration, set the frontend project's Root Directory to `frontend`.

## What Is Included

- `frontend/` - Next.js chat UI and admin console.
- `backend/src/` - FastAPI app, chat orchestration, retrieval, admin API, safety prompt, ingestion, and Supabase helpers.
- `api/` - Vercel Python entrypoints for the backend and cron route.
- `kb/sources/` - Seed knowledge base markdown files.
- `kb/processed/` - Committed fallback BM25/vector artifacts used for cold starts and local fallback retrieval.
- `alembic/` - Database migration history.
- `scripts/` - Utility scripts for local indexing, Supabase setup, and inspection.

## Main Features

- RAG chat over Synchrony and financial literacy content.
- AI-generated follow-up questions after every chat response, with deterministic fallback suggestions if the follow-up model call fails.
- Synchrony-style first-person voice using "we", "our", and "us" where appropriate.
- Admin panel for:
  - Source management and ingestion.
  - FAQ/startup question management.
  - Personality prompt configuration.
  - Query testing.
  - Chat analytics and AI insight reports.
- Supabase/Postgres-backed storage for sources, chunks, chat logs, settings, FAQs, and reports.
- Local fallback retrieval using committed knowledge base artifacts.

## Architecture

The browser talks to the Next.js frontend. Chat requests go to the FastAPI backend. The backend sanitizes input, retrieves relevant knowledge base chunks, builds a grounded prompt, calls Anthropic, generates AI follow-up questions, returns citations, and logs analytics asynchronously.

Admin routes are protected by `ADMIN_TOKEN`. Public chat routes do not expose admin operations.

## Required Environment Variables

Backend:

```env
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-haiku-4-5
ADMIN_TOKEN=...
CRON_SECRET=...
CORS_ORIGIN=https://syf-finlit.vercel.app
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...
```

Frontend:

```env
NEXT_PUBLIC_BACKEND_URL=https://syf-finlit-agent.vercel.app
```

Optional tuning:

```env
FAQS_CACHE_TTL_SECONDS=300
AI_INSIGHTS_MAX_TOKENS=8000
RAG_FINAL_TOP_K=4
RAG_LEXICAL_TOP_K=10
RAG_RERANKER_ENABLED=true
```

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

Open `http://localhost:3000`. The frontend defaults to `http://localhost:8000` if `NEXT_PUBLIC_BACKEND_URL` is not set.

## Deployment

Backend production deploy from the repo root:

```powershell
vercel deploy --prod
```

Frontend production deploy from `frontend/`:

```powershell
cd frontend
vercel deploy --prod
```

Vercel settings:

- Backend project Root Directory: repo root.
- Frontend project Root Directory: `frontend`.
- Backend alias: `syf-finlit-agent.vercel.app`.
- Frontend alias: `syf-finlit.vercel.app`.

## Admin Access

Go to:

```text
https://syf-finlit.vercel.app/admin
```

Use the configured `ADMIN_TOKEN` as the admin password.

## Maintenance Notes

- To rebuild local fallback retrieval artifacts, run `python scripts/rebuild_index.py` and commit changes under `kb/processed/`.
- Do not commit `.env`, `.venv`, `frontend/node_modules`, `frontend/.next`, local logs, or TypeScript build info.
- The admin console caches short-lived admin GET responses in the browser. Signing out or a failed auth verification clears that cache.
- The chat endpoint logs analytics in a background task so logging failures do not block user responses.
