"""
rag/indexing/dense.py – Dense embedding index using sentence-transformers.

Embeddings are stored as a numpy float32 matrix. Query-time similarity is
computed with vectorized cosine similarity — suitable for corpora up to
~50k chunks on CPU before FAISS would be needed.

IMPORTANT: DenseIndex.search() accepts a pre-computed numpy query vector
rather than a raw string. The caller is responsible for embedding the query
via rag.embedder.embed_query(). This design keeps the heavy sentence-
transformers import out of the query hot-path and allows the app to fall back
to BM25-only retrieval gracefully if the model fails to load.
"""
from __future__ import annotations

import numpy as np

from rag.schemas import RichChunk


def _cosine_similarity(query_vec: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    """
    Compute cosine similarity between a 1-D query vector and a 2-D matrix.
    Returns a 1-D array of scores with shape (n_chunks,).
    """
    q_norm = float(np.linalg.norm(query_vec))
    if q_norm == 0.0:
        return np.zeros(len(matrix), dtype=np.float32)
    m_norms = np.linalg.norm(matrix, axis=1).astype(np.float32)
    m_norms[m_norms == 0] = 1e-10
    return (matrix @ query_vec) / (m_norms * q_norm)


class DenseIndex:
    """Flat cosine-similarity index over chunk embeddings."""

    def __init__(self, chunks: list[RichChunk], matrix: np.ndarray) -> None:
        self._chunks = chunks
        self._matrix = matrix.astype(np.float32)  # (n_chunks, embedding_dim)

    @classmethod
    def build(cls, chunks: list[RichChunk]) -> "DenseIndex":
        """Embed all chunks and build the dense index."""
        from rag.embedder import embed_texts  # rag-level embedder with guards
        texts = [c.text for c in chunks]
        print(f"  Embedding {len(texts)} chunks...")
        vectors = embed_texts(texts)
        matrix = np.array(vectors, dtype=np.float32)
        print(f"  Dense index built: {matrix.shape}")
        return cls(chunks, matrix)

    def search(self, query_vec: np.ndarray, top_k: int = 10) -> list[tuple[int, float]]:
        """
        Return top-k (chunk_index, cosine_score) pairs sorted descending.

        Args:
            query_vec: Pre-computed embedding vector for the query (float32).
            top_k: Number of results to return.
        """
        scores = _cosine_similarity(query_vec.astype(np.float32), self._matrix)
        top_indices = np.argsort(scores)[::-1][:top_k]
        return [
            (int(idx), float(scores[idx]))
            for idx in top_indices
            if scores[idx] > 1e-6
        ]

    @property
    def matrix(self) -> np.ndarray:
        return self._matrix
