"""
rag/indexing/lexical.py – BM25 lexical index backed by rank-bm25.

BM25 (Best Match 25) is a probabilistic ranking function that significantly
outperforms TF-IDF for information retrieval, especially for:
  - Exact financial terminology: APR, FICO, revolving credit, cash back
  - Specific product names and numeric values
  - Short precise queries that appear verbatim in the corpus

The tokenizer preserves %, $, and . to handle financial terms like "24.99%",
"$500 limit", "0% APR" without splitting them into noise tokens.
"""
from __future__ import annotations

import re

from rag.schemas import RichChunk

try:
    from rank_bm25 import BM25Okapi  # type: ignore
    _HAS_BM25 = True
except ImportError:
    _HAS_BM25 = False

# Tokenize: keep alphanumeric plus % $ . for financial terms
_TOKEN_RE = re.compile(r"[\w$%.]+")


def _tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


class LexicalIndex:
    """BM25 index over a fixed list of RichChunk objects."""

    def __init__(self, chunks: list[RichChunk]) -> None:
        if not _HAS_BM25:
            raise ImportError(
                "rank-bm25 is required for lexical retrieval. "
                "Install with: pip install rank-bm25"
            )
        self._chunks = chunks
        tokenized = [_tokenize(c.text) for c in chunks]
        self._bm25 = BM25Okapi(tokenized)

    @classmethod
    def from_saved(cls, chunks: list[RichChunk], bm25_obj: "BM25Okapi") -> "LexicalIndex":
        """Reconstruct from a deserialized BM25 object (avoids re-fitting)."""
        inst = cls.__new__(cls)
        inst._chunks = chunks
        inst._bm25 = bm25_obj
        return inst

    def search(self, query: str, top_k: int = 10) -> list[tuple[int, float]]:
        """
        Return top-k (chunk_index, bm25_score) pairs sorted descending.
        Only includes chunks with score > 0.
        """
        tokens = _tokenize(query)
        scores = self._bm25.get_scores(tokens)
        ranked = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)
        return [(int(idx), float(score)) for idx, score in ranked[:top_k] if score > 0]
