"""
ingest/fetch.py – Fetch a URL and extract clean main-body text.

Uses `trafilatura` for extraction, which handles most news/article/doc pages
and runs without a browser.  Falls back to a basic BeautifulSoup strip if
trafilatura returns nothing useful.
"""

from __future__ import annotations

import re
from typing import Optional

import httpx

try:
    import trafilatura  # type: ignore
    _HAS_TRAFILATURA = True
except ImportError:
    _HAS_TRAFILATURA = False

try:
    from bs4 import BeautifulSoup  # type: ignore
    _HAS_BS4 = True
except ImportError:
    _HAS_BS4 = False

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; SYFFinLitBot/1.0; "
        "+https://github.com/syf-finlit-agent)"
    )
}
_TIMEOUT = 20.0  # seconds


async def fetch_url(url: str) -> bytes:
    """Download the raw bytes of a URL (async)."""
    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=_TIMEOUT,
        headers=_HEADERS,
    ) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.content


def extract_main_text(html: bytes, url: str = "") -> tuple[str, Optional[str]]:
    """
    Extract main textual content from HTML bytes.

    Returns:
        (text, title) where title may be None.
    """
    text: str = ""
    title: Optional[str] = None

    if _HAS_TRAFILATURA:
        result = trafilatura.extract(
            html,
            url=url or None,
            include_comments=False,
            include_tables=True,
            no_fallback=False,
            favor_recall=True,
        )
        if result:
            text = result
            # Grab title separately
            meta = trafilatura.extract_metadata(html, default_url=url or None)
            if meta:
                title = meta.title

    # Fallback: naive BeautifulSoup strip
    if not text and _HAS_BS4:
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header",
                         "aside", "form", "noscript"]):
            tag.decompose()
        raw = soup.get_text(separator="\n")
        text = re.sub(r"\n{3,}", "\n\n", raw).strip()
        title_tag = soup.find("title")
        if title_tag:
            title = title_tag.get_text(strip=True)

    if not text:
        raise ValueError(f"Could not extract text from {url or 'provided HTML'}")

    return text, title
