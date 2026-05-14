# Alembic

Database migration history for local and Postgres-backed environments.

## Contents

- `env.py` - Alembic runtime configuration.
- `script.py.mako` - migration template.
- `versions/` - ordered schema migrations.

Production schema bootstrap is also handled defensively by backend Supabase helpers, but these migrations document the schema history.
