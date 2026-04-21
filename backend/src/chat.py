"""
chat.py – Anthropic API integration with RAG prompt construction.
"""

from __future__ import annotations

import os
import re
import json

import anthropic

from safety import build_system_prompt, MAX_CONTEXT_CHARS

MAX_WORDS = 150

# Simple session memory: { session_id: [{"role": "user"|"assistant", "content": "..."}] }
SESSION_MEMORY: dict[str, list[dict[str, str]]] = {}
MAX_SESSION_TURNS = 5


def _strip_markdown(text: str) -> str:
    """Remove common markdown constructs so plain text reaches the user."""
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"\*{1,2}([^*]+?)\*{1,2}", r"\1", text)
    text = re.sub(r"_{1,2}([^_]+?)_{1,2}", r"\1", text)
    text = re.sub(r"`([^`]+?)`", r"\1", text)
    text = re.sub(r"```[\s\S]*?```", "", text)
    text = re.sub(r"^[\-\*]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^[-*_]{3,}\s*$", "", text, flags=re.MULTILINE)
    # Strip inline citation markers [N]
    text = re.sub(r"\[\d+\]", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _enforce_word_limit(text: str, limit: int = MAX_WORDS) -> str:
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
    """Build the user-turn message with retrieved context and numbered citations."""
    if retrieved_chunks:
        context_parts = []
        for i, chunk in enumerate(retrieved_chunks, 1):
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

            header = f"[Source {i}: {source_ref}]"
            context_parts.append(f"{header}\n{chunk['text']}")

        context_block = "\n\n---\n\n".join(context_parts)
        context_block = context_block[:MAX_CONTEXT_CHARS]
        prompt = (
            f"Context:\n{context_block}\n\n"
            f"---\n\n"
            f"Question: {user_message}\n\n"
            f"Answer correctly and concisely using the context above. "
            f"Each source above is numbered — when you reference a source, place its "
            f"number inline immediately after the relevant text (e.g. 'text [1]' or 'text [2]'). "
            f"Only cite source numbers you actually used. "
            f"Do not mention source titles, documents, guides, filenames, or internal files. "
            f"Present grounded information naturally as Synchrony guidance."
        )
    else:
        prompt = (
            f"Question: {user_message}\n\n"
            f"No relevant context was found in the knowledge base. "
            f"Answer concisely from general knowledge."
        )
    return prompt


# ──────────────────────────────────────────────
# Anthropic call & Classification
# ──────────────────────────────────────────────

def classify_mode(user_message: str) -> str:
    """Dynamically determine whether the question is 'synchrony' specific or 'informational'."""
    client = _get_client()
    model = _get_model()  # Use the default model from env instead of hardcoded haiku string
    prompt = (
        "Classify the following user question into one of two categories:\n"
        "1. 'synchrony' - if it asks about Synchrony Financial, its products, credit cards, accounts, specific financing policies, or customer service.\n"
        "2. 'informational' - if it asks about general financial literacy, budgeting, basic credit score mechanics, or general finance without mentioning any brand.\n\n"
        f"Question: {user_message}\n\n"
        "Return ONLY the exact word 'synchrony' or 'informational'."
    )
    try:
        res = client.messages.create(
            model=model,
            max_tokens=10,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
        )
        text = res.content[0].text.strip().lower()
        if "informational" in text:
            return "informational"
    except Exception as e:
        print(f"Classification failed, defaulting to synchrony. Error: {e}")
    return "synchrony"


def call_anthropic(
    prompt: str,
    session_id: str | None = None,
    markdown: bool = True,
    mode: str = "synchrony",
) -> str:
    """Send prompt to Anthropic and return the assistant text response."""
    client = _get_client()
    model = _get_model()

    messages = []
    if session_id and session_id in SESSION_MEMORY:
        messages = SESSION_MEMORY[session_id].copy()

    messages.append({"role": "user", "content": prompt})

    message = client.messages.create(
        model=model,
        max_tokens=1500,
        system=(
            build_system_prompt(mode)
            + "\n\nIMPORTANT: You must return ALL your output as a single valid JSON object "
            "exactly matching this schema: "
            '{"message_len": "SHORT|MEDIUM|LONG", "has_list": true/false, '
            '"content": "your actual response to the user in markdown. '
            "If has_list is true, use bullet point list format. "
            'Use [N] inline citation markers where relevant."}. '
            "Do not return any extra text outside the JSON object. "
            "Do not use markdown backticks around the json."
        ),
        messages=messages,
    )
    raw = message.content[0].text

    try:
        print(f"RAW ANTHROPIC OUTPUT:\n{raw}\n---")
        parsed = json.loads(raw)
        actual_response = parsed.get("content", raw)
        msg_len = parsed.get("message_len")
        has_list = parsed.get("has_list")
        print(f"Model decided message length: {msg_len} | has_list: {has_list}")
    except Exception:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group(0))
                actual_response = parsed.get("content", raw)
            except Exception:
                actual_response = raw
        else:
            actual_response = raw

    clean = actual_response if markdown else _strip_markdown(actual_response)

    # Save session history
    if session_id:
        user_question = (
            prompt.split("Question: ")[-1].strip()
            if "Question: " in prompt
            else prompt
        )
        SESSION_MEMORY.setdefault(session_id, [])
        SESSION_MEMORY[session_id].append({"role": "user", "content": user_question})
        SESSION_MEMORY[session_id].append({"role": "assistant", "content": raw})
        if len(SESSION_MEMORY[session_id]) > MAX_SESSION_TURNS * 2:
            SESSION_MEMORY[session_id] = SESSION_MEMORY[session_id][-MAX_SESSION_TURNS * 2:]

    return clean


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
    context_note = (
        f"The response referenced Synchrony knowledge sources: {sources}.\n\n"
        if sources
        else ""
    )

    prompt = (
        f'A user asked a Synchrony Financial assistant: "{user_message}"\n\n'
        f'The assistant replied: "{answer}"\n\n'
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
    lines = [
        ln.strip().lstrip("•-– ").strip()
        for ln in message.content[0].text.splitlines()
        if ln.strip()
    ]
    return lines[:3]


# ──────────────────────────────────────────────
# Citations
# ──────────────────────────────────────────────

def format_citations(retrieved_chunks: list[dict]) -> list[dict]:
    """Convert retrieval results into citation objects ordered by source number."""
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
