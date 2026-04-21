"""
safety.py – Input sanitization, system prompt, and personality config cache.
"""

import json

MAX_MESSAGE_CHARS = 2000
MAX_CONTEXT_CHARS = 8000

PII_REMINDER = (
    "Important: Do not request, store, or repeat any personally identifiable "
    "information (PII) such as Social Security Numbers, account numbers, "
    "passwords, or full names. If the user shares such information, acknowledge "
    "it briefly and advise them not to share sensitive data in a chat."
)

_DEFAULT_PERSONALITY: dict = {
    "persona_name": "Synchrony virtual assistant",
    "tone_description": "warm, calm, professional",
    "system_prompt_override": None,
    "extra_rules": [],
}

# In-memory cache — populated at startup from DB, updated by admin routes.
_personality: dict = dict(_DEFAULT_PERSONALITY)


def load_personality(data: dict) -> None:
    """Replace the in-memory personality cache (called at app startup)."""
    global _personality
    _personality = {**_DEFAULT_PERSONALITY, **data}


def update_personality(patch: dict) -> dict:
    """Merge a partial update into the cache and return the new full config."""
    global _personality
    _personality = {**_personality, **patch}
    return dict(_personality)


def get_personality() -> dict:
    return dict(_personality)


def sanitize_input(text: str) -> str:
    """Strip null bytes, control characters, and truncate to MAX_MESSAGE_CHARS."""
    if not isinstance(text, str):
        raise ValueError("Message must be a string.")
    cleaned = "".join(
        ch for ch in text if ch == "\n" or ch == "\t" or (ord(ch) >= 32 and ch != "\x7f")
    )
    cleaned = cleaned.strip()
    if not cleaned:
        raise ValueError("Message is empty after sanitization.")
    return cleaned[:MAX_MESSAGE_CHARS]


def build_system_prompt(mode: str = "general") -> str:
    p = _personality

    override = p.get("system_prompt_override")
    if override:
        return override

    persona_name = p.get("persona_name") or "Synchrony virtual assistant"
    tone = p.get("tone_description") or "warm, calm, professional"
    extra_rules: list[str] = p.get("extra_rules") or []

    extra_rules_text = ""
    if extra_rules:
        lines = "\n".join(f"{i + 7}. {rule}" for i, rule in enumerate(extra_rules))
        extra_rules_text = f"\n{lines}"

    return (
        f"You are the {persona_name}. You help users understand Synchrony credit cards, "
        f"financing, and core financial concepts in plain language.\n"
        f"Speak in a {tone} tone. Sound like Synchrony itself when describing products, "
        f'using "we," "our," and "us" where appropriate. Do not sound like a generic AI '
        f"tutor or a document retrieval system.\n\n"
        f"Follow these core rules:\n"
        f"1. FORMATTING: Use markdown. Break text into readable paragraphs. When `has_list` "
        f"is true or when listing multiple points, always use bullet points with exactly one "
        f"newline between items. When you use information from a numbered source, place its "
        f"citation number inline immediately after the relevant text — e.g. 'text [1]' or "
        f"'text [2]'. Only cite source numbers you actually used.\n"
        f"2. BE DIRECT: Put the direct answer in your very first sentence. Skip conversational filler.\n"
        f"3. GROUNDING: Rely strictly on the provided Context. Do not invent interest rates, "
        f"fees, or URLs. If the Context does not contain the answer, politely state that you "
        f"do not have that information.\n"
        f"4. BOUNDARIES: You are an informational assistant. You cannot view user accounts, "
        f"approve applications, or perform account actions.\n"
        f"5. NO ENDING QUESTIONS: Do NOT append generic sign-offs, summary sentences, or "
        f"questions at the end of your messages. End immediately after your answer.\n"
        f"6. {PII_REMINDER}"
        f"{extra_rules_text}"
    )
