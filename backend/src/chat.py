"""
chat.py – Anthropic API integration with RAG prompt construction.
"""

from __future__ import annotations

import os
import re

import anthropic

from safety import build_system_prompt, MAX_CONTEXT_CHARS

MAX_WORDS = 150


def _strip_markdown(text: str) -> str:
    """Remove common markdown constructs so plain text reaches the user."""
    # ATX headers: ## Heading → Heading
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    # Bold / italic: **x**, __x__, *x*, _x_
    text = re.sub(r"\*{1,2}([^*]+?)\*{1,2}", r"\1", text)
    text = re.sub(r"_{1,2}([^_]+?)_{1,2}", r"\1", text)
    # Inline code: `x`
    text = re.sub(r"`([^`]+?)`", r"\1", text)
    # Fenced code blocks
    text = re.sub(r"```[\s\S]*?```", "", text)
    # Unordered list markers at line start: - item / * item
    text = re.sub(r"^[\-\*]\s+", "", text, flags=re.MULTILINE)
    # Horizontal rules
    text = re.sub(r"^[-*_]{3,}\s*$", "", text, flags=re.MULTILINE)
    # Collapse excess blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _enforce_word_limit(text: str, limit: int = MAX_WORDS) -> str:
    """Hard-truncate to *limit* words, appending ellipsis if cut."""
    words = text.split()
    if len(words) <= limit:
        return text
    return " ".join(words[:limit]) + "..."

_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise EnvironmentError(
                "ANTHROPIC_API_KEY is not set. "
                "Add it to your .env file or export it in your shell."
            )
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


def _get_model() -> str:
    return os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5")


# ──────────────────────────────────────────────
# Prompt construction
# ──────────────────────────────────────────────

def build_prompt(user_message: str, retrieved_chunks: list[dict]) -> str:
    """Build the user-turn message that includes retrieved context."""
    if retrieved_chunks:
        context_parts = []
        for chunk in retrieved_chunks:
            # Build a rich source attribution line for the LLM
            title = chunk.get("display_title") or chunk.get("source", "unknown")
            url = chunk.get("display_url")
            heading = chunk.get("section_heading")
            page = chunk.get("page_number")

            source_ref = title
            if url:
                source_ref += f" ({url})"
            if heading:
                source_ref += f" § {heading}"
            if page:
                source_ref += f" (p.{page})"

            header = f"[Source: {source_ref}]"
            context_parts.append(f"{header}\n{chunk['text']}")

        context_block = "\n\n---\n\n".join(context_parts)
        context_block = context_block[:MAX_CONTEXT_CHARS]
        prompt = (
            f"Context:\n{context_block}\n\n"
            f"---\n\n"
            f"Question: {user_message}\n\n"
            f"Answer in plain text only (no markdown). Stay under 150 words. "
            f"When you use context, cite the source by its title naturally inline "
            f"(e.g., 'According to Synchrony Credit Cards...')."
        )
    else:
        prompt = (
            f"Question: {user_message}\n\n"
            f"No relevant context was found in the knowledge base. "
            f"Answer in plain text only (no markdown), under 150 words, "
            f"from general knowledge or ask a clarifying question."
        )
    return prompt


# ──────────────────────────────────────────────
# Anthropic call
# ──────────────────────────────────────────────

def call_anthropic(prompt: str) -> str:
    """Send prompt to Anthropic and return the assistant text response."""
    client = _get_client()
    model = _get_model()
    message = client.messages.create(
        model=model,
        max_tokens=300,
        system=build_system_prompt(),
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text
    clean = _strip_markdown(raw)
    return _enforce_word_limit(clean)


# ──────────────────────────────────────────────
# Follow-up question generation
# ──────────────────────────────────────────────

def generate_followups(
    user_message: str,
    answer: str,
    retrieved_chunks: list[dict],
) -> list[str]:
    """Generate 3 relevant follow-up question suggestions via the LLM."""
    sources = ", ".join({c["source"] for c in retrieved_chunks}) if retrieved_chunks else ""
    context_note = f"The response referenced Synchrony knowledge sources: {sources}.\n\n" if sources else ""

    prompt = (
        f"A user asked a Synchrony Financial assistant: \"{user_message}\"\n\n"
        f"The assistant replied: \"{answer}\"\n\n"
        f"{context_note}"
        f"Suggest exactly 3 concise follow-up questions the user might naturally ask next. "
        f"Each question should relate to the user's original question, the assistant's answer, "
        f"or Synchrony Financial products, credit cards, or personal finance topics. "
        f"Return only the 3 questions, one per line, with no numbering, bullets, or extra text."
    )

    client = _get_client()
    message = client.messages.create(
        model=_get_model(),
        max_tokens=150,
        messages=[{"role": "user", "content": prompt}],
    )
    lines = [ln.strip().lstrip("•-– ").strip() for ln in message.content[0].text.splitlines() if ln.strip()]
    return lines[:3]


# ──────────────────────────────────────────────
# Citations
# ──────────────────────────────────────────────

def format_citations(retrieved_chunks: list[dict]) -> list[dict]:
    """Convert retrieval results into citation objects for the API response."""
    citations = []
    for chunk in retrieved_chunks:
        display_title = chunk.get("display_title") or chunk.get("source", "")
        citations.append(
            {
                # Backward-compat keys
                "source": display_title,
                "chunk_id": chunk.get("chunk_id", 0),
                "snippet": chunk.get("snippet", chunk.get("text", "")[:160].replace("\n", " ")),
                # Rich metadata for UI display
                "display_title": display_title,
                "display_url": chunk.get("display_url"),
                "source_type": chunk.get("source_type", "unknown"),
                "section_heading": chunk.get("section_heading"),
                "page_number": chunk.get("page_number"),
            }
        )
    return citations
