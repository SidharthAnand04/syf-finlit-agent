# Local Development Guide – SYF Financial Literacy Agent

This guide shows you how to **run the entire system locally** with **local embeddings** (no OpenAI API costs).

## What's Running Locally?

| Component | Technology | Runs Where |
|-----------|-----------|-----------|
| **LLM** | Anthropic Claude | Via API (requires `ANTHROPIC_API_KEY`) |
| **Embeddings** | sentence-transformers (all-MiniLM-L6-v2) | Local, cached in `~/.cache/huggingface/` |
| **Database** | SQLite (dev) or Postgres (prod) | Local disk or remote DB |
| **Backend API** | FastAPI (async) | Local: `http://localhost:8000` |
| **Frontend** | Next.js + React | Local: `http://localhost:3000` |
| **Admin UI** | React (Next.js) | Local: `http://localhost:3000/admin` |

---

## Quick Start (5 minutes)

### 1. Clone & Install Dependencies

```bash
cd syf-finlit-agent
cd backend
pip install -r requirements.txt
```

**First install tip:** sentence-transformers will download the 90MB `all-MiniLM-L6-v2` model when you first run embeddings (takes ~30 seconds, cached forever after).

### 2. Set Up Environment Variables

Copy `.env.example` to `.env`:

```bash
cd ..  # back to root
cp .env.example .env
```

Then edit `.env` with your actual values:

```bash
ANTHROPIC_API_KEY=sk-ant-...    # Get from https://console.anthropic.com
ANTHROPIC_MODEL=claude-3-5-sonnet-latest
ADMIN_TOKEN=test-token-123      # Any string for local dev
DATABASE_URL=sqlite+aiosqlite:///./kb.db?check_same_thread=False
```

⚠️ **SQLite tip:** Remove the `kb.db` file to reset the database anytime:
```bash
rm backend/kb.db
```

### 3. Run Database Migrations

```bash
cd backend
alembic upgrade head
```

This creates the schema:
- `sources` – URL/PDF sources you add
- `documents` – raw extracted content 
- `chunks` – split text with 384-dim embeddings (from sentence-transformers)
- `ingestion_runs` – audit log of when you ran ingestion

### 4. Start Backend

```bash
# From backend/ directory
uvicorn src.main:app --reload --port 8000
```

**Expected output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
```

Leave this running. Open a **new terminal** for the next steps.

### 5. Start Frontend

```bash
cd frontend
npm install  # Only needed first time
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000 npm run dev
```

**Expected output:**
```
▲ Next.js 14.x
- Local:        http://localhost:3000
- Environments: .env.local
```

### 6. Open Admin UI & Add Content

- Open **`http://localhost:3000/admin`** in your browser
- When prompted, enter `ADMIN_TOKEN=test-token-123`
- Click **"Add URL Source"** → paste a URL (e.g., `https://www.investopedia.com/terms/b/budget.asp`)
- Click **"Ingest All"**
  - Backend fetches the page with trafilatura
  - Chunks it (~400 tokens per chunk, heading-aware)
  - **sentence-transformers** encodes chunks locally → 384-dim vectors
  - Stores chunks in SQLite
  
**First ingestion:** Takes ~30 seconds (model downloads on first inference). Subsequent ingestions are fast (~2 sec/100 chunks).

### 7. Chat & Test Retrieval

- Open **`http://localhost:3000`** (main chat page)
- Ask: *"What is a budget?"*
- Backend:
  1. Embeds your query locally
  2. Searches SQLite for nearest chunks (pgvector-like with vector search)
  3. Sends top 4 chunks to Anthropic Claude
  4. Claude answers with those citations

✅ **You're done!** Chat now uses **local embeddings** with **zero API latency** (query embedding is instant).

---

## Detailed Setup: Choosing Your Database

### Option A: SQLite (Recommended for Local Dev)

**Pros:**
- Zero setup – uses local file `kb.db`
- Fast for testing
- Easy to reset (delete file)

**Cons:**
- Not suitable for production
- Can't handle concurrent writes

**Setup:**
```bash
# In .env:
DATABASE_URL=sqlite+aiosqlite:///./kb.db?check_same_thread=False
```

Reset anytime:
```bash
rm backend/kb.db && cd backend && alembic upgrade head
```

### Option B: PostgreSQL (Recommended for Production)

**Pros:**
- Fully concurrent
- Scales to 1000s of chunks
- Uses pgvector for native vector search (faster than SQLite)

**Cons:**
- Requires Docker or local Postgres install

**Setup with Docker:**
```bash
# Terminal 1: Start Postgres
docker run --name postgres-kb \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:16

# Terminal 2: Create database
docker exec postgres-kb psql -U postgres -c "CREATE DATABASE kb;"

# In .env:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kb

# Then run migrations:
cd backend && alembic upgrade head
```

**Production setup** (Vercel):
- Sign up for [Neon](https://neon.tech/) (free Postgres)
- Copy connection string to `.env` vars on Vercel:
  ```
  DATABASE_URL=postgresql://user:password@...neon.tech/kb
  ```

---

## Architecture: How Embeddings Work Locally

### Flow Diagram

```
User adds URL source
    ↓
[trafilatura] fetches page
    ↓
[chunker] splits into ~400-token chunks
    ↓
[sentence-transformers: all-MiniLM-L6-v2] encodes locally
    (returns: numpy array, shape (num_chunks, 384))
    ↓
Store in SQLite/Postgres
    ↓
[Chat time]
    User query
        ↓
    [sentence-transformers] encodes query → (1, 384)
        ↓
    [SQL] similarity search in DB
        ↓
    Send top 4 chunks to Anthropic Claude
        ↓
    Claude answers with retrieval
```

### Model Details

**Model:** `sentence-transformers/all-MiniLM-L6-v2`
- **Dimension:** 384 (vs OpenAI's 1536)
- **Speed:** ~10ms per 100 tokens (CPU/GPU agnostic)
- **Memory:** ~1GB after first load, cached in `~/.cache/huggingface/hub/`
- **License:** Apache 2.0 (free, open source)

### Why all-MiniLM-L6-v2?

- Small (~90MB model)
- Fast inference (~1 sec for 1000 chunks)
- Excellent accuracy for financial/domain text
- Works on CPU (no GPU needed)
- Pre-trained on 100M+ cross-lingual pairs

---

## Troubleshooting

### Q: "ModuleNotFoundError: No module named 'sentence_transformers'"

**A:** You likely forgot to install dependencies.

```bash
cd backend
pip install -r requirements.txt
```

Verify:
```bash
python -c "import sentence_transformers; print(sentence_transformers.__version__)"
```

### Q: "Vector dimension mismatch: expected 384, got 1536"

**A:** Your database still has the old OpenAI schema (vector(1536)). **Run migrations:**

```bash
cd backend
alembic upgrade head
```

This runs migration `0002_local_embeddings.py`, which safely converts vector(1536) → vector(384).

### Q: "Downloading model... stuck or slow"

**A:** First-time download is normal (~90MB over 1-3 minutes depending on connection).

Check progress:
```bash
ls -lah ~/.cache/huggingface/hub/
```

If stuck, cleanup & retry:
```bash
rm -rf ~/.cache/huggingface/hub/models--sentence-transformers*
# Then re-run ingestion
```

### Q: "SQLite 'database is locked' error"

**A:** Multiple processes writing to SQLite at once. Solutions:

1. **Restart backend** (kill the uvicorn process and restart)
2. **Use Postgres** for concurrent ingestion
3. **Reset DB** (delete `kb.db` and re-migrate)

### Q: "Ingestion is slow / freezing at 'Embedding chunks'"

**A:** Normal for first batch (model load). Check:

```bash
# Is the model cached?
ls ~/.cache/huggingface/hub/models--sentence-transformers--all-MiniLM-L6-v2/
# Should show "snapshots" folder

# Check backend logs for model load time
# Look for "Model loaded in X seconds"
```

Subsequent ingestions should be fast (2-5 sec per 100 chunks).

### Q: "CORS error: 'Access to XMLHttpRequest blocked'"

**A:** Frontend and backend not aligned. Check:

- Backend running on `http://localhost:8000`?
- Frontend env has `NEXT_PUBLIC_BACKEND_URL=http://localhost:8000`?

```bash
# Restart frontend:
cd frontend
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000 npm run dev
```

### Q: "Admin token not working / 'Unauthorized' error"

**A:** Token mismatch between frontend and backend:

- Frontend: You entered a token in the UI
- Backend: Checks `ADMIN_TOKEN` env var

Make sure `.env` has the same token you entered:

```bash
# .env
ADMIN_TOKEN=test-token-123

# Then in admin UI, enter: test-token-123
```

For local dev, both can be anything (no validation). For production, use a strong random token:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Q: "Anthropic API key rejected / 'Invalid API Key' error"

**A:** Check your API key:

1. Get a new key from https://console.anthropic.com
2. Update `.env`:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-xxx...
   ```
3. Restart backend:
   ```bash
   # Ctrl+C in backend terminal
   # Then re-run uvicorn
   ```

---

## Development Workflow

### Adding New Sources

1. **Admin UI:** `http://localhost:3000/admin`
   - Enter URL or upload PDF
   - Click "Add Source"
   
2. **Backend ingests automatically** (or click "Ingest All")
   - Chunks are stored in DB
   - Embeddings are cached (same content → skip re-embed)

3. **Chat immediately uses** new chunks for retrieval

### Resetting Everything

```bash
# 1. Kill both processes (Ctrl+C in each terminal)

# 2. Delete database
rm backend/kb.db

# 3. Re-migrate
cd backend && alembic upgrade head

# 4. Restart both
# Backend: uvicorn src.main:app --reload
# Frontend: npm run dev
```

### Debugging Ingestion

Check logs in backend terminal:
```
INFO:     Ingesting source: https://...
INFO:     Fetched 5420 characters
INFO:     Created 12 chunks
INFO:     Embedding chunks with sentence-transformers...
INFO:     Stored 12 chunks in database
```

If a chunk isn't showing up in chat retrieval:
1. Check admin UI → "Ingestion Runs" (shows what was ingested)
2. Manually test the embedding query:
   ```bash
   # In backend terminal, add this to src/main.py temporarily:
   from src.ingest.embedder import embed_chunks
   query_vec = embed_chunks(["your test query"])[0]
   print(query_vec[:5])  # Print first 5 dims
   ```

---

## Performance Tips

| Task | Expected Time | Notes |
|------|---|---|
| First backend start | 2–3 sec | Normal startup |
| First ingestion (model download) | 30–60 sec | Model cached after |
| 100-chunk ingestion (cached model) | 2–5 sec | ~20ms per chunk |
| Query embedding | 5–10 ms | Instant (model in RAM) |
| Chat response | 2–5 sec | Anthropic API latency |

**To speed up ingestion:**
- Use smaller URLs (fewer chunks)
- Run on a faster machine (more CPU cores = faster encoding)
- Use Postgres + pgvector (slightly faster retrieval)

---

## Deployment Checklist

Before deploying to Vercel:

- [ ] Update `.env` vars on Vercel:
  - `DATABASE_URL=postgresql://...` (Neon/Supabase)
  - `ANTHROPIC_API_KEY=sk-ant-...`
  - `ADMIN_TOKEN=<strong random token>`
  - `CRON_SECRET=<strong random token>`

- [ ] Verify migrations run on deploy:
  - Check `alembic upgrade head` in build logs

- [ ] Test cron ingestion:
  - Set vercel.json schedule (`"schedules": ["0 */6 * * *"]`)
  - Check `/api/cron` endpoint (should print ingestion logs)

- [ ] Confirm pgvector extension enabled in Postgres:
  - Check: `SELECT * FROM pg_extension WHERE extname = 'vector';`

---

## Quick Command Reference

```bash
# Install & Setup
pip install -r backend/requirements.txt
alembic upgrade head

# Run Locally
cd backend && uvicorn src.main:app --reload
cd frontend && npm run dev

# Reset Database
rm backend/kb.db && alembic upgrade head

# Check Model Cache
ls ~/.cache/huggingface/hub/models--sentence-transformers*

# Run Migrations (production)
alembic upgrade head

# View Migration History
alembic history

# Create New Migration (if DB schema changes)
alembic revision --autogenerate -m "describe change"
```

---

## Next Steps

1. **Start local development** → Follow "Quick Start" section
2. **Add test content** → Use admin UI to ingest URLs/PDFs
3. **Test chat** → Ask questions, see local retrieval work
4. **Deploy to Vercel** → When ready, push to GitHub + set env vars on Vercel
5. **Monitor cron** → Check `/admin/ingest/runs` to see scheduled ingestions

---

**Questions?** Check the main [README.md](README.md) for system overview, or [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for technical details.
