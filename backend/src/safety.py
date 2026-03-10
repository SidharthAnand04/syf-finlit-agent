"""
safety.py – Minimal input sanitization and system prompt hardening.
"""

MAX_MESSAGE_CHARS = 2000
MAX_CONTEXT_CHARS = 8000

PII_REMINDER = (
    "Important: Do not request, store, or repeat any personally identifiable "
    "information (PII) such as Social Security Numbers, account numbers, "
    "passwords, or full names. If the user shares such information, acknowledge "
    "it briefly and advise them not to share sensitive data in a chat."
)


def sanitize_input(text: str) -> str:
    """Strip null bytes, control characters, and truncate to MAX_MESSAGE_CHARS."""
    if not isinstance(text, str):
        raise ValueError("Message must be a string.")
    # Remove null bytes and non-printable control chars (keep newlines/tabs)
    cleaned = "".join(
        ch for ch in text if ch == "\n" or ch == "\t" or (ord(ch) >= 32 and ch != "\x7f")
    )
    cleaned = cleaned.strip()
    if not cleaned:
        raise ValueError("Message is empty after sanitization.")
    return cleaned[:MAX_MESSAGE_CHARS]


def build_system_prompt() -> str:
    return f"""You are a helpful financial literacy assistant. Follow these rules strictly:

1. Keep every response under 150 words. Be direct and concise.
2. Write in plain text only. Do not use markdown: no headers, no bullet points, no bold or italic formatting, no backticks, no dashes as list markers. Use simple numbered sentences or short paragraphs instead.
3. Use the provided Context section first when answering.
4. If the context is insufficient, say so briefly and ask a single focused follow-up question.
5. Do not invent or speculate about specific company policies. Only provide general financial education.
6. When you draw from context, name the source by its title naturally (e.g., "According to Synchrony Credit Cards..." or "Based on the Personal Finance Basics guide..."). Never reference internal filenames like .md or .pdf artifact names.
7. {PII_REMINDER}"""
