"""
ingest/embedder.py – Generate embeddings using local sentence-transformers models.

No API keys required. Models are downloaded from Hugging Face on first use and
cached locally (~100-200 MB depending on model size).

Options:
  all-MiniLM-L6-v2   (384 dims)  – small, fast, good quality [DEFAULT]
  all-mpnet-base-v2  (768 dims)  – larger, slower, better quality
  all-distilroberta-v1 (768 dims) – distilled, balanced

Set EMBEDDING_MODEL env var to override (e.g. all-mpnet-base-v2).
"""

from __future__ import annotations

import os
from typing import Optional

try:
    from sentence_transformers import SentenceTransformer  # type: ignore
    _HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    _HAS_SENTENCE_TRANSFORMERS = False

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

# Embedding dimensions by model
_MODEL_DIMS = {
    "all-MiniLM-L6-v2": 384,
    "all-mpnet-base-v2": 768,
    "all-distilroberta-v1": 768,
    "paraphrase-MiniLM-L6-v2": 384,
}

EMBEDDING_DIMS = _MODEL_DIMS.get(EMBEDDING_MODEL, 384)

_model: Optional[SentenceTransformer] = None


def _get_model() -> SentenceTransformer:
    """Load sentence-transformer model (downloads on first use)."""
    global _model
    if _model is None:
        if not _HAS_SENTENCE_TRANSFORMERS:
            raise ImportError(
                "sentence-transformers is required for local embeddings. "
                "Install with: pip install sentence-transformers"
            )
        print(f"Loading embedding model: {EMBEDDING_MODEL}...")
        _model = SentenceTransformer(EMBEDDING_MODEL)
        print(f"✓ Model loaded. Output dims: {EMBEDDING_DIMS}")
    return _model


def embed_texts(texts: list[str], batch_size: int = 32) -> list[list[float]]:
    """
    Embed a list of strings locally using sentence-transformers.

    Returns a list of float vectors (deterministic, same inputs → same outputs).
    """
    if not texts:
        return []

    model = _get_model()
    # model.encode() returns numpy array; convert to list of lists
    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        show_progress_bar=False,
        convert_to_numpy=True,
    )
    return [emb.tolist() for emb in embeddings]


def embed_query(text: str) -> list[float]:
    """Embed a single query string."""
    return embed_texts([text])[0]

