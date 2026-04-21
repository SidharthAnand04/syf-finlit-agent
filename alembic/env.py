"""Alembic env.py – reads DATABASE_URL from the environment or .env file."""
from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from pathlib import Path

# Load .env file if it exists
try:
    from dotenv import load_dotenv
    dot_env_path = Path(__file__).resolve().parents[1] / ".env"
    if dot_env_path.exists():
        load_dotenv(dot_env_path)
except ImportError:
    pass

from alembic import context
from sqlalchemy import engine_from_config, pool

# Allow models to be imported
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend" / "src"))

# Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override DB URL from environment (sync URL for migrations; strip async drivers if needed)
_db_url = os.environ.get("DATABASE_URL", "")
if _db_url.startswith("postgresql+asyncpg://"):
    _db_url = _db_url.replace("postgresql+asyncpg://", "postgresql://", 1)
elif _db_url.startswith("sqlite+aiosqlite:///"):
    _db_url = _db_url.replace("sqlite+aiosqlite://", "sqlite://", 1)

# Resolve relative SQLite paths to the backend/ directory (same logic as db.py)
_BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
if "sqlite" in _db_url and "///" in _db_url:
    _sep = "///"
    _idx = _db_url.index(_sep) + len(_sep)
    _path_part = _db_url[_idx:]
    _query = ""
    if "?" in _path_part:
        _path_part, _query = _path_part.split("?", 1)
        _query = "?" + _query
    _abs_path = (_BACKEND_DIR / _path_part).resolve()
    _db_url = _db_url[:_idx] + str(_abs_path).replace("\\", "/") + _query

if _db_url:
    config.set_main_option("sqlalchemy.url", _db_url)

# target_metadata – import Base from db.py so Alembic can autogenerate
try:
    from db import Base  # type: ignore
    target_metadata = Base.metadata
except ImportError:
    target_metadata = None


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
