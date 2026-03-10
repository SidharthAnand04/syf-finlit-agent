"""
rag/retrieval/hybrid.py – Hybrid BM25 + dense retrieval with RRF reranking.

Retrieval flow:
  1. Embed the query (rag.embedder)    → query vector (or None if unavailable)
  2. BM25 search                       → top lexical_top_k candidates
  3. Dense cosine search (if avail.)   → top dense_top_k candidates
  4. RRF fusion                        → unified ranking
  5. Return final_top_k                → chunks passed to the LLM

If the dense embedding model is unavailable (e.g. torch/Python compatibility
issue), the function falls back gracefully to BM25-only retrieval.

Reciprocal Rank Fusion (RRF):
  rrf_score(d) = sum_i  1 / (k + rank_i(d))
  k=60 is the standard constant. RRF is parameter-free, training-free, and
  consistently outperforms linear score combination in hybrid retrieval.
"""
from __future__ import annotations

import copy

import numpy as np

from rag.config import RAGConfig
from rag.indexing.dense import DenseIndex
from rag.indexing.lexical import LexicalIndex
from rag.schemas import RichChunk


def _rrf_rerank(
    lexical_ranked: list[tuple[int, float]],
    dense_ranked: list[tuple[int, float]],
    k: int = 60,
) -> list[tuple[int, float]]:
    """
    Merge two ranked lists with Reciprocal Rank Fusion.
    Returns a new list of (chunk_index, rrf_score) sorted descending.
    """
    scores: dict[int, float] = {}
    for rank, (idx, _) in enumerate(lexical_ranked):
        scores[idx] = scores.get(idx, 0.0) + 1.0 / (k + rank + 1)
    for rank, (idx, _) in enumerate(dense_ranked):
        scores[idx] = scores.get(idx, 0.0) + 1.0 / (k + rank + 1)
    return sorted(scores.items(), key=lambda x: x[1], reverse=True)


def retrieve(
    query: str,
    chunks: list[RichChunk],
    lexical_index: LexicalIndex,
    dense_index: DenseIndex,
    config: RAGConfig,
) -> list[RichChunk]:
    """
    Hybrid retrieval: BM25 + dense cosine → RRF rerank → top-k chunks.

    If the embedding model is unavailable, falls back to BM25-only ranking.
    Each returned RichChunk has its .score set to the RRF (or BM25) score.
    """
    lexical_results = lexical_index.search(query, top_k=config.lexical_top_k)

    # Embed query once; dense search requires a pre-computed vector
    dense_results: list[tuple[int, float]] = []
    try:
        from rag.embedder import embed_query, is_available
        if is_available():
            q_vec_raw = embed_query(query)
            if q_vec_raw is not None:
                q_vec = np.array(q_vec_raw, dtype=np.float32)
                dense_results = dense_index.search(q_vec, top_k=config.dense_top_k)
    except Exception:
        # Dense unavailable — BM25-only fallback
        pass

    if config.reranker_enabled and dense_results:
        merged = _rrf_rerank(lexical_results, dense_results, k=config.rrf_k)
    else:
        # BM25-only: convert to (idx, score) tuples with deduplication
        seen: set[int] = set()
        merged = []
        for idx, score in lexical_results:
            if idx not in seen:
                seen.add(idx)
                merged.append((idx, score))

    result: list[RichChunk] = []
    for idx, rrf_score in merged[: config.final_top_k]:
        if 0 <= idx < len(chunks):
            chunk = copy.copy(chunks[idx])
            chunk.score = rrf_score
            result.append(chunk)

    return result
