"""
ingest/chunker.py – Split text into overlapping chunks.

Strategy (in order of preference):
  1. Heading-aware: split on Markdown/plain headings, then subdivide large
     sections at paragraph boundaries.
  2. Fixed-size with overlap: fallback when no structure is detected.

Target: ~400 tokens per chunk (≈ 1 600 chars at ~4 chars/token) with a
200-char overlap on fixed-size mode.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

CHUNK_TARGET_CHARS = 1_600
CHUNK_OVERLAP_CHARS = 200
MIN_CHUNK_CHARS = 80


@dataclass
class TextChunk:
    chunk_index: int
    text: str

    @property
    def token_count(self) -> int:
        """Rough estimate: 1 token ≈ 4 chars (good enough for bookkeeping)."""
        return max(1, len(self.text) // 4)


# ──────────────────────────────────────────────
# Heading detection
# ──────────────────────────────────────────────

_HEADING_RE = re.compile(
    r"^#{1,4}\s+.+|^[A-Z][^\n]{0,80}\n[-=]{3,}",
    re.MULTILINE,
)


def _split_by_headings(text: str) -> list[str]:
    """Split text into sections at Markdown headings.  Returns raw section strings."""
    positions = [m.start() for m in _HEADING_RE.finditer(text)]
    if not positions:
        return []
    sections: list[str] = []
    for i, pos in enumerate(positions):
        end = positions[i + 1] if i + 1 < len(positions) else len(text)
        sections.append(text[pos:end].strip())
    # Include any preamble before the first heading
    if positions[0] > 0:
        preamble = text[: positions[0]].strip()
        if preamble:
            sections.insert(0, preamble)
    return [s for s in sections if s]


# ──────────────────────────────────────────────
# Subdivision helpers
# ──────────────────────────────────────────────

def _split_paragraphs(text: str) -> list[str]:
    return [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]


def _fixed_chunks(text: str, size: int = CHUNK_TARGET_CHARS,
                  overlap: int = CHUNK_OVERLAP_CHARS) -> list[str]:
    """Slide a window of `size` chars over `text` with `overlap` chars of step-back."""
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + size
        slice_ = text[start:end]
        # Try to break at a word boundary
        if end < len(text):
            boundary = slice_.rfind(" ")
            if boundary > size // 2:
                slice_ = slice_[:boundary]
                end = start + boundary
        chunks.append(slice_.strip())
        start = end - overlap if end - overlap > start else end
    return [c for c in chunks if len(c) >= MIN_CHUNK_CHARS]


def _subdivide_section(section: str) -> list[str]:
    """Break a large section into sub-chunks at paragraph boundaries."""
    if len(section) <= CHUNK_TARGET_CHARS:
        return [section] if len(section) >= MIN_CHUNK_CHARS else []

    paragraphs = _split_paragraphs(section)
    output: list[str] = []
    current = ""
    for para in paragraphs:
        if not current:
            current = para
        elif len(current) + len(para) + 2 <= CHUNK_TARGET_CHARS:
            current += "\n\n" + para
        else:
            if len(current) >= MIN_CHUNK_CHARS:
                output.append(current)
            # If single paragraph is larger than target, use fixed sliding
            if len(para) > CHUNK_TARGET_CHARS:
                output.extend(_fixed_chunks(para))
                current = ""
            else:
                current = para
    if current and len(current) >= MIN_CHUNK_CHARS:
        output.append(current)
    return output


# ──────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────

def chunk_text(text: str) -> list[TextChunk]:
    """
    Split *text* into a list of TextChunk objects ready for embedding.

    Tries heading-aware splitting first; falls back to fixed-size windowing.
    """
    sections = _split_by_headings(text)

    raw_chunks: list[str]
    if sections:
        raw_chunks = []
        for section in sections:
            raw_chunks.extend(_subdivide_section(section))
    else:
        # No headings found – fall back to fixed-size
        raw_chunks = _fixed_chunks(text)

    # Deduplicate and assign sequential indices
    seen: set[str] = set()
    result: list[TextChunk] = []
    for i, chunk in enumerate(raw_chunks):
        if chunk not in seen:
            seen.add(chunk)
            result.append(TextChunk(chunk_index=len(result), text=chunk))

    return result
