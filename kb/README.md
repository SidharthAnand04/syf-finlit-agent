# Knowledge Base

Seed source content and local fallback retrieval artifacts.

## Contents

- `url_sources.json` - source metadata used by admin/cron ingestion seeding.
- `sources/` - markdown snapshots of Synchrony and financial literacy source content.
- `processed/` - committed local fallback retrieval artifacts.

## Production Behavior

Production RAG is Supabase-first and reads from `kb_chunks`. The `kb/` folder is retained for source seeding, ingestion reference material, and local fallback workflows.
