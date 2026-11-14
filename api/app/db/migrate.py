"""Apply unapplied migrations in number order.

Usage: uv run python -m app.db.migrate [DATABASE_URL]
Each file runs in its own transaction together with its schema_migrations row,
so a failed file leaves nothing behind and a second run is a no-op.
"""

import sys
from pathlib import Path

import psycopg

from app.db import connect

MIGRATIONS_DIR = Path(__file__).parent / "migrations"

CREATE_SCHEMA_MIGRATIONS = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
)
"""


def migrate(conn: psycopg.Connection) -> list[str]:
    """Apply every migration not yet in schema_migrations. Returns the files applied."""
    with conn.transaction():
        conn.execute(CREATE_SCHEMA_MIGRATIONS)
        applied = {row[0] for row in conn.execute("SELECT version FROM schema_migrations")}
    # Files are named NNN_name.sql, so name order is number order.
    pending = [p for p in sorted(MIGRATIONS_DIR.glob("*.sql")) if p.name not in applied]
    for path in pending:
        with conn.transaction():
            conn.execute(path.read_text(encoding="utf-8").encode())
            conn.execute("INSERT INTO schema_migrations (version) VALUES (%s)", (path.name,))
    return [p.name for p in pending]


def main() -> None:
    url = sys.argv[1] if len(sys.argv) > 1 else None
    with connect(url) as conn:
        applied = migrate(conn)
    print(f"Applied: {', '.join(applied)}" if applied else "Nothing to apply")


if __name__ == "__main__":
    main()
