"""
rag/embedder.py – Single, guarded import of the sentence-transformers model.

Loads the model ONCE eagerly so that the torch._dynamo import chain (which
triggers inspect.getframeinfo / ntpath.realpath on Windows) happens at startup
rather than at query time, and is wrapped in a try/except so the app can fall
back to BM25-only retrieval if the model fails to load (e.g. Python 3.13 +
Windows OneDrive realpath issue with PyTorch <= 2.10).

Usage:
    from rag.embedder import embed_texts, embed_query, is_available
"""
from __future__ import annotations

import logging
import os
import sys

# Prevent tokenizers from spawning child processes (safe for serverless)
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
# Suppress "unauthenticated requests" and hub verbosity warnings
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
os.environ.setdefault("HUGGINGFACE_HUB_VERBOSITY", "error")
# Suppress sentence-transformers / transformers key-mismatch noise
logging.getLogger("sentence_transformers").setLevel(logging.ERROR)
logging.getLogger("transformers").setLevel(logging.ERROR)

_model = None
_available = False
_load_error: str | None = None


def _try_load() -> None:
    global _model, _available, _load_error
    model_name = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore
        print(f"Loading embedding model: {model_name}...")
        try:
            # Use cached copy first — avoids hub network round-trip
            _model = SentenceTransformer(model_name, local_files_only=True)
        except Exception:
            # Not cached yet; download from HF Hub
            _model = SentenceTransformer(model_name)
        _available = True
        print(f"[OK] Embedding model loaded (dims={_model.get_sentence_embedding_dimension()}).")
    except Exception as exc:
        _load_error = str(exc)
        print(
            f"[WARN] Could not load embedding model '{model_name}': {exc}\n"
            "       Dense retrieval is disabled; falling back to BM25-only."
        )


# On Vercel (serverless), sentence-transformers + torch exceed the lambda
# size budget. The VERCEL env var is automatically set to "1" by Vercel's
# runtime. Fall back to BM25-only retrieval in that environment.
if os.environ.get("VERCEL") == "1":
    _load_error = "Dense retrieval disabled on Vercel (lambda size constraints)"
    print("[INFO] Vercel environment detected — using BM25-only retrieval.")
else:
    # Attempt to load on module import so startup is the only time it can hang
    _try_load()


def is_available() -> bool:
    return _available


def embed_texts(texts: list[str], batch_size: int = 32) -> list[list[float]]:
    if not _available or _model is None:
        raise RuntimeError(
            f"Embedding model is not available: {_load_error or 'unknown error'}"
        )
    embeddings = _model.encode(
        texts,
        batch_size=batch_size,
        show_progress_bar=False,
        convert_to_numpy=True,
    )
    return [emb.tolist() for emb in embeddings]


def embed_query(text: str) -> list[float] | None:
    """Embed a single query string. Returns None if the model is unavailable."""
    if not _available:
        return None
    return embed_texts([text])[0]
