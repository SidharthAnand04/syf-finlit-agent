"""
ingest/pdf.py – Extract plain text from PDF bytes.

Uses pypdf (formerly PyPDF2) – pure-Python, no system dependencies, works
in serverless.  For complex PDFs (scanned images) optical recognition is
out of scope for this MVP.
"""

from __future__ import annotations

import io
from typing import Optional


def parse_pdf(file_bytes: bytes) -> tuple[str, Optional[str]]:
    """
    Extract text from PDF bytes.

    Returns:
        (text, title) where title may be None.

    Raises:
        ImportError  if pypdf is not installed.
        ValueError   if no text could be extracted.
    """
    try:
        from pypdf import PdfReader  # type: ignore
    except ImportError as exc:
        raise ImportError(
            "pypdf is required for PDF ingestion. "
            "Add it to requirements.txt and reinstall."
        ) from exc

    reader = PdfReader(io.BytesIO(file_bytes))
    pages: list[str] = []
    for page in reader.pages:
        page_text = page.extract_text() or ""
        if page_text.strip():
            pages.append(page_text)

    text = "\n\n".join(pages).strip()
    if not text:
        raise ValueError("PDF contains no extractable text (may be scanned).")

    # Try to get title from metadata
    title: Optional[str] = None
    if reader.metadata:
        title = reader.metadata.get("/Title") or None
        if title:
            title = title.strip() or None

    return text, title
