"""S0-03 and S0-05: migrations against the throwaway test database only (D7).

Reads TEST_DATABASE_URL and never DATABASE_URL. Each test drops and recreates the
public schema, so never point TEST_DATABASE_URL at a database you want to keep.
"""

import psycopg
import pytest

from app.db.migrate import migrate
from tests.db import needs_db

pytestmark = needs_db

TABLES = {"lgus", "plans", "pages", "ppas", "zones", "links", "findings", "ai_cache"}


@pytest.fixture
def conn(empty_db: psycopg.Connection) -> psycopg.Connection:
    return empty_db


def tables(conn: psycopg.Connection) -> set[str]:
    rows = conn.execute(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    ).fetchall()
    return {r[0] for r in rows}


def insert_ppa(conn: psycopg.Connection, sector: str, status: str = "draft") -> int:
    conn.execute(
        "INSERT INTO lgus (psgc_code, name, level) VALUES ('1199900000', 'City', 'city')"
        " ON CONFLICT DO NOTHING"
    )
    plan = conn.execute(
        "INSERT INTO plans (lgu_psgc, type, title, period_start, period_end, status)"
        " VALUES ('1199900000', 'CDP', 'CDP', 2026, 2028, 'confirmed') RETURNING id"
    ).fetchone()
    assert plan
    ppa = conn.execute(
        "INSERT INTO ppas (plan_id, title, sector, status) VALUES (%s, 'Drain', %s, %s)"
        " RETURNING id",
        (plan[0], sector, status),
    ).fetchone()
    assert ppa
    return ppa[0]


def test_001_applies_on_empty_db_and_second_run_is_noop(conn: psycopg.Connection) -> None:
    assert migrate(conn) == ["001_init.sql"]
    assert TABLES | {"schema_migrations"} <= tables(conn)
    assert conn.execute("SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'").fetchone()

    assert migrate(conn) == []
    count = conn.execute("SELECT count(*) FROM schema_migrations").fetchone()
    assert count == (1,)


def test_valid_ppa_is_accepted(conn: psycopg.Connection) -> None:
    migrate(conn)
    insert_ppa(conn, "flood_control", "confirmed")


@pytest.mark.parametrize(("sector", "status"), [("social", "draft"), ("housing", "pending")])
def test_invalid_sector_or_status_is_rejected(
    conn: psycopg.Connection, sector: str, status: str
) -> None:
    migrate(conn)
    with pytest.raises(psycopg.errors.CheckViolation):
        insert_ppa(conn, sector, status)


def test_editing_a_ppa_moves_updated_at(conn: psycopg.Connection) -> None:
    """D5: a reviewed finding is kept only while both PPAs are older than the review."""
    migrate(conn)
    ppa = insert_ppa(conn, "housing")
    conn.execute("UPDATE ppas SET updated_at = '2000-01-01' WHERE id = %s", (ppa,))
    conn.execute("UPDATE ppas SET cost = 1000 WHERE id = %s", (ppa,))
    row = conn.execute(
        "SELECT updated_at > '2000-01-02' FROM ppas WHERE id = %s", (ppa,)
    ).fetchone()
    assert row == (True,)
