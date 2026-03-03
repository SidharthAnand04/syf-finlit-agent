"""
retrieval.py – TF-IDF based document retrieval from local kb/sources files.
"""

from __future__ import annotations

import os
import pickle
import re
from pathlib import Path
from typing import TypedDict

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Paths relative to this file: backend/src/ → ../../kb/
_BASE_DIR = Path(__file__).resolve().parents[2]
SOURCES_DIR = _BASE_DIR / "kb" / "sources"
PROCESSED_DIR = _BASE_DIR / "kb" / "processed"

# Vercel's filesystem is read-only except /tmp; fall back gracefully.
def _index_cache_path() -> Path:
    try:
        PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
        test = PROCESSED_DIR / ".write_test"
        test.touch()
        test.unlink()
        return PROCESSED_DIR / "index.pkl"
    except OSError:
        return Path("/tmp/syf_index.pkl")

INDEX_CACHE = _index_cache_path()

CHUNK_SIZE = 800  # char fallback when paragraphs are too large


class Chunk(TypedDict):
    source: str
    chunk_id: int
    text: str


# ──────────────────────────────────────────────
# Loading & chunking
# ──────────────────────────────────────────────

def load_docs() -> list[tuple[str, str]]:
    """Return list of (filename, content) for all .md / .txt files in SOURCES_DIR."""
    SOURCES_DIR.mkdir(parents=True, exist_ok=True)
    docs: list[tuple[str, str]] = []
    for path in sorted(SOURCES_DIR.iterdir()):
        if path.suffix in {".md", ".txt"} and path.is_file():
            docs.append((path.name, path.read_text(encoding="utf-8")))
    return docs


def _split_paragraphs(text: str) -> list[str]:
    """Split on blank lines; fall back to fixed-char slices if a block is huge."""
    raw_blocks = re.split(r"\n\s*\n", text)
    chunks: list[str] = []
    for block in raw_blocks:
        block = block.strip()
        if not block:
            continue
        if len(block) <= CHUNK_SIZE:
            chunks.append(block)
        else:
            # Slice into CHUNK_SIZE pieces without breaking mid-word
            start = 0
            while start < len(block):
                end = start + CHUNK_SIZE
                if end < len(block):
                    # Try to break at last whitespace
                    boundary = block.rfind(" ", start, end)
                    if boundary > start:
                        end = boundary
                chunks.append(block[start:end].strip())
                start = end
    return chunks


def chunk_docs(docs: list[tuple[str, str]]) -> list[Chunk]:
    """Convert (filename, content) pairs into a flat list of Chunk dicts."""
    all_chunks: list[Chunk] = []
    for filename, content in docs:
        paragraphs = _split_paragraphs(content)
        for idx, para in enumerate(paragraphs):
            all_chunks.append(
                {"source": filename, "chunk_id": idx, "text": para}
            )
    return all_chunks


# ──────────────────────────────────────────────
# Index
# ──────────────────────────────────────────────

def build_index(chunks: list[Chunk]) -> tuple[TfidfVectorizer, np.ndarray]:
    """Fit a TF-IDF vectorizer on chunk texts and return (vectorizer, matrix)."""
    texts = [c["text"] for c in chunks]
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1, sublinear_tf=True)
    matrix = vectorizer.fit_transform(texts)
    return vectorizer, matrix


def _save_index(vectorizer: TfidfVectorizer, matrix, chunks: list[Chunk]) -> None:
    INDEX_CACHE.parent.mkdir(parents=True, exist_ok=True)
    with open(INDEX_CACHE, "wb") as f:
        pickle.dump({"vectorizer": vectorizer, "matrix": matrix, "chunks": chunks}, f)


def _load_index() -> tuple[TfidfVectorizer, np.ndarray, list[Chunk]] | None:
    if not INDEX_CACHE.exists():
        return None
    with open(INDEX_CACHE, "rb") as f:
        data = pickle.load(f)
    return data["vectorizer"], data["matrix"], data["chunks"]


# ──────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────

_cache: tuple[TfidfVectorizer, np.ndarray, list[Chunk]] | None = None


def get_index(force_rebuild: bool = False) -> tuple[TfidfVectorizer, np.ndarray, list[Chunk]]:
    """Return (vectorizer, matrix, chunks), rebuilding from disk if needed."""
    global _cache
    if _cache is not None and not force_rebuild:
        return _cache

    if not force_rebuild:
        cached = _load_index()
        if cached is not None:
            _cache = cached
            return _cache

    docs = load_docs()
    if not docs:
        raise ValueError(
            f"No .md or .txt files found in {SOURCES_DIR}. "
            "Add documents before starting the server."
        )
    chunks = chunk_docs(docs)
    vectorizer, matrix = build_index(chunks)
    _save_index(vectorizer, matrix, chunks)
    _cache = (vectorizer, matrix, chunks)
    return _cache


def retrieve(query: str, k: int = 4) -> list[dict]:
    """
    Return the top-k most relevant chunks for *query*.

    Each result is a Chunk dict extended with 'score' (float) and 'snippet' (str).
    """
    vectorizer, matrix, chunks = get_index()
    q_vec = vectorizer.transform([query])
    scores = cosine_similarity(q_vec, matrix).flatten()
    top_indices = np.argsort(scores)[::-1][:k]

    results = []
    for idx in top_indices:
        if scores[idx] < 1e-6:
            continue  # skip irrelevant
        chunk = dict(chunks[idx])
        chunk["score"] = float(scores[idx])
        chunk["snippet"] = chunk["text"][:160].replace("\n", " ")
        results.append(chunk)
    return results
