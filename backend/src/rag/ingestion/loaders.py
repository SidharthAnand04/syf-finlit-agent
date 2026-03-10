"""
rag/ingestion/loaders.py – Source file loaders for .md, .txt, .html, and .pdf.

Origin metadata is resolved in priority order:
  1. kb/url_sources.json entry for the filename (most reliable)
  2. Embedded "Source: <url>" header in the file (written by refresh_url_sources)
  3. PDF internal metadata / prettified filename fallback

The distinction between retrieval storage source and user-facing source is
maintained here: display_title and display_url carry the public-facing
information; file_path carries the internal artifact location.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Optional

from rag.config import SOURCES_DIR, URL_SOURCES_CONFIG
from rag.schemas import LoadedDocument, SourceMeta

# ──────────────────────────────────────────────
# URL sources config lookup
# ──────────────────────────────────────────────

def _load_url_sources_map() -> dict[str, dict]:
    """Build {filename → entry} from url_sources.json."""
    if not URL_SOURCES_CONFIG.exists():
        return {}
    try:
        entries = json.loads(URL_SOURCES_CONFIG.read_text(encoding="utf-8"))
        return {e["filename"]: e for e in entries if "filename" in e}
    except Exception:
        return {}


# ──────────────────────────────────────────────
# Header parsing helpers
# ──────────────────────────────────────────────

# Matches the header written by refresh_url_sources:
#   # Title\n\nSource: https://...\n\n
_MD_HEADER_RE = re.compile(
    r"^#\s+(.+?)\n\n(?:Source:\s+(https?://\S+))?",
    re.MULTILINE,
)


def _parse_md_header(text: str) -> tuple[Optional[str], Optional[str]]:
    """Extract (title, source_url) from the top of a markdown file."""
    m = _MD_HEADER_RE.match(text)
    if not m:
        return None, None
    title = m.group(1).strip() if m.group(1) else None
    url = m.group(2).strip() if m.group(2) else None
    return title, url


def _prettify_filename(stem: str) -> str:
    """'personal_finance_basics' → 'Personal Finance Basics'"""
    return stem.replace("_", " ").replace("-", " ").title()


# ──────────────────────────────────────────────
# Individual file loaders
# ──────────────────────────────────────────────

def _load_markdown(path: Path, url_map: dict[str, dict]) -> LoadedDocument:
    text = path.read_text(encoding="utf-8")
    title_from_file, url_from_file = _parse_md_header(text)

    entry = url_map.get(path.name, {})
    display_url = entry.get("url") or url_from_file
    display_title = (
        entry.get("display_title")
        or entry.get("name")
        or title_from_file
        or _prettify_filename(path.stem)
    )
    source_type = "website" if display_url else "markdown"

    meta = SourceMeta(
        source_name=path.name,
        source_type=source_type,
        display_title=display_title,
        file_path=str(path),
        display_url=display_url,
        canonical_url=entry.get("canonical_url") or display_url,
    )
    return LoadedDocument(text=text, source_meta=meta)


def _load_text(path: Path, url_map: dict[str, dict]) -> LoadedDocument:
    text = path.read_text(encoding="utf-8")

    entry = url_map.get(path.name, {})
    display_url = entry.get("url")
    display_title = (
        entry.get("display_title")
        or entry.get("name")
        or _prettify_filename(path.stem)
    )
    source_type = "website" if display_url else "txt"

    meta = SourceMeta(
        source_name=path.name,
        source_type=source_type,
        display_title=display_title,
        file_path=str(path),
        display_url=display_url,
        canonical_url=entry.get("canonical_url") or display_url,
    )
    return LoadedDocument(text=text, source_meta=meta)


def _load_html(path: Path, url_map: dict[str, dict]) -> LoadedDocument:
    raw = path.read_bytes()
    text: str = ""
    html_title: Optional[str] = None

    try:
        import trafilatura  # type: ignore
        text = trafilatura.extract(raw, include_tables=True, favor_recall=True) or ""
        meta_info = trafilatura.extract_metadata(raw)
        if meta_info:
            html_title = meta_info.title
    except ImportError:
        pass

    if not text:
        try:
            from bs4 import BeautifulSoup  # type: ignore
            soup = BeautifulSoup(raw, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
                tag.decompose()
            text = re.sub(r"\n{3,}", "\n\n", soup.get_text(separator="\n")).strip()
            title_tag = soup.find("title")
            if title_tag:
                html_title = title_tag.get_text(strip=True)
        except ImportError:
            text = raw.decode("utf-8", errors="replace")

    entry = url_map.get(path.name, {})
    display_url = entry.get("url")
    display_title = (
        entry.get("display_title")
        or entry.get("name")
        or html_title
        or _prettify_filename(path.stem)
    )

    meta = SourceMeta(
        source_name=path.name,
        source_type="website",
        display_title=display_title,
        file_path=str(path),
        display_url=display_url,
        canonical_url=entry.get("canonical_url") or display_url,
    )
    return LoadedDocument(text=text, source_meta=meta)


def _load_pdf(path: Path, url_map: dict[str, dict]) -> LoadedDocument:
    import io

    raw = path.read_bytes()
    try:
        from pypdf import PdfReader  # type: ignore
    except ImportError as exc:
        raise ImportError(
            "pypdf is required for PDF loading. pip install pypdf"
        ) from exc

    reader = PdfReader(io.BytesIO(raw))
    pages: list[tuple[int, str]] = []
    for i, page in enumerate(reader.pages, start=1):
        page_text = (page.extract_text() or "").strip()
        if page_text:
            pages.append((i, page_text))

    full_text = "\n\n".join(t for _, t in pages)
    if not full_text.strip():
        raise ValueError(f"PDF {path.name} contains no extractable text (may be scanned).")

    pdf_title: Optional[str] = None
    if reader.metadata:
        raw_title = reader.metadata.get("/Title", "") or ""
        pdf_title = raw_title.strip() or None

    entry = url_map.get(path.name, {})
    display_url = entry.get("url")
    display_title = (
        entry.get("display_title")
        or entry.get("name")
        or pdf_title
        or _prettify_filename(path.stem)
    )

    meta = SourceMeta(
        source_name=path.name,
        source_type="pdf",
        display_title=display_title,
        file_path=str(path),
        display_url=display_url,
        canonical_url=entry.get("canonical_url") or display_url,
    )
    return LoadedDocument(text=full_text, source_meta=meta, pages=pages)


# ──────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────

_SUPPORTED_EXTENSIONS = {".md", ".txt", ".html", ".htm", ".pdf"}


def load_sources(sources_dir: Path = SOURCES_DIR) -> list[LoadedDocument]:
    """
    Load all supported source files from *sources_dir*.

    Returns a list of LoadedDocument objects with origin metadata resolved.
    Files that fail to load are skipped with a warning.
    """
    sources_dir.mkdir(parents=True, exist_ok=True)
    url_map = _load_url_sources_map()
    docs: list[LoadedDocument] = []

    for path in sorted(sources_dir.iterdir()):
        if not path.is_file() or path.suffix.lower() not in _SUPPORTED_EXTENSIONS:
            continue
        try:
            ext = path.suffix.lower()
            if ext == ".md":
                doc = _load_markdown(path, url_map)
            elif ext == ".txt":
                doc = _load_text(path, url_map)
            elif ext in {".html", ".htm"}:
                doc = _load_html(path, url_map)
            elif ext == ".pdf":
                doc = _load_pdf(path, url_map)
            else:
                continue

            if doc.text.strip():
                docs.append(doc)
            else:
                print(f"⚠  Skipping {path.name}: no extractable text.")
        except Exception as exc:  # noqa: BLE001
            print(f"⚠  Could not load {path.name}: {exc}")

    return docs
