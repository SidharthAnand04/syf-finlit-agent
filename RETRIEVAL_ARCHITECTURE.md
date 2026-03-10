# Hybrid RAG Retrieval Architecture

## Overview

The retrieval system has been upgraded from a TF-IDF–only local file retriever
to a production-ready **hybrid BM25 + dense embedding pipeline** with RRF
reranking, structure-aware chunking, rich citation metadata, and full support
for markdown, text, HTML, and PDF sources.

---

## Why This Is Better Than TF-IDF-Only

| Capability | Old (TF-IDF) | New (Hybrid) |
|---|---|---|
| Exact term matching ("APR", "FICO") | ✓ Moderate | ✓ Strong (BM25) |
| Paraphrase / semantic similarity | ✗ None | ✓ Strong (dense) |
| Heading-aware chunking | ✗ Paragraph split | ✓ Yes |
| Page-aware PDF chunking | ✗ Not supported | ✓ Yes |
| HTML / web page support | ✗ Saved as .md only | ✓ Direct .html loading |
| Section heading in citations | ✗ No | ✓ Yes |
| Clickable source URLs in UI | ✗ Shows filename | ✓ Shows original URL |
| Index persistence | ✓ Single .pkl | ✓ Separate BM25 + matrix |
| Configurable via env vars | ✗ No | ✓ Yes |

---

## Architecture: Module Breakdown

```
backend/src/rag/
  config.py               RAGConfig dataclass; all env-var overrides
  schemas.py              SourceMeta, LoadedDocument, RichChunk

  ingestion/
    loaders.py            Loaders for .md, .txt, .html, .pdf
                          Resolves origin metadata (display_title, display_url)
                          from url_sources.json and embedded Source: headers.

  chunking/
    chunker.py            Heading-aware chunker for markdown/txt/html
                          Page-aware chunker for PDFs
                          Fixed-size sliding window fallback

  indexing/
    lexical.py            BM25Okapi index (rank-bm25); financial-term tokenizer
    dense.py              sentence-transformers embedding + numpy cosine index
    store.py              Save/load chunks.pkl, bm25_index.pkl, dense_matrix.npy

  retrieval/
    hybrid.py             BM25 + dense → RRF fusion → final top-k

  services/
    build_service.py      ensure_index() / rebuild_index() with in-process cache
```

`backend/src/retrieval.py` is a backward-compatible facade — `main.py` imports
`get_index`, `retrieve`, and `refresh_url_sources` from there unchanged.

---

## Retrieval Flow

```
Query
  │
  ├─► BM25 search (lexical_top_k=10)    exact term matching
  │       ranks by BM25 score
  │
  ├─► Dense cosine search (dense_top_k=10)    semantic similarity
  │       embed query → cosine sim over all chunk embeddings
  │
  └─► RRF rerank (k=60)
          score(d) = Σ 1/(60 + rank_i(d))
          keeps rerank_top_k=8 candidates
          returns final_top_k=4 to LLM
```

---

## Citation Metadata

Each returned chunk includes:

| Field | Description |
|---|---|
| `display_title` | Human-readable title for UI (e.g. "Synchrony Credit Cards") |
| `display_url` | Original public URL, or `null` for local-only files |
| `source_type` | `"website"`, `"pdf"`, `"markdown"`, or `"txt"` |
| `section_heading` | Heading context (e.g. "Rewards and Benefits") |
| `page_number` | 1-based page number for PDFs; `null` otherwise |
| `snippet` | First 160 chars of chunk text |

The UI renders source cards with a clickable link to `display_url` (when
available), the section heading, and the snippet. Internal artifact filenames
like `credit_cards_guide.md` are never shown to users.

---

## How to Add New Sources

### Website / URL source

1. Add an entry to `kb/url_sources.json`:

```json
{
  "url": "https://www.synchrony.com/your-page",
  "filename": "your_page.md",
  "name": "Your Page Title",
  "display_title": "Your Page Title"
}
```

2. Rebuild the index (fetch + re-index):

```bash
python scripts/rebuild_index.py --refresh-urls
```

### Local markdown or text file

1. Drop the file into `kb/sources/` (`.md` or `.txt`).
2. Rebuild: `python scripts/rebuild_index.py`

### PDF file

1. Copy the PDF into `kb/sources/`.
2. Rebuild: `python scripts/rebuild_index.py`

To associate a PDF with a public URL (for citations), add it to `url_sources.json`
with `"filename": "yourfile.pdf"` and the desired `"url"`.

### HTML file

1. Copy the `.html` file into `kb/sources/`.
2. Rebuild: `python scripts/rebuild_index.py`

---

## How to Rebuild the Index

```bash
# From the project root, with the virtualenv active:

# Rebuild from existing kb/sources/ files (fast):
python scripts/rebuild_index.py

# Re-fetch all URL sources AND rebuild:
python scripts/rebuild_index.py --refresh-urls

# Force rebuild via Python (from backend/src/):
from rag.services.build_service import rebuild_index
rebuild_index()
```

The server also rebuilds automatically on startup if no saved index is found,
or if URL sources were updated during the lifespan startup.

---

## Configuration (Environment Variables)

| Variable | Default | Description |
|---|---|---|
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | sentence-transformers model name |
| `RAG_CHUNK_SIZE` | `1600` | Target chars per chunk |
| `RAG_CHUNK_OVERLAP` | `200` | Overlap chars (sliding window fallback) |
| `RAG_MIN_CHUNK_CHARS` | `80` | Discard chunks shorter than this |
| `RAG_LEXICAL_TOP_K` | `10` | BM25 candidates |
| `RAG_DENSE_TOP_K` | `10` | Dense cosine candidates |
| `RAG_RERANK_TOP_K` | `8` | Candidates kept after RRF |
| `RAG_FINAL_TOP_K` | `4` | Chunks sent to LLM |
| `RAG_RERANKER_ENABLED` | `true` | Enable/disable RRF fusion |
| `RAG_RRF_K` | `60` | RRF constant (higher = less aggressive) |

---

## New Dependencies

| Package | Reason |
|---|---|
| `rank-bm25` | BM25 lexical index; replaces scikit-learn TF-IDF |
| `sentence-transformers` | Dense embeddings (already used by ingest pipeline) |
| `httpx` | Async HTTP for URL fetching (already used by ingest/fetch.py) |
| `trafilatura` | Web content extraction (already used by ingest/fetch.py) |
| `beautifulsoup4` | HTML parsing fallback (already used by ingest/fetch.py) |
| `pypdf` | PDF text + page extraction (already used by ingest/pdf.py) |

`scikit-learn` has been removed from `backend/requirements.txt` — it is no longer
needed. If you have it installed locally it is harmless to leave; it is just
not imported by the new pipeline.

---

## Index Persistence

Three files are written to `kb/processed/` (or `/tmp/syf_rag_index/` on
read-only filesystems like Vercel):

```
kb/processed/
  chunks.pkl        list[RichChunk] with full metadata
  bm25_index.pkl    serialized BM25Okapi object
  dense_matrix.npy  float32 numpy embedding matrix (n_chunks × 384)
```

On startup, these are loaded from disk in milliseconds. The embedding model
is only run when building fresh (first run, or after `--refresh-urls` detects
new content).

---

## Easiest Future Upgrades

1. **Neural reranker** — Replace RRF in `rag/retrieval/hybrid.py` with a
   `sentence_transformers.CrossEncoder` (e.g. `cross-encoder/ms-marco-MiniLM-L-6-v2`).
   Only the `_rrf_rerank()` function needs to change; the rest of the pipeline
   is unchanged.

2. **FAISS vector index** — Replace the numpy cosine loop in `rag/indexing/dense.py`
   with `faiss.IndexFlatIP` for corpora > 50k chunks. The `DenseIndex` interface
   is unchanged.

3. **OpenAI / Cohere embeddings** — Swap out `ingest/embedder.py` to call an
   external API. `DenseIndex.build()` and `DenseIndex.search()` both call
   `embed_texts` / `embed_query` as thin wrappers, so only those two functions
   change.

4. **Query expansion** — Add a pre-retrieval step in `rag/retrieval/hybrid.py`
   that expands financial synonyms (e.g. "APR" → "annual percentage rate") before
   calling BM25.

5. **Streaming citations** — The `retrieve()` return type (`list[dict]`) is
   already serialization-ready. Switching to SSE streaming in `main.py` can be
   done without touching the retrieval layer.
