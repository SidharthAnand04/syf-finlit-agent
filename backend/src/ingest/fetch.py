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

    # Fallback: naive BeautifulSoup strip if trafilatura extracted very little
    if _HAS_BS4 and (not text or len(text) < 2000):
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header",
                         "aside", "form", "noscript"]):
            tag.decompose()
        raw = soup.get_text(separator="\n")
        bs4_text = re.sub(r"\n{3,}", "\n\n", raw).strip()
        
        if len(bs4_text) > len(text):
            text = bs4_text
            
        title_tag = soup.find("title")
        if title_tag and not title:
            title = title_tag.get_text(strip=True)

    # Scrape FAQs from faqTabDetails or faqDetails if present (dynamic content missing from DOM)
    try:
        html_str = html.decode("utf-8", errors="ignore")
        match = re.search(r"var\s+faqTabDetails\s*=\s*(\[[^\n]+\]);", html_str)
        if match:
            import json
            faq_data = json.loads(match.group(1))
            faq_text_blocks = []
            for tab_obj in faq_data:
                for tab_id, sections in tab_obj.items():
                    for section in sections:
                        if "sectionName" in section:
                            faq_text_blocks.append(f"\n## {section['sectionName']}\n")
                        for q in section.get("questions", []):
                            prompt = q.get("prompt", "").strip()
                            answer = BeautifulSoup(q.get("answer", ""), "html.parser").get_text(separator="\n").strip()
                            faq_text_blocks.append(f"Q: {prompt}\nA: {answer}\n")
            if faq_text_blocks:
                text += "\n" + "\n".join(faq_text_blocks)
    except Exception as e:
        print(f"Failed to parse FAQs: {e}")

    if not text:
        raise ValueError(f"Could not extract text from {url or 'provided HTML'}")

    return text, title
