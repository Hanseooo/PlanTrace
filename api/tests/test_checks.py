"""S4-04 to S4-11, S4-14, S4-22: the duplicate and zone checks, storing a run (D5), the
findings list, review and the latest run, against the seeded TEST_DATABASE_URL (D7).

The LCCAP comes in as in J2: uploaded from the primed cache (seed/ai_cache/lccap.json),
then confirmed. Providers are fakes that raise, so no test reaches the network.
Orphan findings are #39's: tests/test_orphan.py asserts them.
"""

import json
from collections.abc import Iterator
from pathlib import Path

import psycopg
import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter

from app import llm
from app.checks import findings
from app.checks.findings import NewFinding
from app.db import get_conn
from app.db.migrate import migrate
from app.db.seed import SEED_DIR, seed
from app.extract import load_cache
from app.extract.routes import get_connector
from app.main import app
from app.models import CheckCount, CheckRunResult, Finding, Plan, Ppa
from tests.db import TEST_DATABASE_URL, needs_db
from tests.test_extract import offline, open_test_db, upload

CDP = 2
EXPECTED = json.loads((SEED_DIR / "expected_findings.json").read_text(encoding="utf-8"))
RULE_CHECKS = ("duplicate", "zone")

Key = tuple[str, tuple[tuple[str, str | None], ...]]


@pytest.fixture
def client(
    empty_db: psycopg.Connection, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Iterator[TestClient]:
    """The seeded city with the LCCAP uploaded from the primed cache, left `ready`."""
    migrate(empty_db)
    seed(empty_db, tmp_path)
    with open_test_db() as conn:
        load_cache.load(conn)
    monkeypatch.setattr(llm, "PROVIDERS", [("Gemini", offline), ("OpenRouter", offline)])

    def test_conn() -> Iterator[psycopg.Connection]:
        with open_test_db() as c:
            yield c

    app.dependency_overrides[get_conn] = test_conn
    app.dependency_overrides[get_connector] = lambda: open_test_db
    try:
        test_client = TestClient(app)
        lccap = Plan.model_validate(upload().json())
        assert test_client.get(f"/plans/{lccap.id}").json()["status"] == "ready"
        yield test_client
    finally:
        app.dependency_overrides.pop(get_conn)
        app.dependency_overrides.pop(get_connector)


@pytest.fixture
def confirmed(client: TestClient) -> TestClient:
    """J3 done: the LCCAP confirmed."""
    plans = TypeAdapter(list[Plan]).validate_python(client.get("/plans").json())
    lccap = next(p.id for p in plans if p.type == "LCCAP")
    assert client.post(f"/plans/{lccap}/confirm").status_code == 200
    return client


def run(client: TestClient) -> CheckRunResult:
    response = client.post("/checks/run")
    assert response.status_code == 200, response.text
    return CheckRunResult.model_validate(response.json())


def list_findings(client: TestClient) -> list[Finding]:
    response = client.get("/findings")
    assert response.status_code == 200, response.text
    return TypeAdapter(list[Finding]).validate_python(response.json())


def key(f: Finding) -> Key:
    ppas = [f.ppa_a] + ([f.ppa_b] if f.ppa_b else [])
    return f.check, tuple((p.plan_type, p.code) for p in ppas)


def by_code(client: TestClient, check: str, code: str) -> Finding:
    found = [f for f in list_findings(client) if f.check == check and key(f)[1][0][1] == code]
    assert len(found) == 1, found
    return found[0]


def counts(result: CheckRunResult) -> dict[str, tuple[int, int]]:
    return {c.check: (c.checked, c.found) for c in result.counts}


@needs_db
def test_run_finds_the_answer_keys_duplicates_and_zone_finding(confirmed: TestClient) -> None:
    assert confirmed.get("/checks/latest").json() is None

    result = run(confirmed)

    got = counts(result)
    assert set(got) == {"duplicate", "orphan", "ccc", "zone"}
    # Hand-counted on seed/city.json: 51 PPA pairs of different plans sharing a barangay or
    # sector; every barangay has a zone row, so zone checks each (PPA, barangay): 36.
    assert got["duplicate"] == (51, 3)
    assert got["zone"] == (36, 1)
    assert got["ccc"] == (0, 0)

    rule_findings = [f for f in list_findings(confirmed) if f.check in RULE_CHECKS]
    expected = {
        (e["check"], tuple((p["plan_type"], p["code"]) for p in e["ppas"]))
        for e in EXPECTED["findings"]
        if e["check"] in RULE_CHECKS
    }
    assert {key(f) for f in rule_findings} == expected
    assert len(rule_findings) == len(expected)
    for f in rule_findings:
        assert f.page_ids, f
        assert (f.created_by, f.status, f.note) == ("rule", "suggested", None)

    barangays = {key(f)[1][0][1]: f.barangay for f in rule_findings}
    assert barangays == {
        "CDP-02": "1199900005",
        "LDRRMP-04": "1199900007",  # lowest shared of 7 and 10
        "CDP-06": "1199900012",
        "CDP-01": "1199900009",
    }

    drainage = by_code(confirmed, "duplicate", "CDP-02")
    assert drainage.reason == (
        "Similar titles in CDP and LDRRMP, both in Barangay 5. "
        "Cost differs by ₱2,500,000. Years: 2027 vs 2028."
    )
    assert drainage.ppa_b and drainage.ppa_b.code == "LDRRMP-01"
    assert set(drainage.page_ids) == {drainage.ppa_a.page_id, drainage.ppa_b.page_id}

    zone = next(f for f in rule_findings if f.check == "zone")
    assert zone.ppa_b is None
    assert zone.reason == (
        "Barangay 9 is a flood-prone zone (high flood susceptibility) in the CLUP, "
        "where housing is not an allowed use."
    )
    assert len(zone.page_ids) == 2 and zone.ppa_a.page_id in zone.page_ids

    # Similarity 0.22 on the seed: below the threshold.
    assert all({"CDP-10", "LDRRMP-04"} - {c for _, c in key(f)[1]} for f in rule_findings)

    latest = confirmed.get("/checks/latest")
    assert latest.status_code == 200
    assert CheckRunResult.model_validate(latest.json()) == result


@needs_db
def test_unconfirmed_lccap_is_not_checked(client: TestClient) -> None:
    got = counts(run(client))
    assert got["duplicate"] == (34, 2)
    assert got["zone"] == (32, 1)
    codes = {c for f in list_findings(client) for _, c in key(f)[1]}
    assert not any(c and c.startswith("LCCAP") for c in codes)


@needs_db
def test_same_project_twice_in_one_plan_is_not_a_duplicate(confirmed: TestClient) -> None:
    twin = confirmed.post(
        f"/plans/{CDP}/ppas",
        json={
            "code": "CDP-11",
            "title": "Drainage improvement, Barangay 5",
            "sector": "drainage",
            "barangays": ["1199900005"],
        },
    )
    assert twin.status_code == 200, twin.text
    run(confirmed)
    pairs = [key(f)[1] for f in list_findings(confirmed) if f.check == "duplicate"]
    assert (("CDP", "CDP-02"), ("CDP", "CDP-11")) not in pairs
    assert all(a[0] != b[0] for a, b in pairs)


@needs_db
def test_rerun_keeps_a_review_until_a_ppa_is_edited(confirmed: TestClient) -> None:
    run(confirmed)
    drainage = by_code(confirmed, "duplicate", "CDP-02")
    response = confirmed.patch(
        f"/findings/{drainage.id}", json={"status": "rejected", "note": "Different phases"}
    )
    assert response.status_code == 200, response.text

    run(confirmed)
    kept = by_code(confirmed, "duplicate", "CDP-02")
    assert (kept.status, kept.note) == ("rejected", "Different phases")

    edit = confirmed.patch(f"/ppas/{kept.ppa_a.id}", json={"office": "City Planning Office"})
    assert edit.status_code == 200, edit.text
    run(confirmed)
    reopened = by_code(confirmed, "duplicate", "CDP-02")
    assert (reopened.status, reopened.note) == ("suggested", "Different phases")


@needs_db
def test_a_failed_run_keeps_the_old_findings_and_latest_run(confirmed: TestClient) -> None:
    first = run(confirmed)
    before = list_findings(confirmed)
    ppa = Ppa.model_validate(confirmed.get(f"/plans/{CDP}/ppas").json()[0])
    good = NewFinding("zone", ppa.id, None, None, "A new finding", [], "rule")
    bad = NewFinding("zone", 999999, None, None, "A PPA that doesn't exist", [], "rule")

    with open_test_db() as conn, pytest.raises(psycopg.errors.ForeignKeyViolation):
        findings.store_run(conn, [CheckCount(check="zone", checked=9, found=2)], [good, bad])

    assert list_findings(confirmed) == before
    assert CheckRunResult.model_validate(confirmed.get("/checks/latest").json()) == first


def reviewed_at(finding_id: int) -> object:
    assert TEST_DATABASE_URL
    with psycopg.connect(TEST_DATABASE_URL) as conn:
        row = conn.execute("SELECT reviewed_at FROM findings WHERE id = %s", (finding_id,))
        found = row.fetchone()
    assert found
    return found[0]


@needs_db
def test_patch_reviews_and_notes_a_finding(confirmed: TestClient) -> None:
    run(confirmed)
    target = by_code(confirmed, "zone", "CDP-01")

    response = confirmed.patch(f"/findings/{target.id}", json={"status": "confirmed"})
    assert response.status_code == 200, response.text
    assert Finding.model_validate(response.json()) == target.model_copy(
        update={"status": "confirmed"}
    )
    assert reviewed_at(target.id) is not None

    noted = confirmed.patch(f"/findings/{target.id}", json={"note": " Ask the CPDO "}).json()
    assert (noted["status"], noted["note"]) == ("confirmed", "Ask the CPDO")
    cleared = confirmed.patch(f"/findings/{target.id}", json={"note": "   "}).json()
    assert cleared["note"] is None

    reopened = confirmed.patch(f"/findings/{target.id}", json={"status": "suggested"}).json()
    assert reopened["status"] == "suggested"
    assert reviewed_at(target.id) is None
    assert by_code(confirmed, "zone", "CDP-01") == Finding.model_validate(reopened)


@needs_db
def test_patch_on_an_unknown_finding_is_404(confirmed: TestClient) -> None:
    response = confirmed.patch("/findings/999999", json={"status": "confirmed"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Finding not found"


# ---- S5-06 to S5-09: CCC storage, matrix and export (findings inserted without the AI) ----

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def ppa_id(plan_type: str, code: str) -> int:
    with open_test_db() as conn:
        row = conn.execute(
            "SELECT p.id FROM ppas p JOIN plans pl ON pl.id = p.plan_id "
            "WHERE pl.type = %s AND p.code = %s",
            (plan_type, code),
        ).fetchone()
    assert row
    return row[0]


def ccc_finding(a: tuple[str, str], b: tuple[str, str], verdict: str) -> NewFinding:
    ids = (ppa_id(*a), ppa_id(*b))
    with open_test_db() as conn:
        pages = [
            r[0]
            for r in conn.execute(
                "SELECT page_id FROM ppas WHERE id = ANY(%s) ORDER BY id", (list(ids),)
            )
        ]
    return NewFinding(
        "ccc",
        ids[0],
        ids[1],
        "1199900009",
        f"{verdict} reason",
        pages,
        "ai",
        verdict,  # type: ignore[arg-type]
    )


CONFLICT = (("CDP", "CDP-01"), ("LDRRMP", "LDRRMP-02"), "Conflict")
COMPLEMENTARY = (("CDP", "CDP-02"), ("LDRRMP", "LDRRMP-01"), "Complementary")
TO_REJECT = (("CDP", "CDP-05"), ("LDRRMP", "LDRRMP-03"), "Conflict")


def store_ccc(*pairs: tuple[tuple[str, str], tuple[str, str], str]) -> None:
    with open_test_db() as conn:
        findings.store_run(
            conn,
            [CheckCount(check="ccc", checked=len(pairs), found=0)],
            [ccc_finding(*p) for p in pairs],
        )


def ccc_ids(client: TestClient, a: str, b: str) -> int:
    pair = {a, b}
    found = [
        f
        for f in list_findings(client)
        if f.check == "ccc" and f.ppa_b and {f.ppa_a.code, f.ppa_b.code} == pair
    ]
    assert len(found) == 1, found
    return found[0].id


@pytest.fixture
def ccc_stored(confirmed: TestClient) -> TestClient:
    store_ccc(CONFLICT, COMPLEMENTARY, TO_REJECT)
    reject = confirmed.patch(
        f"/findings/{ccc_ids(confirmed, 'CDP-05', 'LDRRMP-03')}", json={"status": "rejected"}
    )
    assert reject.status_code == 200, reject.text
    return confirmed


@needs_db
def test_findings_list_shows_only_ccc_conflicts(ccc_stored: TestClient) -> None:
    ccc = [f for f in list_findings(ccc_stored) if f.check == "ccc"]
    assert sorted((f.ppa_a.code, f.verdict) for f in ccc) == [
        ("CDP-01", "Conflict"),
        ("CDP-05", "Conflict"),
    ]


@needs_db
def test_ccc_matrix_lists_confirmed_ppas_and_every_stored_cell(ccc_stored: TestClient) -> None:
    matrix = ccc_stored.get("/ccc").json()
    assert len(matrix["ppas"]) == 28
    codes = [p["code"] for p in matrix["ppas"]]
    assert codes[0] == "AIP-01" and codes.index("CDP-01") < codes.index("CDP-02")
    assert codes.index("CDP-07") < codes.index("LDRRMP-01")
    assert matrix["ppas"][codes.index("CDP-01")]["plan_type"] == "CDP"
    cells = {(c["ppa_a"], c["ppa_b"]): (c["verdict"], c["status"]) for c in matrix["cells"]}
    assert cells == {
        (ppa_id("CDP", "CDP-01"), ppa_id("LDRRMP", "LDRRMP-02")): ("Conflict", "suggested"),
        (ppa_id("CDP", "CDP-02"), ppa_id("LDRRMP", "LDRRMP-01")): ("Complementary", "suggested"),
        (ppa_id("CDP", "CDP-05"), ppa_id("LDRRMP", "LDRRMP-03")): ("Conflict", "rejected"),
    }
    assert all(c["page_ids"] and c["reason"] for c in matrix["cells"])


@needs_db
def test_ccc_matrix_before_any_run_has_no_cells(confirmed: TestClient) -> None:
    assert confirmed.get("/ccc").json()["cells"] == []


@needs_db
def test_ccc_matrix_leaves_out_an_unconfirmed_plan(client: TestClient) -> None:
    assert len(client.get("/ccc").json()["ppas"]) == 25


@needs_db
def test_rerun_carries_a_ccc_review_only_for_the_same_verdict(confirmed: TestClient) -> None:
    store_ccc(CONFLICT, COMPLEMENTARY)
    conflict = ccc_ids(confirmed, "CDP-01", "LDRRMP-02")
    done = confirmed.patch(f"/findings/{conflict}", json={"status": "confirmed", "note": "Seen"})
    assert done.status_code == 200, done.text

    store_ccc(CONFLICT, COMPLEMENTARY)
    kept = by_code(confirmed, "ccc", "CDP-01")
    assert (kept.status, kept.note) == ("confirmed", "Seen")

    store_ccc((CONFLICT[0], CONFLICT[1], "Compatible"), COMPLEMENTARY)
    cells = confirmed.get("/ccc").json()["cells"]
    changed = next(c for c in cells if c["ppa_a"] == ppa_id("CDP", "CDP-01"))
    assert (changed["verdict"], changed["status"]) == ("Compatible", "suggested")
    with open_test_db() as conn:
        row = conn.execute(
            "SELECT note, reviewed_at FROM findings WHERE ppa_a = %s",
            (ppa_id("CDP", "CDP-01"),),
        ).fetchone()
    assert row == ("Seen", None)


def sheet_rows(client: TestClient, name: str) -> list[list[object]]:
    from io import BytesIO

    from openpyxl import load_workbook

    response = client.get("/ccc/export")
    assert response.status_code == 200
    assert response.headers["content-type"] == XLSX
    assert 'filename="ccc_export.xlsx"' in response.headers["content-disposition"]
    book = load_workbook(BytesIO(response.content))
    assert book.sheetnames == ["CCC matrix", "Pairs"]
    return [list(r) for r in book[name].iter_rows(values_only=True)]


CDP_01 = "CDP CDP-01: Socialized housing project, Barangay 9"
LDRRMP_02 = "LDRRMP LDRRMP-02: Evacuation centre construction"


def grid_cell(rows: list[list[object]], row_label: str, col_label: str) -> object:
    header = next(r for r in rows if r[1:] and col_label in r)
    line = next(r for r in rows if r[0] == row_label)
    return line[header.index(col_label)]


@needs_db
def test_export_matrix_marks_suggested_and_blanks_rejected(ccc_stored: TestClient) -> None:
    rows = sheet_rows(ccc_stored, "CCC matrix")
    assert rows[0][0] == "City of Sampaguita CCC matrix. Synthetic demo data."
    assert grid_cell(rows, CDP_01, LDRRMP_02) == "C*"
    assert grid_cell(rows, LDRRMP_02, CDP_01) == "C*"
    assert (
        grid_cell(
            rows,
            "CDP CDP-02: Drainage improvement, Barangay 5",
            "LDRRMP LDRRMP-01: Drainage improvement works, Barangay 5",
        )
        == "Cp*"
    )
    rejected = [r for r in rows if r[0] and str(r[0]).startswith("CDP CDP-05")][0]
    assert not any(rejected[1:])
    assert any(r[0] == "* AI suggestion, not yet reviewed" for r in rows)

    conflict = ccc_ids(ccc_stored, "CDP-01", "LDRRMP-02")
    ccc_stored.patch(f"/findings/{conflict}", json={"status": "confirmed"})
    assert grid_cell(sheet_rows(ccc_stored, "CCC matrix"), CDP_01, LDRRMP_02) == "C"
    ccc_stored.patch(f"/findings/{conflict}", json={"status": "rejected"})
    assert grid_cell(sheet_rows(ccc_stored, "CCC matrix"), CDP_01, LDRRMP_02) is None


@needs_db
def test_export_pairs_sheet_lists_every_stored_finding(ccc_stored: TestClient) -> None:
    rows = sheet_rows(ccc_stored, "Pairs")
    assert rows[0] == ["PPA A", "PPA B", "Verdict", "Status", "Reason", "Pages"]
    by_a = {r[0]: r for r in rows[1:]}
    assert len(rows) == 4
    conflict = by_a[CDP_01]
    assert conflict[1:5] == [LDRRMP_02, "Conflict", "AI suggestion", "Conflict reason"]
    assert str(conflict[5]).startswith("CDP p. ") and "; LDRRMP p. " in str(conflict[5])
    rejected = next(r for r in rows[1:] if str(r[0]).startswith("CDP CDP-05"))
    assert rejected[3] == "Rejected"


@needs_db
def test_export_before_any_run_has_headers_only(confirmed: TestClient) -> None:
    pairs = sheet_rows(confirmed, "Pairs")
    assert pairs == [["PPA A", "PPA B", "Verdict", "Status", "Reason", "Pages"]]
    rows = sheet_rows(confirmed, "CCC matrix")
    assert rows[0][0] == "City of Sampaguita CCC matrix. Synthetic demo data."
    assert grid_cell(rows, CDP_01, LDRRMP_02) is None
