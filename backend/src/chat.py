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
AI_INSIGHTS_MAX_TOKENS = int(os.getenv("AI_INSIGHTS_MAX_TOKENS", "8000"))

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


def _extract_json_object(text: str) -> str | None:
    """Return the first balanced top-level JSON object found in text."""
    start = text.find("{")
    if start < 0:
        return None

    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


def _loads_llm_json(raw: str) -> dict:
    """Parse JSON returned by an LLM, tolerating common wrappers."""
    raw_clean = raw.strip()
    if raw_clean.startswith("```"):
        raw_clean = re.sub(r"^```(?:json)?\s*", "", raw_clean, flags=re.IGNORECASE)
        raw_clean = re.sub(r"\s*```$", "", raw_clean)
    raw_clean = raw_clean.strip()

    try:
        parsed = json.loads(raw_clean)
    except json.JSONDecodeError:
        extracted = _extract_json_object(raw_clean)
        if not extracted:
            raise
        parsed = json.loads(extracted)

    if isinstance(parsed, str):
        parsed = json.loads(parsed)
    if not isinstance(parsed, dict):
        raise TypeError("LLM JSON response was not an object")
    return parsed


def _json_value_for_key(raw: str, key: str):
    """Extract one complete JSON value from an otherwise truncated object."""
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    decoder = json.JSONDecoder()
    match = re.search(rf'"{re.escape(key)}"\s*:', text)
    if not match:
        return None
    try:
        value, _ = decoder.raw_decode(text[match.end():].lstrip())
        return value
    except json.JSONDecodeError:
        return None


def _salvage_truncated_insight_json(raw: str) -> dict:
    """Preserve complete leading fields when the model is cut off mid-JSON."""
    # Clean markdown code fences from raw before salvaging
    raw_clean = raw.strip()
    if raw_clean.startswith("```"):
        raw_clean = re.sub(r"^```(?:json)?\s*", "", raw_clean, flags=re.IGNORECASE)
        raw_clean = re.sub(r"\s*```$", "", raw_clean)
    
    executive = (
        _json_value_for_key(raw_clean, "executiveSummary")
        or _json_value_for_key(raw_clean, "executive_summary")
        or "AI analysis was truncated before a complete report could be generated."
    )
    health = _json_value_for_key(raw_clean, "health")
    if not isinstance(health, dict):
        health = {
            "score": _json_value_for_key(raw_clean, "health_score"),
            "status": "Unknown",
            "riskLevel": "Unknown",
            "mainProblem": _json_value_for_key(raw_clean, "health_reasoning") or "AI analysis was truncated.",
            "topAction": "Re-run AI Analysis; the previous model response exceeded the output limit.",
        }
    score = health.get("score") if isinstance(health, dict) else _json_value_for_key(raw_clean, "health_score")
    reasoning = _json_value_for_key(raw_clean, "health_reasoning") or health.get("mainProblem") or "Truncated JSON output."

    return {
        "executiveSummary": executive,
        "executive_summary": executive,
        "health": health,
        "health_score": score,
        "health_reasoning": reasoning,
        "priorityFixes": [],
        "questionThemes": [],
        "topic_clusters": [],
        "contentGaps": [],
        "content_gaps": [],
        "riskComplianceSignals": [],
        "sourceRecommendations": [],
        "source_recommendations": [],
        "retrievalDiagnostics": [],
        "retrieval_issues": [],
        "faqDrafts": [],
        "kbDrafts": [],
        "visualizationData": {},
        "quick_wins": [
            "Re-run AI Analysis after the output limit fix.",
            "If truncation persists, reduce the selected time range.",
        ],
        "_raw": raw_clean[:4000],
        "_parse_warning": "AI analysis response was truncated before valid JSON completed.",
    }


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

            # Use XML tags which Claude follows much more strictly for context
            context_parts.append(f'<source id="{i}" ref="{source_ref}">\n{chunk["text"]}\n</source>')

        context_block = "\n\n".join(context_parts)
        context_block = context_block[:MAX_CONTEXT_CHARS]
        prompt = (
            f"<context>\n{context_block}\n</context>\n\n"
            f"Question: {user_message}\n\n"
            f"Answer correctly and concisely using the context above. "
            f"Do NOT use inline citations like [1] or [2] in your text. "
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
            "Use **bolding** for important terms. If has_list is true, strictly use bullet point list format. "
            'You MUST use [N] inline citation markers (where N is the source id) throughout your response whenever you state a fact. '
            'Also provide `[link label](url)` where relevant."}. '
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
# Insights LLM Analysis
# ──────────────────────────────────────────────

def analyze_insights(data: dict) -> dict:
    """
    Pass chat analytics + KB metadata to Claude and get back a structured
    analysis with topic clusters, content gaps, source recommendations, and
    system improvement suggestions.

    Returns a dict matching the LlmAnalysisResult schema expected by the frontend.
    """
    client = _get_client()
    model  = _get_model()

    kpi       = data.get("kpi", {})
    questions = data.get("all_questions", [])
    gaps      = data.get("gap_questions", [])
    low_cite  = data.get("low_cite", [])
    sources   = data.get("source_stats", [])
    kb_topics = data.get("kb_topics", [])
    qt        = data.get("question_types", [])

    # Compact payload so we stay well under token limits
    q_lines  = "\n".join(
        f'- "{q["user_message"]}" (asked {q["times_asked"]}x, type={q["question_type"]}, '
        f'avg_chunks={q["avg_chunks"]}, citation_rate={q.get("citation_rate_pct", "?")}%)'
        for q in questions[:40]
    )
    gap_lines = "\n".join(
        f'- "{g["user_message"]}" (asked {g["times_asked"]}x)'
        for g in gaps[:25]
    )
    low_cite_lines = "\n".join(
        f'- "{l["user_message"]}" (asked {l["times_asked"]}x, avg_chunks={l["avg_chunks"]})'
        for l in low_cite[:15]
    )
    src_lines = "\n".join(
        f'- "{s["source_name"]}" (type={s["source_type"]}, enabled={s["enabled"]}, '
        f'chunks={s["chunk_count"]}, citations={s["citation_count"]})'
        for s in sources
    )
    topic_lines = "\n".join(
        f'- "{t["topic"]}" from "{t["source_title"]}" ({t["chunk_count"]} chunks)'
        for t in kb_topics[:50]
    )
    qt_lines = "\n".join(f'- {q["question_type"]}: {q["count"]}' for q in qt)

    prompt = f"""You are an AI analyst reviewing a Synchrony Financial chatbot's performance data.
Your job is to deeply analyze user questions, knowledge base content, and citation patterns to generate actionable insights.

=== SYSTEM STATS ===
Total interactions: {kpi.get('total_interactions', 'N/A')}
Unique sessions: {kpi.get('unique_sessions', 'N/A')}
Follow-up rate: {kpi.get('followup_pct', 'N/A')}%
Zero-chunk queries: {kpi.get('zero_chunk_queries', 'N/A')}
Avg chunks retrieved: {kpi.get('avg_chunks_retrieved', 'N/A')}

=== QUESTION TYPE BREAKDOWN ===
{qt_lines}

=== TOP USER QUESTIONS (with retrieval metrics) ===
{q_lines}

=== QUESTIONS WITH NO KB MATCH (0 chunks retrieved) ===
{gap_lines if gap_lines else "None"}

=== QUESTIONS WHERE CHUNKS RETRIEVED BUT NOTHING CITED ===
{low_cite_lines if low_cite_lines else "None"}

=== KNOWLEDGE BASE SOURCES ===
{src_lines if src_lines else "None"}

=== KB TOPIC / HEADING COVERAGE ===
{topic_lines if topic_lines else "None"}

=== YOUR TASK ===
Analyze everything above and return a single valid JSON object with this exact structure (no markdown, no extra text):

{{
  "executiveSummary": "2-3 sentence overview of the chatbot's health and most important findings",
  "executive_summary": "same value as executiveSummary for backwards compatibility",
  "health": {{
    "score": <number 1-10 reflecting overall KB + retrieval quality>,
    "status": "Excellent" | "Good" | "Needs Attention" | "Critical",
    "riskLevel": "Low" | "Medium" | "High",
    "mainProblem": "the single most important trust problem an admin should understand",
    "topAction": "the first action an admin should take"
  }},
  "health_score": <same numeric value as health.score>,
  "health_reasoning": "1 sentence explaining the health score",
  "priorityFixes": [
    {{
      "problem": "specific issue",
      "severity": "High" | "Medium" | "Low",
      "evidence": "specific evidence from questions or sources",
      "impact": "why this affects user trust",
      "recommendedFix": "specific admin action",
      "effort": "Quick" | "Medium" | "Involved",
      "confidence": "High" | "Medium" | "Low",
      "owner": "Content" | "Engineering" | "Compliance" | "Admin",
      "actionType": "faq" | "kb" | "source" | "retrieval" | "risk" | "performance"
    }}
  ],
  "questionThemes": [
    {{
      "theme": "concise theme name",
      "description": "what users are asking",
      "askedCount": <int>,
      "coverage": "Strong" | "Partial" | "Weak" | "Missing",
      "riskLevel": "Low" | "Medium" | "High",
      "exampleQueries": ["q1", "q2"],
      "recommendedAction": "specific action"
    }}
  ],
  "topic_clusters": [
    {{
      "topic": "concise topic name",
      "description": "what users are asking about",
      "question_count": <int>,
      "example_questions": ["q1", "q2"],
      "coverage": "good" | "partial" | "gap",
      "coverage_note": "brief explanation of coverage quality"
    }}
  ],
  "contentGaps": [
    {{
      "title": "gap title",
      "description": "what's missing and why it matters",
      "evidence": ["example question 1", "example question 2"],
      "priority": "high" | "medium" | "low",
      "suggestedAction": "specific recommendation to fix this gap",
      "suggested_action": "same value as suggestedAction for backwards compatibility",
      "riskLevel": "Low" | "Medium" | "High",
      "currentCoverage": "what is currently available or Not tracked",
      "missingSource": "source/topic to add or improve"
    }}
  ],
  "content_gaps": [
    {{
      "title": "same gap title",
      "description": "same description",
      "evidence": ["example question 1", "example question 2"],
      "priority": "high" | "medium" | "low",
      "suggested_action": "same value as suggestedAction"
    }}
  ],
  "riskComplianceSignals": [
    {{
      "category": "approval/eligibility" | "apr/promotional financing" | "fraud/disputes" | "account-specific" | "advice requests" | "personal data" | "unsupported advice",
      "count": <int>,
      "severity": "High" | "Medium" | "Low",
      "exampleQueries": ["q1", "q2"],
      "safeHandling": "Not tracked" | "Handled safely" | "Needs review",
      "recommendedRouting": "specific routing/refusal/disclaimer guidance"
    }}
  ],
  "sourceRecommendations": [
    {{
      "source_name": "source name or 'New Source'",
      "finding": "what the data shows about this source",
      "recommendation": "specific action to take",
      "type": "improve" | "add" | "remove" | "review"
    }}
  ],
  "source_recommendations": [
    {{
      "source_name": "source name or 'New Source'",
      "finding": "what the data shows about this source",
      "recommendation": "specific action to take",
      "type": "improve" | "add" | "remove" | "review"
    }}
  ],
  "retrievalDiagnostics": [
    {{
      "title": "issue title",
      "description": "what the data suggests is wrong with retrieval for these queries",
      "affected_questions": ["q1", "q2"],
      "suggested_fix": "specific technical or content fix"
    }}
  ],
  "retrieval_issues": [
    {{
      "title": "issue title",
      "description": "what the data suggests is wrong with retrieval for these queries",
      "affected_questions": ["q1", "q2"],
      "suggested_fix": "specific technical or content fix"
    }}
  ],
  "faqDrafts": [
    {{
      "canonicalQuestion": "draft FAQ question",
      "alternatePhrasings": ["alternate question"],
      "suggestedAnswer": "short safe answer draft",
      "suggestedSources": ["source name or topic"],
      "tags": ["tag"]
    }}
  ],
  "kbDrafts": [
    {{
      "title": "draft KB title",
      "body": "plain-language source content outline",
      "tags": ["tag"],
      "relatedQueries": ["q1"],
      "riskDisclaimer": "disclaimer or routing note if needed"
    }}
  ],
  "visualizationData": {{
    "notes": "include compact chart-ready counts only if supported by the data"
  }},
  "quick_wins": [
    "Short actionable improvement that could be done immediately"
  ]
}}

Rules:
- health.status must not be Excellent if zero-chunk queries are high, citation quality is weak, latency is high, or risk handling is not tracked for risky topics
- Keep every string concise enough for dashboard cards; do not write paragraphs inside list items
- priorityFixes: give the top 3 fixes ordered by what improves chatbot trust first
- questionThemes/topic_clusters: identify 3-5 coherent topic groups from the questions
- contentGaps/content_gaps: flag 2-4 clear gaps where users ask things the KB can't answer well
- riskComplianceSignals: flag risky Synchrony/financial-services intents. If handling outcome is unknown, say "Not tracked"
- sourceRecommendations/source_recommendations: give 2-3 specific source-level actions
- retrievalDiagnostics/retrieval_issues: flag 1-3 patterns where retrieval is failing (low citation rate despite chunks retrieved, or zero-chunk misses on common topics)
- quick_wins: list 2-3 concrete immediate improvements
- Be specific, cite actual question text as evidence
- health_score: 1=broken, 5=mediocre, 8=good, 10=excellent"""

    response = client.messages.create(
        model=model,
        max_tokens=AI_INSIGHTS_MAX_TOKENS,
        temperature=0.2,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()

    try:
        return _loads_llm_json(raw)
    except (json.JSONDecodeError, TypeError):
        retry_prompt = prompt + """

The previous response was not valid complete JSON. Return a much smaller valid JSON object now:
- Keep only executiveSummary/executive_summary, health, health_score, health_reasoning, priorityFixes, questionThemes, contentGaps/content_gaps, riskComplianceSignals, sourceRecommendations/source_recommendations, retrievalDiagnostics/retrieval_issues, quick_wins.
- Maximum 2 items per array.
- Maximum 20 words per string inside arrays.
- No markdown fences and no text outside JSON."""
        try:
            retry = client.messages.create(
                model=model,
                max_tokens=AI_INSIGHTS_MAX_TOKENS,
                temperature=0.0,
                messages=[{"role": "user", "content": retry_prompt}],
            )
            retry_raw = retry.content[0].text.strip()
            return _loads_llm_json(retry_raw)
        except Exception:
            return _salvage_truncated_insight_json(raw)


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
