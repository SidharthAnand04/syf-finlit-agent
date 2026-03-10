"""
rag/chunking/chunker.py – Structure-aware chunking producing RichChunk objects.

Strategy (dispatched by source type):
  PDF    → page-aware: each page chunked independently, page_number preserved
  Other  → heading-aware: split at Markdown headings, track section context;
            fall back to fixed-size sliding window when no headings detected

In all cases, section_heading is carried into the chunk metadata so citations
can display "§ Section Name" alongside the source title.
"""
from __future__ import annotations

import re
from typing import Optional

from rag.config import RAGConfig
from rag.schemas import LoadedDocument, RichChunk, SourceMeta

# Matches ATX headings (# through ####) only — deep nesting is more noise than signal
_HEADING_RE = re.compile(r"^(#{1,4})\s+(.+)", re.MULTILINE)


# ──────────────────────────────────────────────
# Text subdivision helpers
# ──────────────────────────────────────────────

def _split_paragraphs(text: str) -> list[str]:
    return [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]


def _fixed_chunks(text: str, config: RAGConfig) -> list[str]:
    """Sliding window with overlap. Last-resort fallback when no structure exists."""
    result: list[str] = []
    start = 0
    size = config.chunk_size
    overlap = config.chunk_overlap
    while start < len(text):
        end = start + size
        slice_ = text[start:end]
        if end < len(text):
            boundary = slice_.rfind(" ")
            if boundary > size // 2:
                slice_ = slice_[:boundary]
                end = start + boundary
        stripped = slice_.strip()
        if len(stripped) >= config.min_chunk_chars:
            result.append(stripped)
        start = max(start + 1, end - overlap)
    return result


def _subdivide(text: str, config: RAGConfig) -> list[str]:
    """
    Break *text* into sub-chunks that fit within chunk_size.
    Groups paragraphs greedily; falls back to fixed_chunks for oversized paragraphs.
    """
    if len(text) <= config.chunk_size:
        return [text] if len(text) >= config.min_chunk_chars else []

    paragraphs = _split_paragraphs(text)
    result: list[str] = []
    current = ""
    for para in paragraphs:
        if not current:
            current = para
        elif len(current) + len(para) + 2 <= config.chunk_size:
            current += "\n\n" + para
        else:
            if len(current) >= config.min_chunk_chars:
                result.append(current)
            if len(para) > config.chunk_size:
                result.extend(_fixed_chunks(para, config))
                current = ""
            else:
                current = para
    if current and len(current) >= config.min_chunk_chars:
        result.append(current)
    return result


# ──────────────────────────────────────────────
# Heading-aware chunking (markdown / website / txt)
# ──────────────────────────────────────────────

def _split_by_headings(text: str) -> list[tuple[Optional[str], str]]:
    """
    Split *text* into [(heading_or_None, section_text)] pairs.
    Each section runs from a heading to the next or EOF.
    The heading line is included in the section text so it survives chunking.
    """
    matches = list(_HEADING_RE.finditer(text))
    if not matches:
        return [(None, text)]

    sections: list[tuple[Optional[str], str]] = []

    # Preamble before the first heading
    if matches[0].start() > 0:
        preamble = text[: matches[0].start()].strip()
        if preamble:
            sections.append((None, preamble))

    for i, m in enumerate(matches):
        heading_text = m.group(2).strip()
        body_start = m.end()
        body_end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[body_start:body_end].strip()
        # Keep heading line in body so the chunk is self-contained
        full_section = f"{m.group(0)}\n\n{body}".strip() if body else m.group(0).strip()
        sections.append((heading_text, full_section))

    return sections


def _chunk_with_headings(
    text: str,
    meta: SourceMeta,
    config: RAGConfig,
    stem: str,
    start_index: int = 0,
) -> list[RichChunk]:
    """Heading-aware chunking. Falls back to fixed-size if no headings found."""
    sections = _split_by_headings(text)
    chunks: list[RichChunk] = []

    for heading, section_text in sections:
        subs = _subdivide(section_text, config)
        if not subs:
            subs = _fixed_chunks(section_text, config)
        for sub in subs:
            idx = start_index + len(chunks)
            chunks.append(
                RichChunk(
                    chunk_id=f"{stem}_{idx}",
                    chunk_index=idx,
                    text=sub,
                    source=meta,
                    section_heading=heading,
                )
            )

    return chunks


# ──────────────────────────────────────────────
# Page-aware chunking (PDF)
# ──────────────────────────────────────────────

def _chunk_pages(
    pages: list[tuple[int, str]],
    meta: SourceMeta,
    config: RAGConfig,
    stem: str,
) -> list[RichChunk]:
    """
    Page-aware chunking for PDFs.
    Each page is chunked independently so page_number metadata is exact.
    Heading detection is also applied within each page.
    """
    chunks: list[RichChunk] = []
    for page_num, page_text in pages:
        page_chunks = _chunk_with_headings(
            page_text, meta, config, stem, start_index=len(chunks)
        )
        for c in page_chunks:
            c.page_number = page_num
        chunks.extend(page_chunks)
    return chunks


# ──────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────

def chunk_document(doc: LoadedDocument, config: RAGConfig) -> list[RichChunk]:
    """
    Dispatch to the appropriate chunking strategy based on source type.
    Returns a flat list of RichChunk objects with full metadata.
    """
    meta = doc.source_meta
    stem = meta.source_name.rsplit(".", 1)[0]  # filename without extension

    if doc.pages:
        # PDF with per-page text — use page-aware strategy
        return _chunk_pages(doc.pages, meta, config, stem)
    else:
        # Markdown, txt, or HTML — use heading-aware strategy
        return _chunk_with_headings(doc.text, meta, config, stem)
