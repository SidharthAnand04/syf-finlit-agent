#!/usr/bin/env python3
"""
scripts/rebuild_index.py – Force a full rebuild of the hybrid RAG index.

Run from the project root:

    python scripts/rebuild_index.py

Optionally re-fetch all URL sources first:

    python scripts/rebuild_index.py --refresh-urls

The script rebuilds the BM25 lexical index and the dense embedding index
from all files in kb/sources/ and saves them to kb/processed/.
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

# Allow imports from backend/src/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend" / "src"))

from dotenv import load_dotenv

load_dotenv()


def main() -> None:
    parser = argparse.ArgumentParser(description="Rebuild the hybrid RAG index.")
    parser.add_argument(
        "--refresh-urls",
        action="store_true",
        help="Re-fetch all URL sources from kb/url_sources.json before rebuilding.",
    )
    args = parser.parse_args()

    if args.refresh_urls:
        print("Refreshing URL sources...")
        from retrieval import refresh_url_sources  # type: ignore

        updated = asyncio.run(refresh_url_sources(force=True))
        if updated:
            print(f"  Updated: {', '.join(updated)}")
        else:
            print("  No URL sources needed updating.")

    print("Rebuilding RAG index from kb/sources/...")
    from rag.config import RAGConfig  # type: ignore
    from rag.services.build_service import rebuild_index  # type: ignore

    chunks, _lexical, _dense = rebuild_index(config=RAGConfig.from_env())
    print(f"\n✓ Done. {len(chunks)} chunks ready for hybrid retrieval.")


if __name__ == "__main__":
    main()
