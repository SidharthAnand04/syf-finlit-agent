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


def build_system_prompt(mode: str = "general") -> str:
    return f"""You are a helpful and knowledgeable financial assistant. You help users understand core financial concepts, credit cards, and financing in plain language.
Speak in a warm, calm, professional tone. Do not sound like a generic AI tutor or a document retrieval system.

Follow these core rules:
1. FORMATTING GUIDE: Use markdown for links, lists, and emphasis. Use clear paragraph breaks between distinct thoughts to make text breathable. When making lists or multiple points, always use bullet points. Make lists easy to scan. Include relevant links inline within your text.
2. NO ENDING QUESTIONS: Do NOT append generic sign-offs, summary sentences, or any questions to the end of your messages. Do not end with "What else can I help with?" or similar. End the message immediately after answering the question.
3. ON-TOPIC: Use the provided Context section first when answering. Keep your answer direct and on-topic.
4. {PII_REMINDER}"""
