"""Upload and extraction (lane:ai). POST /plans checks the upload, saves an `extracting`
plan and extracts in a background task (S2-10, S2-11). POST /plans/{id}/retry runs that
task again on a failed plan under the same id (S2-14)."""

from collections.abc import Callable
from typing import Annotated

import psycopg
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException
from psycopg.rows import class_row

from app import llm
from app.db import connect, get_conn
from app.extract.extraction import (
    EXTRACTION_PROMPT,
    ExtractionError,
    RawExtraction,
    clean_ppas,
    model_input,
    read_pages,
)
from app.models import Plan, PlanRetry, PlanUpload
from app.plans.routes import SELECT_BARANGAYS, fetch_plan

router = APIRouter()

MAX_UPLOAD_MB = 10
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
INTERRUPTED = "Extraction was interrupted. Retry."

SELECT_CITY = "SELECT psgc_code FROM lgus WHERE level = 'city' LIMIT 1"
INSERT_PLAN = """
INSERT INTO plans (lgu_psgc, type, title, period_start, period_end, status)
VALUES (%s, %s, %s, %s, %s, 'extracting')
RETURNING id, lgu_psgc, type, title, period_start, period_end, status, error
"""
INSERT_PAGE = "INSERT INTO pages (plan_id, page_no, text) VALUES (%s, %s, %s) RETURNING id"
INSERT_PPA = """
INSERT INTO ppas (plan_id, code, title, description, office, sector, barangays, cost,
                  year_start, year_end, page_id, status)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'draft')
"""
SET_STATUS = "UPDATE plans SET status = %s, error = %s WHERE id = %s"
DELETE_PPAS = "DELETE FROM ppas WHERE plan_id = %s"
DELETE_PAGES = "DELETE FROM pages WHERE plan_id = %s"
RESET_FOR_RETRY = """
UPDATE plans SET status = 'extracting', error = NULL WHERE id = %s
RETURNING id, lgu_psgc, type, title, period_start, period_end, status, error
"""
RESET_INTERRUPTED = "UPDATE plans SET status = 'failed', error = %s WHERE status = 'extracting'"

Conn = Annotated[psycopg.Connection, Depends(get_conn)]
Connector = Callable[[], psycopg.Connection]


def get_connector() -> Connector:
    """FastAPI dependency: how the background task opens its own connection (the request's
    connection is closed by then). Tests override it with TEST_DATABASE_URL (D7)."""
    return connect


def check_pdf(body: PlanUpload | PlanRetry) -> bytes:
    """The upload's bytes after S2-10's file checks. Also used by the retry (S2-14)."""
    pdf = body.file.file.read(MAX_UPLOAD_BYTES + 1)
    if not pdf.startswith(b"%PDF"):
        raise HTTPException(400, "Not a PDF")
    if len(pdf) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"The PDF is over the {MAX_UPLOAD_MB} MB limit")
    return pdf


def barangays(conn: psycopg.Connection) -> list[tuple[str, str]]:
    """The city's barangays as (code, name), in the order the model input lists them."""
    return conn.execute(SELECT_BARANGAYS).fetchall()


def extract_plan(plan_id: int, pdf: bytes, connector: Connector) -> None:
    """The background task (S2-11): pages, one model call, draft PPAs, then `ready` or
    `failed`. The PDF lives only in memory."""
    with connector() as conn:
        try:
            texts = read_pages(pdf)
            page_ids: dict[int, int] = {}
            for page_no, text in enumerate(texts, start=1):
                row = conn.execute(INSERT_PAGE, (plan_id, page_no, text)).fetchone()
                assert row
                page_ids[page_no] = row[0]
            conn.commit()

            city = barangays(conn)
            answer = llm.call_llm(conn, EXTRACTION_PROMPT, model_input(texts, city), RawExtraction)
            for p in clean_ppas(answer.ppas, {code for code, _ in city}, page_ids):
                conn.execute(
                    INSERT_PPA,
                    (
                        plan_id,
                        p.code,
                        p.title,
                        p.description,
                        p.office,
                        p.sector,
                        p.barangays or [],
                        p.cost,
                        p.year_start,
                        p.year_end,
                        p.page_id,
                    ),
                )
            conn.execute(SET_STATUS, ("ready", None, plan_id))
            conn.commit()
        except (ExtractionError, llm.LLMError) as e:
            _fail(conn, plan_id, str(e))
        except Exception as e:
            # Only the type: never a stack trace or a value in front of the planner.
            _fail(conn, plan_id, f"Extraction failed ({type(e).__name__}). Retry.")
            raise


def _fail(conn: psycopg.Connection, plan_id: int, error: str) -> None:
    conn.rollback()
    conn.execute(SET_STATUS, ("failed", error, plan_id))
    conn.commit()


def reset_interrupted(connector: Connector) -> None:
    """At startup, no extraction is running: every `extracting` plan becomes `failed` (S2-15)."""
    try:
        with connector() as conn:
            conn.execute(RESET_INTERRUPTED, (INTERRUPTED,))
    except (RuntimeError, psycopg.OperationalError) as e:
        # No DATABASE_URL, or the database is down: start anyway, as GET /plans answers 503.
        print(f"Startup reset skipped: {type(e).__name__}", flush=True)


@router.post("/plans")
def upload_plan(
    body: Annotated[PlanUpload, File()],
    conn: Conn,
    tasks: BackgroundTasks,
    connector: Annotated[Connector, Depends(get_connector)],
) -> Plan:
    pdf = check_pdf(body)
    if body.period_start > body.period_end:
        raise HTTPException(422, "The start year is after the end year")
    city = conn.execute(SELECT_CITY).fetchone()
    if city is None:
        raise HTTPException(409, "Load the city first")

    title = f"{body.type} {body.period_start}–{body.period_end}"
    with conn.cursor(row_factory=class_row(Plan)) as cur:
        plan = cur.execute(
            INSERT_PLAN, (city[0], body.type, title, body.period_start, body.period_end)
        ).fetchone()
    assert plan
    conn.commit()  # before the task starts: it reads the plan on its own connection
    tasks.add_task(extract_plan, plan.id, pdf, connector)
    return plan


@router.post("/plans/{plan_id}/retry")
def retry_plan(
    plan_id: int,
    body: Annotated[PlanRetry, File()],
    conn: Conn,
    tasks: BackgroundTasks,
    connector: Annotated[Connector, Depends(get_connector)],
) -> Plan:
    pdf = check_pdf(body)
    if fetch_plan(conn, plan_id).status != "failed":
        raise HTTPException(409, "Only a failed plan can be retried")

    conn.execute(DELETE_PPAS, (plan_id,))  # first: ppas.page_id references pages
    conn.execute(DELETE_PAGES, (plan_id,))
    with conn.cursor(row_factory=class_row(Plan)) as cur:
        plan = cur.execute(RESET_FOR_RETRY, (plan_id,)).fetchone()
    assert plan
    conn.commit()  # before the task starts: it writes the plan on its own connection
    tasks.add_task(extract_plan, plan.id, pdf, connector)
    return plan
