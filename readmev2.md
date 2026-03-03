# SYF FinLit Chatbot

A minimal, local-first RAG + chat application for financial literacy education.

**Stack:** FastAPI · Anthropic Claude · TF-IDF retrieval · Next.js (App Router)

---

## How it works

1. Documents (`.md` / `.txt`) are placed in `kb/sources/`.
2. On startup the backend chunks each document by paragraph, builds a TF-IDF index (cached at `kb/processed/index.pkl`), and serves a `/chat` endpoint.
3. Each user message → top-4 relevant chunks retrieved → assembled into a prompt → sent to Claude → answer + source citations returned to the frontend.

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Python | 3.10+ |
| Node.js | 18+ |
| npm | 9+ |

---

## Setup

### 1. Clone / enter the repo

```bash
cd syf-fin-ed-chatbot
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env and set your Anthropic API key:
# ANTHROPIC_API_KEY=sk-ant-...
```

> The `.env` file is read by the backend automatically via `python-dotenv`.

### 3. Add your documents

Drop `.md` or `.txt` files into `kb/sources/`. Two sample files are already included:

- `kb/sources/personal_finance_basics.md` – budgeting, emergency funds, compound interest, debt
- `kb/sources/credit_cards_guide.md` – credit scores, APR, rewards, secured cards

The index rebuilds automatically on next startup (or when `kb/processed/index.pkl` is deleted).

### 4. Start the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

Health check: <http://localhost:8000/health>

### 5. Start the frontend (new terminal)

```bash
cd frontend
npm install
npm run dev
```

Open: <http://localhost:3000>

---

## One-command dev start (bash / WSL / macOS / Linux)

```bash
bash scripts/dev.sh
```

This starts both servers in the background and kills them together on `Ctrl+C`.

---

## API reference

### `GET /health`
```json
{ "status": "ok" }
```

### `POST /chat`

**Request:**
```json
{
  "session_id": "optional-string",
  "message": "What is the 50/30/20 budget rule?"
}
```

**Response:**
```json
{
  "answer": "The 50/30/20 rule allocates...",
  "citations": [
    {
      "source": "personal_finance_basics.md",
      "chunk_id": 1,
      "snippet": "A budget is a plan that outlines expected income..."
    }
  ]
}
```

---

## Project structure

```
syf-fin-ed-chatbot/
├── .env.example
├── README.md
├── backend/
│   ├── requirements.txt
│   └── src/
│       ├── main.py        # FastAPI app, /health + /chat routes
│       ├── retrieval.py   # TF-IDF index build + retrieve()
│       ├── chat.py        # Prompt construction + Anthropic call
│       └── safety.py      # Input sanitization + system prompt
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx   # Chat UI
│       │   └── globals.css
│       └── lib/
│           └── api.ts     # fetch wrapper for /chat
├── kb/
│   ├── sources/           # ← Put your .md / .txt docs here
│   └── processed/         # Auto-generated index cache
└── scripts/
    └── dev.sh             # Starts both servers
```

---

## Rebuilding the index

Delete the cache and restart the backend:

```bash
rm kb/processed/index.pkl
# restart uvicorn
```

---

## Customizing

| What | Where |
|------|-------|
| Change LLM model | `ANTHROPIC_MODEL` in `.env` |
| Change top-k chunks | `retrieve(query, k=4)` call in `main.py` |
| Change system prompt | `safety.py` → `build_system_prompt()` |
| Add more sources | Drop files into `kb/sources/` and restart |
| Change chunk size | `CHUNK_SIZE` constant in `retrieval.py` |
