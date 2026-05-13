# Synchrony Financial Literacy Chatbot – Engineering Handoff Brief

**Prepared by:** Sidharth Anand  
**Date:** April 24, 2026  
**Audience:** Synchrony Engineering Team  
**Purpose:** Technical review of MVP architecture, data flow, open questions, and path to production

---

## 1. Project Overview

This is a website-embedded conversational AI assistant designed to help Synchrony customers and prospects understand Synchrony financial products and general financial concepts in plain language. The assistant retrieves answers from a curated knowledge base of approved Synchrony web content and responds in Synchrony's voice — grounded, concise, and non-advisory.

The MVP is a working, deployed prototype demonstrating the full retrieval-augmented generation (RAG) loop: query → retrieval → LLM response → source citations. It is not a production system. The primary goal of this session is to identify architectural gaps, compliance concerns, and engineering priorities before any further investment.

---

## 2. User Problem and Example Use Cases

**Problem:** Synchrony customers frequently have basic questions about how financing, credit cards, and promotional offers work — questions that don't require account access or human intervention, but that still create call center volume. Existing FAQ pages are static and require users to navigate manually.

**Target user:** A Synchrony cardholder or applicant who wants a quick, plain-language explanation of a financial concept or product.

### Representative Use Cases

| User Question | Expected Behavior |
|---|---|
| "What is deferred interest and how does it work?" | Explains deferred interest using Synchrony promotional financing content; cites the promo financing explainer page |
| "What credit cards does Synchrony offer?" | Summarizes Synchrony Mastercard and store card product lines from the KB |
| "How does my credit score affect my APR?" | Explains the credit score / APR relationship using Synchrony's credit score education content |
| "Can I use my Synchrony card with Apple Pay?" | Answers from the digital wallets source page |
| "What happens if I miss a payment?" | Explains late fees and impact in general terms; declines to access account-specific data |
| "What is my current balance?" | Refuses — outside scope; directs to Synchrony account portal |

---

## 3. Product Scope

### In-Scope (MVP)

- Plain-language explanations of Synchrony credit cards, financing, promotional offers, deferred interest, payment terms, fees, and credit concepts
- Retrieval from a curated knowledge base of approved Synchrony web content (public pages + optional PDFs)
- Source-backed responses with numbered inline citations linking to original Synchrony URLs
- Suggested follow-up questions generated after each response
- Short multi-turn session context (last 5 exchanges, in-process memory only)
- Admin interface to add/remove URL or PDF sources and trigger re-ingestion
- Configurable chatbot persona and system prompt via admin panel

### Out-of-Scope (MVP)

- Account lookup, balance inquiry, payment processing, or any action requiring authenticated Synchrony account access
- Collection or storage of any PII (name, SSN, account number, DOB)
- Personalized financial advice or product recommendations
- Real-time rate or offer data (content is fetched and cached; not live)
- Multi-language support
- Regulatory compliance certification (UDAAP, ECOA, etc.)
- Integration with Synchrony internal systems (CRM, core banking, etc.)

---

## 4. Current MVP Features

| Feature | Status | Notes |
|---|---|---|
| Chat API (`POST /chat`) | ✅ Live | FastAPI; synchronous Anthropic call; session memory in-process |
| Input sanitization | ✅ Live | Strips null bytes, control chars; truncates at 2,000 chars |
| PII guardrail (system prompt) | ✅ Live | Instructs LLM to refuse and not repeat PII; no enforcement layer |
| Hybrid retrieval (BM25 + dense) | ✅ Live | RRF reranking; top-4 chunks to LLM |
| Inline citations with source URLs | ✅ Live | display_title + display_url resolved from url_sources.json |
| Follow-up question generation | ✅ Live | Separate Anthropic call post-response |
| Intent classifier | ✅ Live | Classifies query as `synchrony` or `informational` before LLM call |
| Configurable persona / system prompt | ✅ Live | Stored in DB `settings` table; loaded at startup |
| Admin panel (URL + PDF sources) | ✅ Live | Bearer-token protected; Next.js UI |
| Ingestion pipeline (URL scrape) | ✅ Live | trafilatura + BeautifulSoup fallback; caches to kb/sources/ |
| Ingestion pipeline (PDF parse) | ✅ Live | pypdf; base64 stored in DB |
| Vercel cron re-ingestion | ✅ Live | Every 6 hours; `CRON_SECRET` auth |
| Content-hash deduplication | ✅ Live | Skips re-embedding unchanged documents |
| Session memory (multi-turn) | ✅ Partial | In-process dict; cleared on restart; max 5 turns |
| Evaluation / testing harness | ❌ Not built | Manual query testing via `/admin/query-test` endpoint only |
| Rate limiting | ❌ Not built | No per-IP or per-session throttle |
| Production logging / observability | ❌ Not built | stdout only |
| Real-time content freshness | ❌ Not built | Cron cache; no webhook or polling per-source |

---

## 5. Proposed Architecture and Data Flow

### Runtime Chat Flow

```
User Browser
    │
    │  POST /chat  { message, session_id }
    ▼
Next.js Frontend  (Vercel)
    │
    │  HTTP → /chat
    ▼
FastAPI Backend  (Vercel serverless Python)
    │
    ├─► sanitize_input()
    │       Strip control chars; truncate at 2,000 chars
    │
    ├─► classify_mode()
    │       Anthropic call → "synchrony" | "informational"
    │       Determines system prompt tone
    │
    ├─► retrieve(query, k=4)
    │       │
    │       ├─► BM25 search (lexical_top_k=10)
    │       │       rank-bm25; financial-term tokenizer
    │       │
    │       ├─► Dense cosine search (dense_top_k=10)
    │       │       all-MiniLM-L6-v2 (384-dim); numpy cosine
    │       │
    │       └─► RRF rerank (k=60)
    │               score = Σ 1/(60 + rank_i)
    │               returns final_top_k=4 chunks
    │
    ├─► build_prompt()
    │       Numbered context block + citation instructions
    │       Truncated at 8,000 chars
    │
    ├─► call_anthropic()
    │       Model: claude-haiku-4-5 (configurable via ANTHROPIC_MODEL)
    │       System prompt: persona + grounding + PII + boundary rules
    │       Session history: last 5 turns (in-process)
    │       Max response: ~150 words
    │
    ├─► format_citations()
    │       Maps chunks → Citation objects with display_title, display_url
    │
    └─► generate_followups()
            Second Anthropic call → 3 suggested questions

    │
    ▼
ChatResponse  { answer, citations[], followups[] }
    │
    ▼
User Browser renders response + citation cards + follow-up chips
```

### Admin / Ingestion Flow

```
Admin Browser
    │
    │  POST /admin/sources/url  { url, name }
    │  POST /admin/sources/pdf  { file (multipart) }
    ▼
FastAPI Admin Router  (Bearer token required)
    │
    ├─► Source record created in DB (sources table)
    │
    └─► POST /admin/ingest/run  (or per-source)
            │
            ├─► fetch_url()  (trafilatura → BS4 fallback)
            │   OR parse_pdf()  (pypdf)
            │
            ├─► content-hash check  → skip if unchanged
            │
            ├─► chunk_text()
            │       Heading-aware markdown splitter
            │       Page-aware PDF splitter
            │       Fixed-size sliding window fallback
            │       chunk_size=1600, overlap=200, min=80 chars
            │
            ├─► embed_texts()  (all-MiniLM-L6-v2, local)
            │       384-dim vectors; CPU inference
            │
            └─► Persist to DB (documents, chunks, embeddings)
                Rebuild in-process index (chunks.pkl, bm25_index.pkl,
                dense_matrix.npy written to kb/processed/)

Vercel Cron (every 6 hours) → same ingestion path, all enabled sources
```

### Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 14 (React) | Deployed on Vercel |
| Backend API | FastAPI (Python 3.11) | Vercel serverless Python runtime |
| LLM | Anthropic Claude (Haiku by default) | Model configurable via `ANTHROPIC_MODEL` env var |
| Embedding | `sentence-transformers` `all-MiniLM-L6-v2` | 384-dim; runs locally on CPU |
| Lexical index | BM25 (`rank-bm25`) | Financial-term tokenizer; serialized to `.pkl` |
| Dense index | NumPy cosine similarity | Embeddings serialized to `.npy`; loaded into memory |
| Database | PostgreSQL (Neon / Supabase) | pgvector extension; asyncpg driver; NullPool for serverless |
| Migrations | Alembic | 3 migration versions; HNSW cosine index on `chunks.embedding` |
| Content fetch | trafilatura + BeautifulSoup | Extracts main text from Synchrony pages |
| PDF parse | pypdf | Extracts page-level text blocks |
| Deployment | Vercel | Frontend + API as separate build targets |

---

## 6. Knowledge Base and Ingestion Plan

### Current Sources (9 URL, 2 static Markdown)

| Source Name | URL | Type |
|---|---|---|
| Synchrony Credit Cards Page | synchrony.com/financing/credit-cards | URL (auto-fetched) |
| Synchrony Financing Options | synchrony.com/financing | URL (auto-fetched) |
| Synchrony Credit Card Main | synchrony.com/creditcard/ | URL (auto-fetched) |
| Synchrony Mastercards | synchrony.com/financing/synchrony-mastercards | URL (auto-fetched) |
| Synchrony FAQs Hub | synchrony.com/help/faqs | URL (auto-fetched) |
| Synchrony Credit Card FAQs | synchrony.com/help/faqs?tab=cc-fin | URL (auto-fetched) |
| Your Credit Score | synchrony.com/consumer-resources/your-credit-score | URL (auto-fetched) |
| Digital Wallets | synchrony.com/financing/digital-wallets | URL (auto-fetched) |
| Promotional Financing Explainer | synchrony.com/blog/spending/promotional-financing-with-synchrony | URL (auto-fetched) |
| Credit Cards Guide | kb/sources/credit_cards_guide.md | Static Markdown |
| Personal Finance Basics | kb/sources/personal_finance_basics.md | Static Markdown |

### Ingestion Process

1. Source added via admin panel (URL or PDF upload)
2. Content fetched and extracted (trafilatura for URLs; pypdf for PDFs)
3. Content-hash check — skips re-processing if unchanged
4. Text split into ~1,600-character chunks with 200-character overlap; heading-aware for markdown, page-aware for PDFs
5. Each chunk embedded with `all-MiniLM-L6-v2` (CPU, ~50ms/chunk)
6. Chunks, embeddings, and metadata written to PostgreSQL + local index files
7. In-process index rebuilt and hot-swapped

### Engineering Considerations

- **URL scraping stability**: trafilatura works well for standard content pages. Pages behind JS rendering (SPAs) will extract minimal content. If Synchrony.com pages use heavy client-side rendering, a headless browser or pre-rendered content endpoint will be needed.
- **Content freshness**: The cron job re-fetches all sources every 6 hours. There is no per-source change detection beyond content hashing. For high-frequency content updates, a webhook trigger would be preferable.
- **Approved content boundary**: Currently any URL can be added via the admin panel. There is no validation that the URL is within an approved domain. A domain allowlist should be enforced before production.
- **Index persistence on Vercel**: The local index files (`chunks.pkl`, `bm25_index.pkl`, `dense_matrix.npy`) are written to `kb/processed/`. On Vercel serverless, the filesystem is ephemeral — the codebase's startup logic falls back to `/tmp` for writes, and the index is rebuilt in-process. For production, the index should live in the database (pgvector) and not depend on local file writes.

---

## 7. Guardrails, Privacy, and Compliance Risks

### Current Guardrails (Implemented)

| Guardrail | Mechanism | Layer |
|---|---|---|
| Input sanitization | Strip control chars; truncate at 2,000 chars | Backend (pre-retrieval) |
| PII non-collection | System prompt instructs LLM to refuse and not repeat PII | LLM prompt |
| Account action refusal | System prompt states the assistant cannot view accounts or perform actions | LLM prompt |
| Grounding enforcement | System prompt instructs LLM to rely strictly on provided context | LLM prompt |
| No rate/fee invention | System prompt explicitly prohibits inventing rates, fees, or URLs | LLM prompt |
| Configurable persona | Tone, rules, and system prompt override stored in DB; editable at runtime | Admin API |

### Risks and Gaps

**1. LLM guardrails are prompt-level only.**  
All behavioral constraints are enforced through the system prompt. There is no output classification layer, no toxicity filter, and no post-response validator. A sufficiently crafted adversarial input could bypass these controls. For production, a content moderation layer (e.g., AWS Comprehend, OpenAI moderation, or a custom classifier) should sit between the LLM output and the user response.

**2. No PII detection or redaction in transit.**  
If a user pastes an account number or SSN into the chat, the text reaches the LLM (it is truncated but not stripped). The current system only instructs the LLM not to repeat it. A PII detection regex or NLP classifier should scrub sensitive patterns before the message reaches the retrieval and LLM layers.

**3. UDAAP and Regulation Z exposure.**  
If the LLM generates a rate, fee, or term that is incorrect or outdated, this could constitute a misleading representation under UDAAP. The system prompt prohibits inventing rates, but grounding is not guaranteed. Retrieved content from Synchrony's public pages may itself be outdated if caching is stale. This risk requires legal review and likely a disclaimer on every response.

**4. No response disclaimer.**  
There is currently no system-appended disclaimer stating that answers are informational only, not personalized financial advice. This should be added to every response prior to any customer-facing deployment.

**5. Admin token is a shared static secret.**  
The admin panel uses a single `ADMIN_TOKEN` environment variable with no expiry, no audit logging, and no per-user identity. Any engineer with the token can modify the knowledge base or system prompt. Before production, admin access should use Synchrony SSO or short-lived tokens with an audit trail.

**6. URL source injection via admin panel.**  
An authorized admin can add any URL as a source. If that URL contains adversarial or off-brand content, it will be ingested into the knowledge base and served to users. A domain allowlist (`*.synchrony.com`) should be enforced server-side.

**7. Session memory is in-process and unencrypted.**  
Multi-turn conversation history is stored in a Python dictionary keyed by `session_id`. It is cleared on server restart and not persisted. The `session_id` is user-supplied — there is no binding to an authenticated user identity. For production, session data should be server-generated and scoped to a verified session.

---

## 8. Evaluation and Testing Plan

### Current State

The only available evaluation tool is a `POST /admin/query-test` endpoint that returns raw ranked chunks for a given query. There is no automated test suite, no ground-truth dataset, and no metrics tracking.

### Proposed Evaluation Approach

**Retrieval Quality**

| Metric | Target | Method |
|---|---|---|
| Recall@4 | ≥ 0.80 | Ground-truth Q&A pairs; check if correct chunk is in top-4 |
| MRR (Mean Reciprocal Rank) | ≥ 0.70 | Rank position of first relevant chunk across test set |
| BM25 vs. dense vs. hybrid comparison | Hybrid ≥ both | A/B retrieval eval on same query set |

**Response Quality**

| Metric | Target | Method |
|---|---|---|
| Factual grounding rate | ≥ 95% | Human review: is the answer supported by the cited chunk? |
| Boundary adherence | 100% | Adversarial queries for PII, account actions, rate invention |
| Citation accuracy | ≥ 90% | Do cited source numbers in the answer match the retrieved chunks? |
| Refusal rate on out-of-scope queries | ≥ 95% | Test set of account-specific, PII-eliciting, and adversarial prompts |

**Suggested Test Corpus**

A minimum viable eval set would include:
- 30 in-scope financial literacy questions with known answers from KB content
- 15 out-of-scope questions (account balance, SSN request, competitor comparison)
- 10 adversarial prompts (prompt injection, role override, PII elicitation)
- 5 edge cases (empty query, very long input, non-English input)

**Tooling**

No eval framework is currently integrated. RAGAS, LangSmith, or a custom eval loop over the `/chat` endpoint would be the most practical starting points. The `/admin/query-test` endpoint already supports retrieval introspection and could be used as a basis for a scripted eval harness.

---

## 9. Open Engineering Questions

1. **Vector store for production**: The current index is BM25 + NumPy, rebuilt in-process and cached to local files. The DB schema has a `chunks.embedding vector(1536)` column with an HNSW index, but retrieval does not currently use pgvector queries — it uses local numpy cosine search. Should production retrieval query pgvector directly, or is a dedicated vector store (Pinecone, Weaviate) preferred at Synchrony's scale?

2. **Embedding model**: `all-MiniLM-L6-v2` (384-dim) is a fast, lightweight model suitable for CPU inference. It was chosen for low cost and zero API dependency. Would Synchrony prefer a managed embedding API (OpenAI `text-embedding-3-small`, Cohere, etc.) for consistency and support guarantees?

3. **LLM provider and model**: The current integration uses Anthropic's Claude API (Haiku by default). Is Anthropic an approved vendor at Synchrony? Is there a preferred LLM provider or an internal model deployment that should be used instead?

4. **Content authoring and approval workflow**: Currently, any admin-panel user can add a URL or PDF to the knowledge base. What is the required content approval workflow before new sources go live? Should there be a staging → review → publish flow with a separate approval role?

5. **Session persistence**: Multi-turn context is currently in-process only. Is stateful session history (across page reloads or devices) a requirement? If so, what data store and retention policy would be acceptable?

6. **Deployment target**: The MVP runs on Vercel serverless. Does Synchrony have infrastructure preferences (AWS, Azure, GCP, on-premises)? Serverless cold starts and ephemeral file systems are constraints that affect the index persistence and warm-up strategy.

7. **Integration with Synchrony.com**: Is this intended as a standalone microsite or should it be embedded in the existing Synchrony web property? If embedded, what are the CSP, iframe, and authentication constraints?

8. **Response disclaimer requirement**: Is a legal disclaimer required on every chat response, and if so, what is the approved language?

9. **Logging and data retention**: What data from the chat session (messages, retrieved chunks, session IDs) is permissible to log, and for how long? This affects the observability design significantly.

10. **Accessibility**: The current frontend has no ARIA labels, keyboard navigation, or screen reader support. What is the required accessibility standard (WCAG 2.1 AA)?

---

## 10. Requested Feedback from Engineers

The following are the specific areas where engineering input from Synchrony would most affect the next development phase:

**Architecture**
- Is the hybrid BM25 + dense retrieval approach acceptable, or is there a preferred retrieval architecture at Synchrony?
- Should the vector index live in pgvector (already schema'd), a dedicated vector DB, or an in-memory store with a warm-up strategy?

**Infrastructure**
- What is the preferred runtime environment (Vercel, AWS Lambda, ECS, internal Kubernetes)?
- Is there an existing API gateway, WAF, or rate limiting layer that this service should sit behind?

**Security and Compliance**
- What PII detection requirements apply? Is a regex-based scrubber sufficient, or is a managed service required?
- What is the UDAAP review process for chatbot responses? Is there a required legal review cadence?
- Does the ADMIN_TOKEN authentication model meet Synchrony's access control standards, or is SSO integration required before any internal use?

**Data**
- Can the knowledge base content pull from an internal CMS or content API rather than scraping public URLs? This would be more reliable and give Synchrony direct control over what content is served.
- What is the retention policy for conversation logs?

**Evaluation**
- Does Synchrony have an existing LLM evaluation framework or team that could own this?
- Are there existing customer FAQ datasets or support transcript excerpts that could be used to build a ground-truth eval set?

---

*This document describes the current MVP state as of April 24, 2026. The codebase is available at [github.com/SidharthAnand04/syf-finlit-agent](https://github.com/SidharthAnand04/syf-finlit-agent). All architectural decisions in the MVP were made to demonstrate feasibility quickly; none should be assumed as production-ready.*
