# Deployment

The app is deployed as two Vercel projects.

## Backend

- Project: `syf-finlit-agent`
- Root directory: repository root
- Production alias: `https://syf-finlit-agent.vercel.app`
- Vercel entrypoints: `api/index.py` and `api/cron.py`

Deploy:

```powershell
vercel deploy --prod
```

## Frontend

- Project: `frontend`
- Root directory: `frontend`
- Production alias: `https://syf-finlit.vercel.app`

Deploy:

```powershell
cd frontend
vercel deploy --prod
```

Important: if Vercel Git integration is enabled, the frontend project's Root Directory must be `frontend`. If it is `.`, Vercel will run `next build` from the repository root and fail because there is no root `app` or `pages` directory.

## Required Environment Variables

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
