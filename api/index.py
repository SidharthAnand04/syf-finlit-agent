"""
api/index.py – Vercel serverless entry point for the FastAPI backend.
Adds backend/src to sys.path so all existing imports work unchanged.
"""

import sys
from pathlib import Path

# /var/task/backend/src  (Vercel sets cwd to project root)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend" / "src"))

from main import app  # noqa: E402  (import after path fix)
