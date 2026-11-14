"""S4-10 (orphan link), S4-12, S4-13, S4-15, S4-22: the orphan check against the seeded
TEST_DATABASE_URL (D7), with fake providers at `llm.PROVIDERS` (the provider boundary).

The answer key (seed/expected_findings.json): AIP-04 and AIP-05 have no parent; CDP-03 is
the suggested one. The seed links the other 8 AIP PPAs to a parent, `manual`/`confirmed`.
"""

import json
from collections.abc import Callable, Iterator
from pathlib import Path

import psycopg
import pytest
from fastapi.testclient import TestClient
from pydantic import BaseModel, TypeAdapter

from app import llm
from app.checks import orphan
from app.checks.findings import NewFinding
from app.db import get_conn
from app.db.migrate import migrate
from app.db.seed import seed
from app.extract import load_cache
from app.main import app
from app.models import CheckRunResult, Finding
from tests.db import TEST_DATABASE_URL, needs_db

Fake = Callable[[str, str, type[BaseModel]], str]
REASON = "Both are farm-to-market roads in a barangay the CDP-03 program covers."


def answering(parent_code: str | None, sent: list[str] | None = None) -> Fake:
    """A provider that names `parent_code`, recording each input it is sent."""

    def fake(prompt: str, input: str, output_model: type[BaseModel]) -> str:
        if sent is not None:
            sent.append(input)
        return json.dumps({"parent_code": parent_code, "reason": REASON})

    return fake


def offline(prompt: str, input: str, output_model: type[BaseModel]) -> str:
    raise ConnectionError("tests never call a provider")


def use(monkeypatch: pytest.MonkeyPatch, fake: Fake) -> None:
    monkeypatch.setattr(llm, "PROVIDERS", [("Gemini", fake), ("OpenRouter", fake)])


@pytest.fixture
def seeded(empty_db: psycopg.Connection, tmp_path: Path) -> psycopg.Connection:
    migrate(empty_db)
    seed(empty_db, tmp_path)
    return empty_db


def ids(conn: psycopg.Connection) -> dict[str, int]:
    return dict(conn.execute("SELECT code, id FROM ppas").fetchall())


def page_of(conn: psycopg.Connection, code: str) -> int:
    row = conn.execute("SELECT page_id FROM ppas WHERE code = %s", (code,)).fetchone()
    assert row
    return row[0]


def by_code(conn: psycopg.Connection, found: list[NewFinding]) -> dict[str, NewFinding]:
    codes = {v: k for k, v in ids(conn).items()}
    return {codes[f.ppa_a]: f for f in found}


@needs_db
def test_aip_04_and_05_get_cdp_03_as_their_suggested_parent(
    seeded: psycopg.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    use(monkeypatch, answering("CDP-03"))
    count, found = orphan.find_orphans(seeded)

    assert (count.check, count.checked, count.found) == ("orphan", 10, 2)
    ppa = ids(seeded)
    orphans = by_code(seeded, found)
    assert sorted(orphans) == ["AIP-04", "AIP-05"]
    for code, barangay in (("AIP-04", "1199900006"), ("AIP-05", "1199900010")):
        f = orphans[code]
        assert (f.check, f.ppa_b, f.reason, f.created_by) == ("orphan", ppa["CDP-03"], REASON, "ai")
        assert f.page_ids == [page_of(seeded, code), page_of(seeded, "CDP-03")]
        assert f.barangay == barangay


def assert_no_suggestion(conn: psycopg.Connection, found: list[NewFinding]) -> None:
    orphans = by_code(conn, found)
    assert sorted(orphans) == ["AIP-04", "AIP-05"]
    for code, f in orphans.items():
        assert (f.ppa_b, f.created_by, f.reason) == (None, "rule", orphan.NO_SUGGESTION)
        assert f.page_ids == [page_of(conn, code)]


@needs_db
@pytest.mark.parametrize(
    "fake",
    [
        answering("AIP-03"),  # a real PPA code, but not one of the candidates sent (D12)
        answering(None),
        offline,  # both providers fail: call_llm raises LLMError
    ],
    ids=["code-not-sent", "no-parent", "llm-error"],
)
def test_a_bad_or_missing_answer_saves_the_orphan_without_a_suggestion(
    seeded: psycopg.Connection, monkeypatch: pytest.MonkeyPatch, fake: Fake
) -> None:
    use(monkeypatch, fake)
    count, found = orphan.find_orphans(seeded)
    assert (count.checked, count.found) == (10, 2)
    assert_no_suggestion(seeded, found)


@needs_db
def test_without_cdp_or_ldip_candidates_the_ai_is_not_called(
    seeded: psycopg.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    sent: list[str] = []
    use(monkeypatch, answering("CDP-03", sent))
    seeded.execute("UPDATE plans SET status = 'ready' WHERE type = 'CDP'")  # no LDIP is seeded
    _, found = orphan.find_orphans(seeded)
    assert sent == []
    assert_no_suggestion(seeded, found)


@needs_db
def test_the_input_names_ppas_by_code_barangays_by_name_and_sends_cdp_and_ldip_only(
    seeded: psycopg.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    sent: list[str] = []
    use(monkeypatch, answering("CDP-03", sent))
    orphan.find_orphans(seeded)
    assert len(sent) == 2
    first = sent[0]
    assert first.startswith(
        "AIP project:\nAIP-04 | Upland sitio road concreting | roads | Barangay 6 | 2027\n"
    )
    assert (
        "CDP-03 | Farm-to-market roads program | roads"
        " | Barangay 6, Barangay 7, Barangay 10, Barangay 11 | 2026-2031\n"
    ) in first
    assert "11999" not in first  # names, not PSGC codes, so the AI's reason reads as names
    assert "LDRRMP-01" not in first  # LDRRMP is neither CDP nor LDIP
    assert "AIP-03" not in first and "LCCAP" not in first


@needs_db
def test_a_ppa_whose_only_parent_link_is_rejected_is_an_orphan(
    seeded: psycopg.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    use(monkeypatch, answering("CDP-02"))
    aip_01 = ids(seeded)["AIP-01"]
    seeded.execute("UPDATE links SET status = 'rejected' WHERE child_ppa_id = %s", (aip_01,))
    count, found = orphan.find_orphans(seeded)
    assert (count.checked, count.found) == (10, 3)
    assert by_code(seeded, found)["AIP-01"].ppa_b == ids(seeded)["CDP-02"]


def link_of(conn: psycopg.Connection, child: str, parent: str) -> tuple[str, str] | None:
    ppa = ids(conn)
    return conn.execute(
        "SELECT source, status FROM links WHERE child_ppa_id = %s AND parent_ppa_id = %s",
        (ppa[child], ppa[parent]),
    ).fetchone()


@needs_db
def test_accepting_an_orphans_parent_links_it_and_the_next_check_finds_one_orphan(
    seeded: psycopg.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    use(monkeypatch, answering("CDP-03"))
    ppa = ids(seeded)
    orphan.apply_review(seeded, "orphan", ppa["AIP-04"], ppa["CDP-03"], "confirmed")
    assert link_of(seeded, "AIP-04", "CDP-03") == ("ai", "confirmed")

    count, found = orphan.find_orphans(seeded)
    assert (count.checked, count.found) == (10, 1)
    assert sorted(by_code(seeded, found)) == ["AIP-05"]


@needs_db
def test_rejecting_an_accepted_orphan_rejects_its_link_and_it_is_an_orphan_again(
    seeded: psycopg.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    use(monkeypatch, answering("CDP-03"))
    ppa = ids(seeded)
    orphan.apply_review(seeded, "orphan", ppa["AIP-04"], ppa["CDP-03"], "confirmed")
    orphan.apply_review(seeded, "orphan", ppa["AIP-04"], ppa["CDP-03"], "rejected")
    assert link_of(seeded, "AIP-04", "CDP-03") == ("ai", "rejected")
    assert orphan.find_orphans(seeded)[0].found == 2


@needs_db
def test_rejecting_without_a_link_or_reviewing_another_check_adds_no_link(
    seeded: psycopg.Connection,
) -> None:
    ppa = ids(seeded)
    before = seeded.execute("SELECT count(*) FROM links").fetchone()
    orphan.apply_review(seeded, "orphan", ppa["AIP-05"], ppa["CDP-03"], "rejected")
    orphan.apply_review(seeded, "duplicate", ppa["AIP-05"], ppa["CDP-03"], "confirmed")
    assert seeded.execute("SELECT count(*) FROM links").fetchone() == before


@needs_db
def test_primed_orphan_answers_suggest_cdp_03_with_both_providers_failing(
    seeded: psycopg.Connection, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    use(monkeypatch, offline)
    answers = tmp_path / "orphans.json"
    answer = {"parent_code": "CDP-03", "reason": REASON}
    answers.write_text(json.dumps({"AIP-04": answer, "AIP-05": answer}), encoding="utf-8")

    assert load_cache.load_orphans(seeded, answers) == 2
    _, found = orphan.find_orphans(seeded)
    assert {code: f.ppa_b for code, f in by_code(seeded, found).items()} == {
        "AIP-04": ids(seeded)["CDP-03"],
        "AIP-05": ids(seeded)["CDP-03"],
    }


@needs_db
def test_without_an_orphans_file_load_primes_nothing(
    seeded: psycopg.Connection, tmp_path: Path
) -> None:
    assert load_cache.load_orphans(seeded, tmp_path / "missing.json") == 0


@needs_db
@pytest.mark.skipif(
    not load_cache.ORPHANS_RESPONSE.exists(),
    reason="seed/ai_cache/orphans.json not captured yet: a human step with an API key (S4-15)",
)
def test_committed_orphan_answers_suggest_cdp_03(
    seeded: psycopg.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    use(monkeypatch, offline)
    load_cache.load_orphans(seeded)
    _, found = orphan.find_orphans(seeded)
    cdp_03 = ids(seeded)["CDP-03"]
    assert [f.ppa_b for f in found] == [cdp_03, cdp_03]


def api_conn() -> Iterator[psycopg.Connection]:
    assert TEST_DATABASE_URL
    with psycopg.connect(TEST_DATABASE_URL) as c:
        yield c


def orphan_count(client: TestClient) -> tuple[int, int]:
    response = client.post("/checks/run")
    assert response.status_code == 200, response.text
    counts = CheckRunResult.model_validate(response.json()).counts
    [count] = [c for c in counts if c.check == "orphan"]
    return count.checked, count.found


@needs_db
def test_run_accept_and_rerun_through_the_api(
    seeded: psycopg.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    use(monkeypatch, answering("CDP-03"))
    app.dependency_overrides[get_conn] = api_conn
    try:
        client = TestClient(app)
        assert orphan_count(client) == (10, 2)
        findings = TypeAdapter(list[Finding]).validate_python(client.get("/findings").json())
        orphans = {f.ppa_a.code or "": f for f in findings if f.check == "orphan"}
        assert sorted(orphans) == ["AIP-04", "AIP-05"]
        assert all(f.ppa_b and f.ppa_b.code == "CDP-03" for f in orphans.values())

        response = client.patch(f"/findings/{orphans['AIP-04'].id}", json={"status": "confirmed"})
        assert response.status_code == 200, response.text
        assert link_of(seeded, "AIP-04", "CDP-03") == ("ai", "confirmed")
        assert orphan_count(client) == (10, 1)
    finally:
        app.dependency_overrides.pop(get_conn)


@needs_db
def test_a_rejected_orphan_suggestion_does_not_carry_onto_a_new_parent(
    seeded: psycopg.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    def aip_04(client: TestClient) -> Finding:
        findings = TypeAdapter(list[Finding]).validate_python(client.get("/findings").json())
        [f] = [f for f in findings if f.check == "orphan" and f.ppa_a.code == "AIP-04"]
        return f

    use(monkeypatch, answering("CDP-03"))
    app.dependency_overrides[get_conn] = api_conn
    try:
        client = TestClient(app)
        orphan_count(client)
        body = {"status": "rejected", "note": "Not this program"}
        response = client.patch(f"/findings/{aip_04(client).id}", json=body)
        assert response.status_code == 200, response.text

        # Same orphan, unchanged PPAs, but the AI now names another parent.
        seeded.execute("DELETE FROM ai_cache")
        use(monkeypatch, answering("CDP-10"))
        orphan_count(client)
        f = aip_04(client)
        assert f.ppa_b and f.ppa_b.code == "CDP-10"
        assert (f.status, f.note) == ("suggested", "Not this program")

        # The same parent again keeps the review (D5).
        seeded.execute("DELETE FROM ai_cache")
        use(monkeypatch, answering("CDP-03"))
        client.patch(f"/findings/{aip_04(client).id}", json={"status": "rejected"})
        orphan_count(client)
        assert aip_04(client).status == "rejected"
    finally:
        app.dependency_overrides.pop(get_conn)
