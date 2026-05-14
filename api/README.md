# API Entrypoints

Vercel Python serverless entrypoints for the backend project.

## Files

- `index.py` - loads the FastAPI app from `backend/src/main.py`.
- `cron.py` - scheduled/manual ingestion endpoint for enabled sources.

## Notes

The backend Vercel project deploys from the repository root. `vercel.json` rewrites API traffic to these entrypoints and includes `backend/**` and `kb/**` in the serverless bundle.
