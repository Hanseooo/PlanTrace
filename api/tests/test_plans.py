"""S1-11, S2-16, S3-01, S3-02: the plan, barangay and page read routes read the database
(D7: the seeded TEST_DATABASE_URL only).
S3-03 to S3-08: the PPA writes and confirm write it.

The seeded test uses the `empty_db` fixture (conftest.py), as test_seed does.
"""

import json
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import psycopg
import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter

from app.db import get_conn
from app.db.migrate import migrate
from app.db.seed import SEED_DIR, seed
from app.main import app
from app.models import Barangay, Page, Plan, Ppa
from tests.db import TEST_DATABASE_URL, needs_db


@pytest.fixture
def seeded_client(empty_db: psycopg.Connection, tmp_path: Path) -> Iterator[TestClient]:
    migrate(empty_db)
    seed(empty_db, tmp_path)

    def test_conn() -> Iterator[psycopg.Connection]:
        assert TEST_DATABASE_URL
        with psycopg.connect(TEST_DATABASE_URL) as conn:
            yield conn

    app.dependency_overrides[get_conn] = test_conn
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_conn)


@needs_db
def test_list_plans_returns_the_4_seeded_plans(seeded_client: TestClient) -> None:
    response = seeded_client.get("/plans")
    assert response.status_code == 200, response.text
    plans = TypeAdapter(list[Plan]).validate_python(response.json())
    # The hand-written S0 fixture holds the same 4 plans the seed loads.
    expected = json.loads((SEED_DIR / "fixtures" / "plans.json").read_text(encoding="utf-8"))
    assert [p.model_dump() for p in plans] == expected


@needs_db
def test_get_plan_returns_that_plan(seeded_client: TestClient) -> None:
    response = seeded_client.get("/plans/2")
    assert response.status_code == 200, response.text
    plan = Plan.model_validate(response.json())
    assert (plan.id, plan.type) == (2, "CDP")


@needs_db
def test_list_ppas_returns_that_plans_ppas_by_id(seeded_client: TestClient) -> None:
    response = seeded_client.get("/plans/2/ppas")
    assert response.status_code == 200, response.text
    ppas = TypeAdapter(list[Ppa]).validate_python(response.json())
    assert "Socialized housing project, Barangay 9" in [p.title for p in ppas]
    assert {p.plan_id for p in ppas} == {2}
    assert [p.id for p in ppas] == sorted(p.id for p in ppas)
    # text[] and numeric come back as list[str] and float.
    housing = next(p for p in ppas if p.code == "CDP-01")
    assert (housing.barangays, housing.cost) == (["1199900009"], 25000000.0)


@needs_db
@pytest.mark.parametrize("path", ["/plans/999", "/plans/999/ppas"])
def test_unknown_plan_is_404(seeded_client: TestClient, path: str) -> None:
    assert seeded_client.get(path).status_code == 404


# The seed confirms every plan; the write tests turn the AIP plan back to `ready` with drafts.
AIP = 4
CLUP = 1


@pytest.fixture
def ready_plan(seeded_client: TestClient, empty_db: psycopg.Connection) -> list[Ppa]:
    empty_db.execute("UPDATE plans SET status = 'ready' WHERE id = %s", (AIP,))
    empty_db.execute("UPDATE ppas SET status = 'draft' WHERE plan_id = %s", (AIP,))
    return ppas_of(seeded_client, AIP)


def ppas_of(client: TestClient, plan_id: int) -> list[Ppa]:
    response = client.get(f"/plans/{plan_id}/ppas")
    assert response.status_code == 200, response.text
    return TypeAdapter(list[Ppa]).validate_python(response.json())


@needs_db
def test_patch_changes_only_the_fields_sent(
    seeded_client: TestClient, ready_plan: list[Ppa]
) -> None:
    row = ready_plan[0]
    response = seeded_client.patch(f"/ppas/{row.id}", json={"cost": 5000000})
    assert response.status_code == 200, response.text
    patched = Ppa.model_validate(response.json())
    assert patched == row.model_copy(update={"cost": 5000000.0})
    assert patched.status == "draft"
    assert ppas_of(seeded_client, AIP)[0] == patched


@needs_db
def test_patch_null_and_blank_clear_a_field(
    seeded_client: TestClient, ready_plan: list[Ppa]
) -> None:
    row = ready_plan[0]
    assert seeded_client.patch(f"/ppas/{row.id}", json={"office": None}).json()["office"] is None
    response = seeded_client.patch(f"/ppas/{row.id}", json={"title": "  "})
    patched = Ppa.model_validate(response.json())
    assert (patched.title, patched.office, patched.code) == (None, None, row.code)


@needs_db
@pytest.mark.parametrize(
    ("body", "field"),
    [
        ({"cost": -1}, "Cost"),
        # Raw text: httpx won't encode non-finite floats, but a client can send them.
        ('{"cost": Infinity}', "Cost"),
        ('{"cost": NaN}', "Cost"),
        ({"year_start": 202}, "Start year"),
        ({"year_end": 2026}, "End year"),  # the stored year_start is 2027
        ({"barangays": ["9999999999"]}, "Barangay"),
        ({"page_id": "other plan"}, "Source page"),
    ],
)
def test_patch_rejects_a_bad_field_and_keeps_the_row(
    seeded_client: TestClient,
    ready_plan: list[Ppa],
    empty_db: psycopg.Connection,
    body: dict[str, Any] | str,
    field: str,
) -> None:
    row = ready_plan[0]
    assert row.year_start == 2027
    if isinstance(body, str):
        response = seeded_client.patch(
            f"/ppas/{row.id}",
            content=body,
            headers={"content-type": "application/json"},
        )
    else:
        if body.get("page_id") == "other plan":
            page = empty_db.execute(
                "SELECT id FROM pages WHERE plan_id <> %s LIMIT 1", (AIP,)
            ).fetchone()
            assert page
            body = {"page_id": page[0]}
        response = seeded_client.patch(f"/ppas/{row.id}", json=body)
    assert response.status_code == 422, response.text
    assert response.json()["detail"].startswith(field)
    assert ppas_of(seeded_client, AIP)[0] == row


@needs_db
def test_post_adds_a_blank_row_with_the_plans_status(
    seeded_client: TestClient, ready_plan: list[Ppa]
) -> None:
    draft = Ppa.model_validate(seeded_client.post(f"/plans/{AIP}/ppas", json={}).json())
    assert draft.status == "draft"
    assert (draft.plan_id, draft.title, draft.barangays, draft.cost) == (AIP, None, [], None)
    assert ppas_of(seeded_client, AIP)[-1] == draft
    response = seeded_client.post(f"/plans/{CLUP}/ppas", json={"title": "Added by hand"})
    assert response.status_code == 200, response.text
    assert (response.json()["status"], response.json()["title"]) == ("confirmed", "Added by hand")


@needs_db
def test_delete_removes_the_row(seeded_client: TestClient, ready_plan: list[Ppa]) -> None:
    row = ready_plan[0]
    assert seeded_client.delete(f"/ppas/{row.id}").status_code == 204
    assert row.id not in [p.id for p in ppas_of(seeded_client, AIP)]
    assert seeded_client.delete(f"/ppas/{row.id}").status_code == 404


@needs_db
def test_confirm_confirms_the_plan_and_every_row(
    seeded_client: TestClient, ready_plan: list[Ppa]
) -> None:
    response = seeded_client.post(f"/plans/{AIP}/confirm")
    assert response.status_code == 200, response.text
    plan = Plan.model_validate(response.json())
    assert plan.status == "confirmed"
    assert {p.status for p in ppas_of(seeded_client, AIP)} == {"confirmed"}
    again = seeded_client.post(f"/plans/{AIP}/confirm")
    assert again.status_code == 200
    assert Plan.model_validate(again.json()) == plan
    added = seeded_client.post(f"/plans/{AIP}/ppas", json={}).json()
    assert added["status"] == "confirmed"


@needs_db
def test_confirm_without_rows_is_409(seeded_client: TestClient, ready_plan: list[Ppa]) -> None:
    for row in ready_plan:
        assert seeded_client.delete(f"/ppas/{row.id}").status_code == 204
    response = seeded_client.post(f"/plans/{AIP}/confirm")
    assert response.status_code == 409
    assert response.json()["detail"] == "Add a row first"
    assert seeded_client.get(f"/plans/{AIP}").json()["status"] == "ready"


@needs_db
@pytest.mark.parametrize("status", ["extracting", "failed"])
def test_writes_on_a_busy_plan_are_409(
    seeded_client: TestClient,
    ready_plan: list[Ppa],
    empty_db: psycopg.Connection,
    status: str,
) -> None:
    empty_db.execute("UPDATE plans SET status = %s WHERE id = %s", (status, AIP))
    row = ready_plan[0]
    assert seeded_client.patch(f"/ppas/{row.id}", json={"cost": 1}).status_code == 409
    assert seeded_client.post(f"/plans/{AIP}/ppas", json={}).status_code == 409
    assert seeded_client.delete(f"/ppas/{row.id}").status_code == 409
    assert seeded_client.post(f"/plans/{AIP}/confirm").status_code == 409
    assert ppas_of(seeded_client, AIP) == ready_plan


@needs_db
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("PATCH", "/ppas/999999"),
        ("DELETE", "/ppas/999999"),
        ("POST", "/plans/999/ppas"),
        ("POST", "/plans/999/confirm"),
    ],
)
def test_writes_on_unknown_ids_are_404(seeded_client: TestClient, method: str, path: str) -> None:
    kwargs: dict[str, Any] = {} if method == "DELETE" or "confirm" in path else {"json": {}}
    assert seeded_client.request(method, path, **kwargs).status_code == 404


def test_list_plans_without_database_url_is_503(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    response = TestClient(app).get("/plans")
    assert response.status_code == 503
    assert "DATABASE_URL" in response.json()["detail"]


@needs_db
def test_list_barangays_returns_the_12_barangays_by_code(seeded_client: TestClient) -> None:
    response = seeded_client.get("/barangays")
    assert response.status_code == 200, response.text
    barangays = TypeAdapter(list[Barangay]).validate_python(response.json())
    codes = [b.psgc_code for b in barangays]
    assert len(barangays) == 12
    assert codes[0] == "1199900001"
    assert codes == sorted(codes)
    assert "1199900000" not in codes  # the city row
    assert all(b.name for b in barangays)


@needs_db
def test_get_page_returns_a_ppas_source_page(seeded_client: TestClient) -> None:
    ppas = seeded_client.get("/plans/2/ppas").json()
    page_id = next(p["page_id"] for p in ppas if p["code"] == "CDP-01")
    assert TEST_DATABASE_URL
    with psycopg.connect(TEST_DATABASE_URL) as conn:
        row = conn.execute(
            "SELECT plan_id, page_no, text FROM pages WHERE id = %s", (page_id,)
        ).fetchone()
    assert row

    response = seeded_client.get(f"/pages/{page_id}")
    assert response.status_code == 200, response.text
    page = Page.model_validate(response.json())
    assert (page.id, page.plan_id, page.page_no, page.text) == (page_id, 2, row[1], row[2])
    assert "housing" in page.text.lower()


@needs_db
def test_unknown_page_is_404(seeded_client: TestClient) -> None:
    response = seeded_client.get("/pages/999999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Page not found"


@pytest.mark.parametrize("path", ["/barangays", "/pages/1"])
def test_new_reads_without_database_url_are_503(monkeypatch: pytest.MonkeyPatch, path: str) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    assert TestClient(app).get(path).status_code == 503


@pytest.mark.parametrize("path", ["/barangays", "/pages/1"])
def test_new_reads_with_database_unreachable_are_503(
    monkeypatch: pytest.MonkeyPatch, path: str
) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://nobody@127.0.0.1:1/none")
    response = TestClient(app).get(path)
    assert response.status_code == 503
    assert "reach" in response.json()["detail"]
