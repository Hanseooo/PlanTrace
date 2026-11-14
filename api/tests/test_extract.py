"""S2-10 to S2-12, S2-14, S2-15, S2-19: POST /plans, its background task and the retry,
against the seeded TEST_DATABASE_URL (D7) with seed/ai_cache/lccap.json loaded.

Providers are fakes that raise, so no test reaches the network: the LCCAP upload passes
only through the committed cache row. TestClient runs the background task before the
response returns, so a test can assert the final status right after the POST.
"""

import json
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import psycopg
import pymupdf
import pytest
from fastapi.testclient import TestClient
from pydantic import BaseModel, TypeAdapter

from app import llm
from app.db import get_conn
from app.db.migrate import migrate
from app.db.seed import SEED_DIR, seed
from app.extract import load_cache
from app.extract.routes import INTERRUPTED, get_connector
from app.main import app
from app.models import Plan, Ppa
from tests.db import TEST_DATABASE_URL, needs_db

LCCAP = (SEED_DIR / "pdfs" / "lccap.pdf").read_bytes()
KEY_FIELDS = ("code", "sector", "barangays", "cost", "year_start", "year_end", "page_no")
FORM = {"type": "LCCAP", "period_start": "2026", "period_end": "2030"}


def offline(prompt: str, input: str, output_model: type[BaseModel]) -> str:
    raise ConnectionError("tests never call a provider")


def open_test_db() -> psycopg.Connection:
    assert TEST_DATABASE_URL
    return psycopg.connect(TEST_DATABASE_URL)


@pytest.fixture
def db(
    empty_db: psycopg.Connection, monkeypatch: pytest.MonkeyPatch
) -> Iterator[psycopg.Connection]:
    """The migrated test database, with the app and its background task wired to it."""
    migrate(empty_db)
    monkeypatch.setattr(llm, "PROVIDERS", [("Gemini", offline), ("OpenRouter", offline)])

    def conn() -> Iterator[psycopg.Connection]:
        with open_test_db() as c:
            yield c

    app.dependency_overrides[get_conn] = conn
    app.dependency_overrides[get_connector] = lambda: open_test_db
    try:
        yield empty_db
    finally:
        app.dependency_overrides.pop(get_conn)
        app.dependency_overrides.pop(get_connector)


@pytest.fixture
def seeded(db: psycopg.Connection, tmp_path: Path) -> psycopg.Connection:
    seed(db, tmp_path)
    with open_test_db() as conn:
        load_cache.load(conn)
    return db


def upload(pdf: bytes = LCCAP, name: str = "lccap.pdf", **form: str) -> Any:
    files = {"file": (name, pdf, "application/pdf")}
    return TestClient(app).post("/plans", files=files, data={**FORM, **form})


def retry(plan_id: int, pdf: bytes = LCCAP, name: str = "lccap.pdf") -> Any:
    files = {"file": (name, pdf, "application/pdf")}
    return TestClient(app).post(f"/plans/{plan_id}/retry", files=files)


def ppa_count(conn: psycopg.Connection, plan_id: int) -> int:
    row = conn.execute("SELECT count(*) FROM ppas WHERE plan_id = %s", (plan_id,)).fetchone()
    assert row
    return row[0]


def plan_count(conn: psycopg.Connection) -> int:
    row = conn.execute("SELECT count(*) FROM plans").fetchone()
    assert row
    return row[0]


def pdf_of(*page_texts: str, encrypt: bool = False) -> bytes:
    doc = pymupdf.open()
    for text in page_texts:
        doc.new_page().insert_text((72, 72), text)
    if encrypt:
        return doc.tobytes(encryption=pymupdf.PDF_ENCRYPT_AES_256, user_pw="x", owner_pw="y")
    return doc.tobytes()


def test_upload_is_advertised_as_multipart() -> None:
    # The web client is generated from OpenAPI.
    content = app.openapi()["paths"]["/plans"]["post"]["requestBody"]["content"]
    assert list(content) == ["multipart/form-data"]


@needs_db
def test_lccap_upload_ends_ready_with_the_answer_keys_3_draft_ppas(
    seeded: psycopg.Connection,
) -> None:
    response = upload()
    assert response.status_code == 200, response.text
    created = Plan.model_validate(response.json())
    assert (created.status, created.title) == ("extracting", "LCCAP 2026–2030")
    assert created.lgu_psgc == "1199900000"

    client = TestClient(app)
    plan = Plan.model_validate(client.get(f"/plans/{created.id}").json())
    assert (plan.status, plan.error) == ("ready", None)

    pages = dict(
        seeded.execute("SELECT id, page_no FROM pages WHERE plan_id = %s", (plan.id,)).fetchall()
    )
    assert sorted(pages.values()) == [1, 2]  # one row per page of the 2-page PDF

    ppas = TypeAdapter(list[Ppa]).validate_python(client.get(f"/plans/{plan.id}/ppas").json())
    expected = json.loads((SEED_DIR / "expected_findings.json").read_text(encoding="utf-8"))
    assert [
        {
            "code": p.code,
            "sector": p.sector,
            "barangays": p.barangays,
            "cost": p.cost,
            "year_start": p.year_start,
            "year_end": p.year_end,
            "page_no": pages[p.page_id] if p.page_id else None,
            "status": p.status,
        }
        for p in ppas
    ] == [{**{k: e[k] for k in KEY_FIELDS}, "status": "draft"} for e in expected["lccap_ppas"]]


@needs_db
def test_without_the_cache_both_providers_fail_and_the_plan_names_them(
    db: psycopg.Connection, tmp_path: Path
) -> None:
    seed(db, tmp_path)  # no load_cache.load: the red check for S2-19
    plan = Plan.model_validate(upload().json())
    failed = Plan.model_validate(TestClient(app).get(f"/plans/{plan.id}").json())
    assert failed.status == "failed"
    assert failed.error and "Gemini" in failed.error and "OpenRouter" in failed.error


@needs_db
@pytest.mark.parametrize(
    ("pdf", "error"),
    [
        (pdf_of("", ""), "No text found. Scanned PDFs aren't supported."),
        (pdf_of("Secret plan", encrypt=True), "Not a readable PDF"),
        (b"%PDF-1.7 but nothing else", "Not a readable PDF"),
    ],
)
def test_unextractable_pdf_fails_with_a_readable_message(
    seeded: psycopg.Connection, pdf: bytes, error: str
) -> None:
    plan = Plan.model_validate(upload(pdf).json())
    failed = Plan.model_validate(TestClient(app).get(f"/plans/{plan.id}").json())
    assert (failed.status, failed.error) == ("failed", error)


@needs_db
@pytest.mark.parametrize(
    ("pdf", "form", "status", "detail"),
    [
        (b"plain text, not a pdf", {}, 400, "Not a PDF"),
        (b"%PDF" + b"0" * (11 * 1024 * 1024), {}, 413, "10 MB"),
        (LCCAP, {"period_start": "2031", "period_end": "2026"}, 422, "start year"),
    ],
)
def test_bad_upload_is_refused_and_nothing_is_saved(
    seeded: psycopg.Connection, pdf: bytes, form: dict[str, str], status: int, detail: str
) -> None:
    before = plan_count(seeded)
    response = upload(pdf, **form)
    assert response.status_code == status, response.text
    assert detail in response.json()["detail"]
    assert plan_count(seeded) == before


@needs_db
def test_upload_before_the_city_is_seeded_is_409(db: psycopg.Connection) -> None:
    response = upload()
    assert response.status_code == 409
    assert response.json()["detail"] == "Load the city first"
    assert plan_count(db) == 0


@needs_db
def test_startup_fails_a_plan_left_extracting(seeded: psycopg.Connection) -> None:
    seeded.execute("UPDATE plans SET status = 'extracting' WHERE id = 4")
    with TestClient(app) as client:  # `with` runs the lifespan
        plan = Plan.model_validate(client.get("/plans/4").json())
    assert (plan.status, plan.error) == ("failed", INTERRUPTED)
    others = seeded.execute("SELECT DISTINCT status FROM plans WHERE id <> 4").fetchall()
    assert others == [("confirmed",)]


@needs_db
def test_retry_on_a_ready_plan_is_409_and_changes_nothing(seeded: psycopg.Connection) -> None:
    plan = Plan.model_validate(upload().json())
    client = TestClient(app)
    before = client.get(f"/plans/{plan.id}").json()
    response = retry(plan.id)
    assert response.status_code == 409, response.text
    assert client.get(f"/plans/{plan.id}").json() == before
    assert ppa_count(seeded, plan.id) == 3


@needs_db
def test_retry_on_a_failed_plan_extracts_again_under_the_same_id(
    seeded: psycopg.Connection,
) -> None:
    plan = Plan.model_validate(upload().json())
    seeded.execute("UPDATE plans SET status = 'failed', error = 'boom' WHERE id = %s", (plan.id,))

    response = retry(plan.id)
    assert response.status_code == 200, response.text
    retried = Plan.model_validate(response.json())
    assert (retried.id, retried.status, retried.error) == (plan.id, "extracting", None)

    final = Plan.model_validate(TestClient(app).get(f"/plans/{plan.id}").json())
    assert (final.status, final.error) == ("ready", None)
    assert ppa_count(seeded, plan.id) == 3  # not 6: the old PPAs were deleted
    pages = seeded.execute(
        "SELECT page_no FROM pages WHERE plan_id = %s ORDER BY page_no", (plan.id,)
    ).fetchall()
    assert pages == [(1,), (2,)]  # one row per page, not two


@needs_db
def test_retry_on_an_unknown_plan_is_404(seeded: psycopg.Connection) -> None:
    assert retry(999).status_code == 404


@needs_db
def test_retry_with_a_non_pdf_is_400_and_the_plan_stays_failed(
    seeded: psycopg.Connection,
) -> None:
    plan = Plan.model_validate(upload().json())
    seeded.execute("UPDATE plans SET status = 'failed', error = 'boom' WHERE id = %s", (plan.id,))
    response = retry(plan.id, b"plain text, not a pdf", "notes.txt")
    assert response.status_code == 400, response.text
    assert response.json()["detail"] == "Not a PDF"
    failed = Plan.model_validate(TestClient(app).get(f"/plans/{plan.id}").json())
    assert (failed.status, failed.error) == ("failed", "boom")
