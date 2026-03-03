#!/usr/bin/env bash
# scripts/dev.sh – Start both backend and frontend for local development.
# Usage: bash scripts/dev.sh   (run from repo root)

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "============================================"
echo "  SYF FinLit Chatbot – Dev Server Launcher"
echo "============================================"
echo ""
echo "Starting backend  → http://localhost:8000"
echo "Starting frontend → http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both processes."
echo ""

# Backend
(
  cd "$ROOT/backend"
  if [ ! -d ".venv" ]; then
    echo "[backend] Creating virtual environment..."
    python -m venv .venv
  fi
  source .venv/bin/activate 2>/dev/null || source .venv/Scripts/activate
  pip install -q -r requirements.txt
  uvicorn src.main:app --reload --port 8000
) &
BACKEND_PID=$!

# Give the backend a moment to start
sleep 2

# Frontend
(
  cd "$ROOT/frontend"
  npm install --silent
  npm run dev
) &
FRONTEND_PID=$!

# Wait for both; kill both on Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait $BACKEND_PID $FRONTEND_PID
