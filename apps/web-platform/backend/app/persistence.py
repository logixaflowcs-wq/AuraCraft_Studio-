"""Small Postgres-backed JSON state store for ephemeral free hosting.

The app keeps its JSON-file adapter for local development and tests. When
DATABASE_URL is configured, this module persists character records and render
manifests in Neon Postgres instead of the host's ephemeral filesystem.
"""

from __future__ import annotations
# isort: skip_file

import os
from typing import Any


_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS auracraft_state (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
"""

_ASSET_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS auracraft_assets (
    asset_id TEXT PRIMARY KEY,
    content BYTEA NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
"""

# FIX(free-tier-5): keep custom VRM uploads within conservative Neon Free storage limits.
MAX_ASSET_BYTES = 25 * 1024 * 1024
MAX_TOTAL_ASSET_BYTES = 300 * 1024 * 1024


def database_enabled() -> bool:
    return bool(os.getenv("DATABASE_URL", "").strip())


def _connect():
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError("DATABASE_URL is required for Postgres persistence")
    import psycopg

    return psycopg.connect(database_url, connect_timeout=8)


def check_database() -> None:
    with _connect() as connection:
        connection.execute(_TABLE_SQL)
        connection.execute(_ASSET_TABLE_SQL)
        connection.execute("SELECT 1").fetchone()


def read_state(key: str) -> tuple[bool, Any]:
    with _connect() as connection:
        connection.execute(_TABLE_SQL)
        row = connection.execute(
            "SELECT value FROM auracraft_state WHERE key = %s", (key,)
        ).fetchone()
    return (row is not None, row[0] if row is not None else None)


def write_state(key: str, value: Any) -> None:
    from psycopg.types.json import Jsonb

    with _connect() as connection:
        connection.execute(_TABLE_SQL)
        connection.execute(
            """
            INSERT INTO auracraft_state (key, value)
            VALUES (%s, %s)
            ON CONFLICT (key) DO UPDATE
            SET value = EXCLUDED.value, updated_at = now()
            """,
            (key, Jsonb(value)),
        )


def list_state(prefix: str, limit: int = 50) -> list[tuple[str, Any, Any]]:
    with _connect() as connection:
        connection.execute(_TABLE_SQL)
        rows = connection.execute(
            """
            SELECT key, value, updated_at
            FROM auracraft_state
            WHERE key LIKE %s
            ORDER BY updated_at DESC
            LIMIT %s
            """,
            (f"{prefix}%", limit),
        ).fetchall()
    return [(row[0], row[1], row[2]) for row in rows]


def delete_state(key: str) -> bool:
    with _connect() as connection:
        connection.execute(_TABLE_SQL)
        cursor = connection.execute(
            "DELETE FROM auracraft_state WHERE key = %s", (key,)
        )
    return cursor.rowcount > 0



def write_asset(asset_id: str, content: bytes, content_type: str = "model/gltf-binary") -> None:
    if len(content) > MAX_ASSET_BYTES:
        raise ValueError("VRM asset exceeds the 25MB free-tier per-file limit")
    with _connect() as connection:
        connection.execute(_TABLE_SQL)
        connection.execute(_ASSET_TABLE_SQL)
        row = connection.execute(
            "SELECT COALESCE(SUM(size_bytes), 0) FROM auracraft_assets WHERE asset_id <> %s",
            (asset_id,),
        ).fetchone()
        current_bytes = int(row[0] if row else 0)
        if current_bytes + len(content) > MAX_TOTAL_ASSET_BYTES:
            raise RuntimeError("Neon free-tier VRM storage quota is full; remove an unused asset first")
        connection.execute(
            """
            INSERT INTO auracraft_assets (asset_id, content, content_type, size_bytes)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (asset_id) DO UPDATE
            SET content = EXCLUDED.content,
                content_type = EXCLUDED.content_type,
                size_bytes = EXCLUDED.size_bytes,
                updated_at = now()
            """,
            (asset_id, content, content_type, len(content)),
        )


def read_asset(asset_id: str) -> tuple[bool, bytes | None, str | None]:
    with _connect() as connection:
        connection.execute(_ASSET_TABLE_SQL)
        row = connection.execute(
            "SELECT content, content_type FROM auracraft_assets WHERE asset_id = %s",
            (asset_id,),
        ).fetchone()
    if row is None:
        return False, None, None
    return True, bytes(row[0]), str(row[1])
