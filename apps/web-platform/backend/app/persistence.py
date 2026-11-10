"""Small Postgres-backed JSON state store for ephemeral free hosting.

The app keeps its JSON-file adapter for local development and tests. When
DATABASE_URL is configured, this module persists character records and render
manifests in Neon Postgres instead of the host's ephemeral filesystem.
"""

from __future__ import annotations

import os
from typing import Any


_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS auracraft_state (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
"""


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
