"""S1-02 to S1-07: the seed command against the throwaway test database only (D7).

The PDF test reads the committed seed/pdfs/ and needs no database. The others read
TEST_DATABASE_URL and never DATABASE_URL. They drop and recreate the public schema,
so never point TEST_DATABASE_URL at a database you want to keep.
"""

import os
from collections.abc import Iterator

import psycopg
import pymupdf
import pytest

from app.db.migrate import migrate
from app.db.seed import PDF_DIR, seed

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")

needs_db = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="TEST_DATABASE_URL is unset; database tests skipped (D7: tests never use DATABASE_URL)",
)

# PSGC of Barangay 9 (seed/fixtures: 11999000NN for Barangay NN).
BARANGAY_9 = "1199900009"

COUNTS = """
SELECT (SELECT count(*) FROM lgus), (SELECT count(*) FROM plans), (SELECT count(*) FROM pages),
       (SELECT count(*) FROM ppas), (SELECT count(*) FROM zones), (SELECT count(*) FROM links)
"""


def test_each_plan_pdf_has_2_to_5_pages() -> None:
    names = sorted(p.name for p in PDF_DIR.glob("*.pdf"))
    assert names == ["aip.pdf", "cdp.pdf", "clup.pdf", "lccap.pdf", "ldrrmp.pdf"]
    for name in names:
        with pymupdf.open(PDF_DIR / name) as doc:
            assert 2 <= doc.page_count <= 5, name


@pytest.fixture
def conn() -> Iterator[psycopg.Connection]:
    assert TEST_DATABASE_URL
    with psycopg.connect(TEST_DATABASE_URL, autocommit=True) as conn:
        conn.execute("DROP SCHEMA public CASCADE")
        conn.execute("CREATE SCHEMA public")
        migrate(conn)
        yield conn


@needs_db
def test_seed_loads_4_confirmed_plans_in_order(conn: psycopg.Connection) -> None:
    seed(conn)
    rows = conn.execute("SELECT id, type, status FROM plans ORDER BY id").fetchall()
    assert rows == [
        (1, "CLUP", "confirmed"),
        (2, "CDP", "confirmed"),
        (3, "LDRRMP", "confirmed"),
        (4, "AIP", "confirmed"),
    ]


@needs_db
def test_seed_loads_the_city_and_12_barangays(conn: psycopg.Connection) -> None:
    seed(conn)
    rows = conn.execute("SELECT level, count(*) FROM lgus GROUP BY level ORDER BY level").fetchall()
    assert rows == [("barangay", 12), ("city", 1)]


@needs_db
def test_every_ppa_and_zone_points_at_its_page(conn: psycopg.Connection) -> None:
    seed(conn)
    missing = conn.execute(
        "SELECT (SELECT count(*) FROM ppas WHERE page_id IS NULL)"
        " + (SELECT count(*) FROM zones WHERE page_id IS NULL)"
    ).fetchone()
    assert missing == (0,)
    # The page holds the row: its code (PPA) or barangay name (zone) is in the page text.
    wrong_page = conn.execute(
        "SELECT count(*) FROM ppas p JOIN pages g ON g.id = p.page_id"
        " WHERE g.plan_id <> p.plan_id OR strpos(g.text, p.code) = 0"
    ).fetchone()
    assert wrong_page == (0,)


@needs_db
def test_every_ppa_is_confirmed_and_every_aip_parent_has_a_manual_link(
    conn: psycopg.Connection,
) -> None:
    seed(conn)
    assert conn.execute("SELECT count(*) FROM ppas WHERE status <> 'confirmed'").fetchone() == (0,)
    links = conn.execute(
        "SELECT c.code, p.code, l.source, l.status FROM links l"
        " JOIN ppas c ON c.id = l.child_ppa_id JOIN ppas p ON p.id = l.parent_ppa_id"
        " ORDER BY c.code"
    ).fetchall()
    assert links, "expected AIP-to-CDP links"
    for child, parent, source, status in links:
        assert child.startswith("AIP-") and parent.startswith("CDP-")
        assert (source, status) == ("manual", "confirmed")


@needs_db
def test_barangay_9_forbids_housing_and_barangay_2_allows_industrial(
    conn: psycopg.Connection,
) -> None:
    seed(conn)
    rows = conn.execute(
        "SELECT barangay, hazard, forbidden_sectors FROM zones"
        " WHERE barangay IN (%s, '1199900002') ORDER BY barangay",
        (BARANGAY_9,),
    ).fetchall()
    (b2, _, b2_forbidden), (b9, b9_hazard, b9_forbidden) = rows
    assert (b2, b9) == ("1199900002", BARANGAY_9)
    assert "industrial" not in b2_forbidden
    assert b9_hazard == "high flood susceptibility"
    assert "housing" in b9_forbidden
    assert conn.execute("SELECT count(DISTINCT barangay) FROM zones").fetchone() == (12,)


@needs_db
def test_lccap_is_never_loaded(conn: psycopg.Connection) -> None:
    seed(conn)
    assert conn.execute("SELECT count(*) FROM plans WHERE type = 'LCCAP'").fetchone() == (0,)
    assert conn.execute("SELECT count(*) FROM ppas WHERE code LIKE 'LCCAP-%'").fetchone() == (0,)


@needs_db
def test_second_seed_gives_same_state_and_keeps_ai_cache(conn: psycopg.Connection) -> None:
    seed(conn)
    first = conn.execute(COUNTS).fetchone()
    # A rehearsal's leftovers: a finding and a cached AI answer.
    conn.execute(
        'INSERT INTO findings ("check", ppa_a, reason, created_by)'
        " VALUES ('orphan', 1, 'x', 'rule')"
    )
    conn.execute("INSERT INTO ai_cache (key, response) VALUES ('k', 'cached')")
    seed(conn)
    assert conn.execute(COUNTS).fetchone() == first
    assert conn.execute("SELECT count(*) FROM findings").fetchone() == (0,)
    assert conn.execute("SELECT response FROM ai_cache WHERE key = 'k'").fetchone() == ("cached",)
    plan_ids = conn.execute("SELECT array_agg(id ORDER BY id) FROM plans").fetchone()
    assert plan_ids == ([1, 2, 3, 4],)
