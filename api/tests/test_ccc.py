"""S5-01 to S5-05: the CCC check against TEST_DATABASE_URL (D7), with fake providers at
`llm.PROVIDERS` (the provider boundary).

The candidate filter runs on a small hand-built database; the run is checked on the seed.
"""

import json
from collections.abc import Callable
from pathlib import Path

import psycopg
import pytest
from pydantic import BaseModel

from app import llm
from app.checks import ccc
from app.db.migrate import migrate
from app.db.seed import seed
from app.extract import load_cache
from tests.db import needs_db

Fake = Callable[[str, str, type[BaseModel]], str]
REASON = "Housing in Barangay 9 would sit on the planned evacuation centre site."


def verdict_for(input: str) -> str:
    conflict = "CDP-01" in input and "LDRRMP-02" in input
    return "Conflict" if conflict else "Compatible"


def classifying(sent: list[str] | None = None, fail_on: str | None = None) -> Fake:
    """Conflict only for CDP-01 x LDRRMP-02; raises for an input containing `fail_on`."""

    def fake(prompt: str, input: str, output_model: type[BaseModel]) -> str:
        if sent is not None:
            sent.append(input)
        if fail_on and fail_on in input:
            raise ConnectionError("one pair fails")
        return json.dumps({"verdict": verdict_for(input), "reason": REASON})

    return fake


def offline(prompt: str, input: str, output_model: type[BaseModel]) -> str:
    raise ConnectionError("tests never call a provider")


def use(monkeypatch: pytest.MonkeyPatch, fake: Fake) -> None:
    monkeypatch.setattr(llm, "PROVIDERS", [("Gemini", fake), ("OpenRouter", fake)])


@pytest.fixture
def seeded(empty_db: psycopg.Connection, tmp_path: Path) -> psycopg.Connection:
    migrate(empty_db)
    seed(empty_db, tmp_path)
    empty_db.execute("UPDATE plans SET status = 'confirmed' WHERE type = 'LCCAP'")
    empty_db.execute("UPDATE ppas SET status = 'confirmed'")
    return empty_db


def ppa_row(conn: psycopg.Connection, code: str) -> tuple[int, int | None, str | None, int]:
    row = conn.execute(
        "SELECT id, page_id, office, cost::bigint FROM ppas WHERE code = %s", (code,)
    ).fetchone()
    assert row
    return row


# --- the candidate filter (S5-01), on a hand-built database ---


@pytest.fixture
def tiny(empty_db: psycopg.Connection) -> psycopg.Connection:
    migrate(empty_db)
    empty_db.execute("INSERT INTO lgus VALUES ('1', 'City', 'city')")
    for type_ in ("CDP", "LDRRMP"):
        empty_db.execute(
            "INSERT INTO plans (lgu_psgc, type, title, period_start, period_end, status)"
            " VALUES ('1', %s, %s, 2027, 2030, 'confirmed')",
            (type_, type_),
        )
    return empty_db


def add(conn: psycopg.Connection, plan: str, code: str, **fields: object) -> None:
    row = {"sector": None, "barangays": [], "year_start": 2027, "year_end": None, **fields}
    conn.execute(
        "INSERT INTO ppas (plan_id, code, title, sector, barangays, year_start, year_end, status)"
        " SELECT id, %s, %s, %s, %s, %s, %s, 'confirmed' FROM plans WHERE type = %s",
        (
            code,
            code,
            row["sector"],
            row["barangays"],
            row["year_start"],
            row["year_end"],
            plan,
        ),
    )


def pairs(conn: psycopg.Connection) -> list[tuple[str | None, str | None]]:
    return [(a.code, b.code) for a, b in ccc.candidate_pairs(conn)]


@needs_db
def test_candidate_filter_follows_plan_barangay_sector_and_years(tiny: psycopg.Connection) -> None:
    # LDRRMP rows first, so ids don't follow the order of the pair.
    add(tiny, "LDRRMP", "L1", sector="housing")  # only a sector in common with C1, C2
    add(tiny, "LDRRMP", "L2", barangays=["9"], year_start=2031)  # years don't overlap with C3
    add(tiny, "LDRRMP", "L3", sector="housing", year_start=None)  # no years: never
    add(tiny, "CDP", "C1", sector="housing")
    add(tiny, "CDP", "C2", sector="housing")  # same plan as C1: never paired with it
    add(tiny, "CDP", "C3", barangays=["9"])
    # Order: plan type, then code, so the CDP PPA is `a` whatever the ids.
    assert pairs(tiny) == [("C1", "L1"), ("C2", "L1")]


@needs_db
def test_a_shared_barangay_and_a_missing_year_end_count(tiny: psycopg.Connection) -> None:
    add(tiny, "LDRRMP", "L1", barangays=["9", "10"], year_start=2028)
    add(tiny, "CDP", "C1", barangays=["10"], year_start=2027, year_end=2028)
    add(tiny, "CDP", "C2", barangays=["10"], year_start=2029)  # L1 has no year_end: 2028 only
    assert pairs(tiny) == [("C1", "L1")]


# --- the run (S5-02 to S5-04), on the seed ---


@needs_db
def test_one_call_per_pair_with_no_ids_office_or_cost(
    seeded: psycopg.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    sent: list[str] = []
    use(monkeypatch, classifying(sent))
    count, _ = ccc.find_ccc(seeded)

    assert count.check == "ccc"
    assert len(sent) == count.checked == len(ccc.candidate_pairs(seeded))
    _, _, office, cost = ppa_row(seeded, "CDP-01")
    one = next(i for i in sent if "CDP-01" in i and "LDRRMP-02" in i)
    assert one.index("CDP-01") < one.index("LDRRMP-02")
    assert "Barangay 9" in one
    assert office and office not in one
    assert str(cost) not in one
    lines = one.splitlines()
    assert [len(lines[i].split(" | ")) for i in (1, 4)] == [7, 7]  # no id field


@needs_db
def test_only_conflicts_are_found_and_it_carries_both_pages_and_the_barangay(
    seeded: psycopg.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    use(monkeypatch, classifying())
    count, found = ccc.find_ccc(seeded)

    assert count.found == 1
    assert len(found) == count.checked  # every verdict is stored
    assert {x.verdict for x in found} == {"Conflict", "Compatible"}
    conflicts = [f for f in found if f.verdict == "Conflict"]
    assert len(conflicts) == 1
    f = conflicts[0]
    a, a_page, _, _ = ppa_row(seeded, "CDP-01")
    b, b_page, _, _ = ppa_row(seeded, "LDRRMP-02")
    assert (f.check, f.ppa_a, f.ppa_b, f.created_by, f.reason) == ("ccc", a, b, "ai", REASON)
    assert f.barangay == "1199900009"
    assert f.page_ids == [a_page, b_page]


@needs_db
def test_a_pair_that_fails_or_has_no_reason_is_skipped(
    seeded: psycopg.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    use(monkeypatch, classifying())
    full_count, full = ccc.find_ccc(seeded)

    seeded.execute("DELETE FROM ai_cache")  # the first run's answers
    use(monkeypatch, classifying(fail_on="LDRRMP-02"))
    count, found = ccc.find_ccc(seeded)
    assert count.checked == full_count.checked
    assert count.found == 0
    assert 0 < len(found) < len(full)

    def blank(prompt: str, input: str, output_model: type[BaseModel]) -> str:
        return json.dumps({"verdict": "Conflict", "reason": "  "})

    seeded.execute("DELETE FROM ai_cache")
    use(monkeypatch, blank)
    count, found = ccc.find_ccc(seeded)
    assert (count.found, found) == (0, [])


# --- priming (S5-05) ---


@needs_db
def test_load_cache_primes_ccc_answers_for_a_run_with_providers_failing(
    seeded: psycopg.Connection, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    use(monkeypatch, offline)
    inputs = ccc.model_inputs(seeded)
    target = next(i for i in inputs if "CDP-01" in i and "LDRRMP-02" in i)
    file = tmp_path / "ccc.json"
    entry = {"input": target, "answer": {"verdict": "Conflict", "reason": REASON}}
    file.write_text(json.dumps([entry]), encoding="utf-8")

    assert load_cache.load_ccc(seeded, tmp_path / "missing.json") == 0
    assert load_cache.load_ccc(seeded, file) == 1

    count, found = ccc.find_ccc(seeded)
    assert (count.checked, count.found) == (len(inputs), 1)
    assert [f.verdict for f in found] == ["Conflict"]
