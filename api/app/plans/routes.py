"""Plan list, PPA table edits, confirm (lane:data). GET /plans (S1-11), GET /plans/{id}
and GET /plans/{id}/ppas (S2-16), GET /barangays and GET /pages/{id} (S3-01, S3-02) read
the database. The PPA writes and confirm (S3-03 to S3-08) write it: 409 while a plan is
`extracting` or `failed`, 422 naming a bad field."""

import math
from typing import Annotated, Any

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Response
from psycopg import sql
from psycopg.rows import class_row

from app.db import get_conn
from app.models import Barangay, Page, Plan, Ppa, PpaInput

router = APIRouter()

PLAN_COLUMNS = "id, lgu_psgc, type, title, period_start, period_end, status, error"
PPA_COLUMNS = """id, plan_id, code, title, description, office, sector, barangays, cost,
       year_start, year_end, page_id, status"""
SELECT_PLANS = f"SELECT {PLAN_COLUMNS} FROM plans ORDER BY id"
SELECT_PLAN = f"SELECT {PLAN_COLUMNS} FROM plans WHERE id = %s"
SELECT_PPAS = f"SELECT {PPA_COLUMNS} FROM ppas WHERE plan_id = %s ORDER BY id"
SELECT_PPA = f"SELECT {PPA_COLUMNS} FROM ppas WHERE id = %s"
INSERT_PPA = f"""
INSERT INTO ppas (plan_id, code, title, description, office, sector, barangays, cost,
                  year_start, year_end, page_id, status)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
RETURNING {PPA_COLUMNS}
"""
DELETE_PPA = "DELETE FROM ppas WHERE id = %s"
SELECT_PAGE_PLAN = "SELECT plan_id FROM pages WHERE id = %s"
COUNT_PPAS = "SELECT count(*) FROM ppas WHERE plan_id = %s"
CONFIRM_PPAS = "UPDATE ppas SET status = 'confirmed' WHERE plan_id = %s AND status <> 'confirmed'"
CONFIRM_PLAN = f"UPDATE plans SET status = 'confirmed' WHERE id = %s RETURNING {PLAN_COLUMNS}"

# The only columns a PATCH may SET: the SQL never takes a column name from the request.
EDITABLE = (
    "code",
    "title",
    "description",
    "office",
    "sector",
    "barangays",
    "cost",
    "year_start",
    "year_end",
    "page_id",
)
TEXT_FIELDS = ("code", "title", "description", "office")
BUSY = {
    "extracting": "The plan is still extracting",
    "failed": "The plan failed to extract. Retry it first",
}

# The one copy of the barangay query; extract/routes.py imports it for the model input.
SELECT_BARANGAYS = "SELECT psgc_code, name FROM lgus WHERE level = 'barangay' ORDER BY psgc_code"
SELECT_PAGE = "SELECT id, plan_id, page_no, text FROM pages WHERE id = %s"

Conn = Annotated[psycopg.Connection, Depends(get_conn)]


def fetch_plan(conn: psycopg.Connection, plan_id: int) -> Plan:
    """The plan, or 404 when it doesn't exist (S2-16)."""
    with conn.cursor(row_factory=class_row(Plan)) as cur:
        plan = cur.execute(SELECT_PLAN, (plan_id,)).fetchone()
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan


@router.get("/plans")
def list_plans(conn: Conn) -> list[Plan]:
    with conn.cursor(row_factory=class_row(Plan)) as cur:
        return cur.execute(SELECT_PLANS).fetchall()


@router.get("/plans/{plan_id}")
def get_plan(plan_id: int, conn: Conn) -> Plan:
    return fetch_plan(conn, plan_id)


@router.get("/plans/{plan_id}/ppas")
def list_ppas(plan_id: int, conn: Conn) -> list[Ppa]:
    fetch_plan(conn, plan_id)
    # psycopg reads numeric as Decimal; Ppa's float field converts it.
    with conn.cursor(row_factory=class_row(Ppa)) as cur:
        return cur.execute(SELECT_PPAS, (plan_id,)).fetchall()


@router.get("/barangays")
def list_barangays(conn: Conn) -> list[Barangay]:
    with conn.cursor(row_factory=class_row(Barangay)) as cur:
        return cur.execute(SELECT_BARANGAYS).fetchall()


@router.get("/pages/{page_id}")
def get_page(page_id: int, conn: Conn) -> Page:
    with conn.cursor(row_factory=class_row(Page)) as cur:
        page = cur.execute(SELECT_PAGE, (page_id,)).fetchone()
    if page is None:
        raise HTTPException(status_code=404, detail="Page not found")
    return page


def fetch_ppa(conn: psycopg.Connection, ppa_id: int) -> Ppa:
    with conn.cursor(row_factory=class_row(Ppa)) as cur:
        ppa = cur.execute(SELECT_PPA, (ppa_id,)).fetchone()
    if ppa is None:
        raise HTTPException(status_code=404, detail="PPA not found")
    return ppa


def writable_plan(conn: psycopg.Connection, plan_id: int) -> Plan:
    """The plan, 404 when unknown, 409 while `extracting` or `failed` (S3-07): retry deletes
    a plan's rows, so an edit then would be lost."""
    plan = fetch_plan(conn, plan_id)
    if plan.status in BUSY:
        raise HTTPException(status_code=409, detail=BUSY[plan.status])
    return plan


def clean_fields(
    conn: psycopg.Connection, plan_id: int, fields: dict[str, Any], stored: Ppa | None
) -> dict[str, Any]:
    """S3-06: blank text becomes null, null barangays an empty list; 422 naming the field.
    `stored` is the row before a PATCH, so a lone year is checked against the other."""
    for name in TEXT_FIELDS:
        if isinstance(fields.get(name), str):
            fields[name] = fields[name].strip() or None
    if "barangays" in fields:
        codes: list[str] = fields["barangays"] or []
        city = {row[0] for row in conn.execute(SELECT_BARANGAYS).fetchall()}
        unknown = [c for c in codes if c not in city]
        if unknown:
            raise HTTPException(422, f"Barangay {unknown[0]} isn't one of the city's barangays")
        fields["barangays"] = codes
    cost = fields.get("cost")
    if cost is not None and not math.isfinite(cost):
        raise HTTPException(422, "Cost must be a number")
    if cost is not None and cost < 0:
        raise HTTPException(422, "Cost can't be below 0")
    for name, label in (("year_start", "Start year"), ("year_end", "End year")):
        year = fields.get(name)
        if year is not None and not 1000 <= year <= 9999:
            raise HTTPException(422, f"{label} must be 4 digits")
    start = fields.get("year_start", stored.year_start if stored else None)
    end = fields.get("year_end", stored.year_end if stored else None)
    if start is not None and end is not None and end < start:
        raise HTTPException(422, "End year can't be before the start year")
    page_id = fields.get("page_id")
    if page_id is not None:
        page = conn.execute(SELECT_PAGE_PLAN, (page_id,)).fetchone()
        if page is None or page[0] != plan_id:
            raise HTTPException(422, f"Source page {page_id} isn't a page of this plan")
    return fields


@router.post("/plans/{plan_id}/ppas")
def add_ppa(plan_id: int, body: PpaInput, conn: Conn) -> Ppa:
    # S3-03: a confirmed plan's new rows start confirmed (D6).
    plan = writable_plan(conn, plan_id)
    f = clean_fields(conn, plan_id, body.model_dump(), None)
    status = "confirmed" if plan.status == "confirmed" else "draft"
    values = [f[name] for name in EDITABLE]
    with conn.cursor(row_factory=class_row(Ppa)) as cur:
        ppa = cur.execute(INSERT_PPA, (plan_id, *values, status)).fetchone()
    assert ppa
    conn.commit()
    return ppa


@router.patch("/ppas/{ppa_id}")
def update_ppa(ppa_id: int, body: PpaInput, conn: Conn) -> Ppa:
    # S3-04: only the fields sent change; null clears one; the status is kept.
    stored = fetch_ppa(conn, ppa_id)
    writable_plan(conn, stored.plan_id)
    fields = clean_fields(conn, stored.plan_id, body.model_dump(exclude_unset=True), stored)
    names = [name for name in EDITABLE if name in fields]
    if not names:
        return stored
    query = sql.SQL("UPDATE ppas SET {} WHERE id = %s RETURNING {}").format(
        sql.SQL(", ").join(sql.SQL("{} = %s").format(sql.Identifier(n)) for n in names),
        sql.SQL(PPA_COLUMNS),
    )
    with conn.cursor(row_factory=class_row(Ppa)) as cur:
        ppa = cur.execute(query, (*(fields[n] for n in names), ppa_id)).fetchone()
    assert ppa
    conn.commit()
    return ppa


@router.delete("/ppas/{ppa_id}", status_code=204)
def delete_ppa(ppa_id: int, conn: Conn) -> Response:
    # S3-05.
    writable_plan(conn, fetch_ppa(conn, ppa_id).plan_id)
    conn.execute(DELETE_PPA, (ppa_id,))
    conn.commit()
    return Response(status_code=204)


@router.post("/plans/{plan_id}/confirm")
def confirm_plan(plan_id: int, conn: Conn) -> Plan:
    # S3-08: the plan and all its rows in one transaction; a confirmed plan is unchanged.
    plan = writable_plan(conn, plan_id)
    if plan.status == "confirmed":
        return plan
    count = conn.execute(COUNT_PPAS, (plan_id,)).fetchone()
    if count is None or count[0] == 0:
        raise HTTPException(409, "Add a row first")
    conn.execute(CONFIRM_PPAS, (plan_id,))
    with conn.cursor(row_factory=class_row(Plan)) as cur:
        confirmed = cur.execute(CONFIRM_PLAN, (plan_id,)).fetchone()
    assert confirmed
    conn.commit()
    return confirmed
