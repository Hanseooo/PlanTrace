"""S1-02 to S1-07: the seed command against the throwaway test database only (D7).

The PDF tests read the committed seed/pdfs/ and need no database. The others use the
`empty_db` fixture (conftest.py) and seed with PDFs written to tmp_path, so pytest never
rewrites the committed PDFs.
"""

import json
from collections import Counter
from pathlib import Path
from typing import Any

import psycopg
import pymupdf
import pytest

from app.db.migrate import migrate
from app.db.seed import PDF_DIR, SEED_DIR, load_city, page_texts, render_pdfs, seed
from tests.db import needs_db

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


def test_committed_pdfs_match_city_json(tmp_path: Path) -> None:
    """A city.json edit without a seed rerun leaves stale PDFs; rerun the seed to fix."""
    for name, texts in render_pdfs(load_city(), tmp_path).items():
        committed = page_texts((PDF_DIR / f"{name.lower()}.pdf").read_bytes())
        assert committed == texts, f"seed/pdfs/{name.lower()}.pdf is stale"


@pytest.fixture
def conn(empty_db: psycopg.Connection) -> psycopg.Connection:
    migrate(empty_db)
    return empty_db


@needs_db
def test_seed_loads_4_confirmed_plans_in_order(conn: psycopg.Connection, tmp_path: Path) -> None:
    seed(conn, tmp_path)
    rows = conn.execute("SELECT id, type, status FROM plans ORDER BY id").fetchall()
    assert rows == [
        (1, "CLUP", "confirmed"),
        (2, "CDP", "confirmed"),
        (3, "LDRRMP", "confirmed"),
        (4, "AIP", "confirmed"),
    ]


@needs_db
def test_seed_loads_the_city_and_12_barangays(conn: psycopg.Connection, tmp_path: Path) -> None:
    seed(conn, tmp_path)
    rows = conn.execute("SELECT level, count(*) FROM lgus GROUP BY level ORDER BY level").fetchall()
    assert rows == [("barangay", 12), ("city", 1)]


@needs_db
def test_every_ppa_and_zone_points_at_its_page(conn: psycopg.Connection, tmp_path: Path) -> None:
    seed(conn, tmp_path)
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
    wrong_zone_page = conn.execute(
        "SELECT count(*) FROM zones z JOIN pages g ON g.id = z.page_id"
        " JOIN lgus l ON l.psgc_code = z.barangay"
        " WHERE g.plan_id <> z.plan_id OR strpos(g.text, l.name) = 0"
    ).fetchone()
    assert wrong_zone_page == (0,)


@needs_db
def test_every_ppa_is_confirmed_and_every_aip_parent_has_a_manual_link(
    conn: psycopg.Connection,
    tmp_path: Path,
) -> None:
    seed(conn, tmp_path)
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
    tmp_path: Path,
) -> None:
    seed(conn, tmp_path)
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
def test_lccap_is_never_loaded(conn: psycopg.Connection, tmp_path: Path) -> None:
    seed(conn, tmp_path)
    assert conn.execute("SELECT count(*) FROM plans WHERE type = 'LCCAP'").fetchone() == (0,)
    assert conn.execute("SELECT count(*) FROM ppas WHERE code LIKE 'LCCAP-%'").fetchone() == (0,)


@needs_db
def test_second_seed_gives_same_state_and_keeps_ai_cache(
    conn: psycopg.Connection, tmp_path: Path
) -> None:
    seed(conn, tmp_path)
    first = conn.execute(COUNTS).fetchone()
    # A rehearsal's leftovers: a finding and a cached AI answer.
    conn.execute(
        'INSERT INTO findings ("check", ppa_a, reason, created_by)'
        " VALUES ('orphan', 1, 'x', 'rule')"
    )
    conn.execute("INSERT INTO ai_cache (key, response) VALUES ('k', 'cached')")
    seed(conn, tmp_path)
    assert conn.execute(COUNTS).fetchone() == first
    assert conn.execute("SELECT count(*) FROM findings").fetchone() == (0,)
    assert conn.execute("SELECT response FROM ai_cache WHERE key = 'k'").fetchone() == ("cached",)
    plan_ids = conn.execute("SELECT array_agg(id ORDER BY id) FROM plans").fetchone()
    assert plan_ids == ([1, 2, 3, 4],)


# S1-08 to S1-10: the planted findings and the answer key.

KEY = json.loads((SEED_DIR / "expected_findings.json").read_text(encoding="utf-8"))
DUPLICATE_MIN = 0.45  # each planted duplicate pair scores at least this
OTHER_MAX = 0.3  # every other cross-plan pair sharing a barangay or sector scores under this


def _city_ppas() -> dict[str, dict[str, Any]]:
    """Every PPA in city.json by code, with its plan type and page number."""
    return {
        p["code"]: {**p, "plan_type": plan["type"], "page_no": page_no}
        for plan in load_city()["plans"]
        for page_no, page in enumerate(plan["pages"], start=1)
        for p in page.get("ppas", [])
    }


def _key_codes(check: str) -> list[list[str]]:
    return [[p["code"] for p in f["ppas"]] for f in KEY["findings"] if f["check"] == check]


def test_answer_key_lists_the_8_planted_findings_by_code() -> None:
    checks = [f["check"] for f in KEY["findings"]]
    assert sorted(checks) == sorted(["duplicate"] * 3 + ["orphan"] * 2 + ["zone"] + ["ccc"] * 2)
    ppas = _city_ppas()
    for finding in KEY["findings"]:
        parent = [finding["suggested_parent"]] if "suggested_parent" in finding else []
        for ref in finding["ppas"] + parent:
            assert set(ref) == {"plan_type", "code"}, "by plan type and code, never by id"
            assert ppas[ref["code"]]["plan_type"] == ref["plan_type"]
    assert [f["verdict"] for f in KEY["findings"] if f["check"] == "ccc"] == ["Conflict"] * 2


def test_plans_have_the_planned_sizes() -> None:
    sizes = Counter(p["plan_type"] for p in _city_ppas().values())
    assert sizes == {"CDP": 10, "LDRRMP": 5, "AIP": 10, "LCCAP": 3}


def test_answer_key_lccap_ppas_match_city_json_with_every_field() -> None:
    fields = ("code", "title", "description", "office", "sector", "barangays", "cost")
    fields += ("year_start", "year_end", "page_no")
    expected = [
        {f: p[f] for f in fields} for p in _city_ppas().values() if p["plan_type"] == "LCCAP"
    ]
    assert KEY["lccap_ppas"] == expected
    assert len(expected) == 3
    assert all(value not in (None, "", []) for row in expected for value in row.values())


def test_ccc_conflict_pairs_pass_the_candidate_filter() -> None:
    # AC-20 sends only pairs that share a barangay or sector with overlapping years.
    ppas = _city_ppas()
    for code_a, code_b in _key_codes("ccc"):
        a, b = ppas[code_a], ppas[code_b]
        assert set(a["barangays"]) & set(b["barangays"]) or a["sector"] == b["sector"]
        assert a["year_start"] <= b["year_end"] and b["year_start"] <= a["year_end"]


def test_no_aip_line_copies_its_parent_title() -> None:
    ppas = _city_ppas()
    for p in ppas.values():
        if p.get("parent"):
            assert p["title"] != ppas[p["parent"]]["title"], p["code"]


@pytest.fixture
def seeded(conn: psycopg.Connection, tmp_path: Path) -> psycopg.Connection:
    """The seeded city plus the LCCAP PPAs (the live upload) in a temp table, all_ppas."""
    seed(conn, tmp_path)
    conn.execute(
        "CREATE TEMP TABLE all_ppas AS"
        " SELECT pl.type AS plan_type, p.code, p.title, p.sector, p.barangays,"
        " p.year_start, p.year_end FROM ppas p JOIN plans pl ON pl.id = p.plan_id"
    )
    with conn.cursor() as cur:
        cur.executemany(
            "INSERT INTO all_ppas VALUES ('LCCAP', %s, %s, %s, %s, %s, %s)",
            [
                (p["code"], p["title"], p["sector"], p["barangays"], p["year_start"], p["year_end"])
                for p in KEY["lccap_ppas"]
            ],
        )
    return conn


@needs_db
def test_exactly_the_key_orphans_have_no_confirmed_link(seeded: psycopg.Connection) -> None:
    rows = seeded.execute(
        "SELECT p.code FROM ppas p JOIN plans pl ON pl.id = p.plan_id"
        " WHERE pl.type = 'AIP' AND NOT EXISTS (SELECT 1 FROM links l"
        "  WHERE l.child_ppa_id = p.id AND l.status = 'confirmed')"
        " ORDER BY p.code"
    ).fetchall()
    assert [r[0] for r in rows] == sorted(c for (c,) in _key_codes("orphan"))


@needs_db
def test_exactly_one_ppa_sits_in_a_zone_that_forbids_its_sector(
    seeded: psycopg.Connection,
) -> None:
    rows = seeded.execute(
        "SELECT p.code, z.barangay, p.sector FROM all_ppas p"
        " JOIN zones z ON z.barangay = ANY(p.barangays)"
        " WHERE p.sector = ANY(z.forbidden_sectors)"
    ).fetchall()
    (zone,) = [f for f in KEY["findings"] if f["check"] == "zone"]
    assert rows == [(zone["ppas"][0]["code"], zone["barangay"], zone["sector"])]


@needs_db
def test_planted_duplicates_have_similar_titles(seeded: psycopg.Connection) -> None:
    for code_a, code_b in _key_codes("duplicate"):
        row = seeded.execute(
            "SELECT similarity(a.title, b.title) FROM all_ppas a, all_ppas b"
            " WHERE a.code = %s AND b.code = %s",
            (code_a, code_b),
        ).fetchone()
        assert row and row[0] >= DUPLICATE_MIN, (code_a, code_b, row)


@needs_db
def test_no_other_cross_plan_pair_has_similar_titles(seeded: psycopg.Connection) -> None:
    planted = {frozenset(pair) for pair in _key_codes("duplicate")}
    rows = seeded.execute(
        "SELECT a.code, b.code, similarity(a.title, b.title) FROM all_ppas a"
        " JOIN all_ppas b ON a.code < b.code AND a.plan_type <> b.plan_type"
        " WHERE (a.barangays && b.barangays OR a.sector = b.sector)"
    ).fetchall()
    assert len(rows) > 20, "expected many cross-plan pairs sharing a barangay or sector"
    too_similar = [r for r in rows if frozenset(r[:2]) not in planted and r[2] >= OTHER_MAX]
    assert too_similar == []
