"""
rag/schemas.py – Core data contracts for the hybrid RAG pipeline.

Three main types:
  SourceMeta    – origin metadata for a document, preserved through chunking
  LoadedDocument – raw output from a file loader, before chunking
  RichChunk     – a single retrieval unit with full provenance metadata
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SourceMeta:
    """
    Origin metadata for a document or chunk.

    Display fields (display_title, display_url) are what gets shown to users.
    Internal fields (source_name, file_path) are used for retrieval storage only.
    """
    source_name: str               # internal identifier (typically the filename)
    source_type: str               # "website" | "pdf" | "markdown" | "txt"
    display_title: str             # human-readable title for UI display
    file_path: str                 # path to the local artifact (internal use)
    display_url: Optional[str] = None      # original public URL for UI links
    canonical_url: Optional[str] = None   # canonical URL if different from display_url
    last_updated: Optional[str] = None


@dataclass
class LoadedDocument:
    """
    Output of a source file loader, prior to chunking.

    `pages` is populated only for PDFs: list of (1-based-page-number, page_text).
    For all other types, chunking operates on `text` directly.
    """
    text: str
    source_meta: SourceMeta
    pages: list[tuple[int, str]] = field(default_factory=list)


@dataclass
class RichChunk:
    """
    A single retrieval chunk with full provenance metadata.

    chunk_id is a stable string key: "<source_stem>_<index>".
    score is set by the retriever and is not meaningful until after retrieval.
    """
    chunk_id: str
    chunk_index: int
    text: str
    source: SourceMeta
    section_heading: Optional[str] = None
    page_number: Optional[int] = None
    token_count: int = 0
    score: float = 0.0
    snippet: str = ""

    def __post_init__(self) -> None:
        if not self.snippet:
            self.snippet = self.text[:160].replace("\n", " ")
        if not self.token_count:
            self.token_count = max(1, len(self.text) // 4)

    def to_citation_dict(self) -> dict:
        """Return a dict suitable for the API Citation response."""
        return {
            # Backward-compatible keys
            "source": self.source.display_title,
            "chunk_id": self.chunk_index,
            "snippet": self.snippet,
            # Rich metadata for UI display
            "display_title": self.source.display_title,
            "display_url": self.source.display_url,
            "source_type": self.source.source_type,
            "section_heading": self.section_heading,
            "page_number": self.page_number,
        }
