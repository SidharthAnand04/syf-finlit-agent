"""
rag/indexing/store.py – Persist and load RAG index artifacts to/from disk.

Three artifacts are stored per build:
  chunks.pkl        – list[RichChunk]  (includes all metadata)
  bm25_index.pkl    – serialized BM25Okapi object
  dense_matrix.npy    numpy float32 embedding matrix

The directory is writable_index_dir() — PROCESSED_DIR when filesystem allows
it, or /tmp/syf_rag_index as a fallback (e.g. Vercel read-only fs).
"""
from __future__ import annotations

import pickle
from pathlib import Path

import numpy as np

from rag.config import writable_index_dir
from rag.schemas import RichChunk


def _save_paths() -> tuple[Path, Path, Path]:
    """Return artifact paths for *writing* (always the writable dir)."""
    d = writable_index_dir()
    return d / "chunks.pkl", d / "bm25_index.pkl", d / "dense_matrix.npy"


def save_index(
    chunks: list[RichChunk],
    bm25_index: object,
    dense_matrix: np.ndarray,
) -> None:
    chunks_path, bm25_path, dense_path = _save_paths()
    with open(chunks_path, "wb") as f:
        pickle.dump(chunks, f)
    with open(bm25_path, "wb") as f:
        pickle.dump(bm25_index, f)
    np.save(str(dense_path), dense_matrix)
    print(f"[OK] Index saved: {len(chunks)} chunks -> {chunks_path.parent}")


def _try_load_from(d: Path) -> tuple[list[RichChunk], object, np.ndarray] | None:
    cp, bp, dp = d / "chunks.pkl", d / "bm25_index.pkl", d / "dense_matrix.npy"
    if not (cp.exists() and bp.exists() and dp.exists()):
        return None
    with open(cp, "rb") as f:
        chunks: list[RichChunk] = pickle.load(f)
    with open(bp, "rb") as f:
        bm25_obj = pickle.load(f)
    dense_matrix: np.ndarray = np.load(str(dp))
    return chunks, bm25_obj, dense_matrix


def load_index() -> tuple[list[RichChunk], object, np.ndarray] | None:
    """
    Return (chunks, bm25_obj, dense_matrix), or None if no saved index exists.

    Search order:
    1. PROCESSED_DIR – the repo-bundled pre-built index (readable on Vercel
       even though the lambda FS is otherwise read-only).
    2. writable_index_dir() – /tmp on Vercel, PROCESSED_DIR locally.
       Populated by a previous rebuild during the same lambda warm period.
    """
    from rag.config import PROCESSED_DIR

    result = _try_load_from(PROCESSED_DIR)
    if result is not None:
        return result
    return _try_load_from(writable_index_dir())
