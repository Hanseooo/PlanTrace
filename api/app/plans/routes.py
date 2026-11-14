"""Plan list, PPA table edits, confirm (lane:data). GET /plans (S1-11), GET /plans/{id}
and GET /plans/{id}/ppas (S2-16), GET /barangays and GET /pages/{id} (S3-01, S3-02) read
the database. The writes are stubs until S3:
they ignore path IDs and don't persist until the real queries land (SH-01)."""

from typing import Annotated

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Response
from psycopg.rows import class_row

from app.db import get_conn
from app.fixtures import load_fixture
from app.models import Barangay, Page, Plan, Ppa, PpaInput

router = APIRouter()

SELECT_PLANS = """
SELECT id, lgu_psgc, type, title, period_start, period_end, status, error
FROM plans ORDER BY id
"""
SELECT_PLAN = """
SELECT id, lgu_psgc, type, title, period_start, period_end, status, error
FROM plans WHERE id = %s
"""
SELECT_PPAS = """
SELECT id, plan_id, code, title, description, office, sector, barangays, cost,
       year_start, year_end, page_id, status
FROM ppas WHERE plan_id = %s ORDER BY id
"""

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


@router.post("/plans/{plan_id}/ppas")
def add_ppa(plan_id: int, body: PpaInput) -> Ppa:
    return load_fixture("ppas.json", list[Ppa])[0]


@router.patch("/ppas/{ppa_id}")
def update_ppa(ppa_id: int, body: PpaInput) -> Ppa:
    return load_fixture("ppas.json", list[Ppa])[0]


@router.delete("/ppas/{ppa_id}", status_code=204)
def delete_ppa(ppa_id: int) -> Response:
    return Response(status_code=204)


@router.post("/plans/{plan_id}/confirm")
def confirm_plan(plan_id: int) -> Plan:
    return load_fixture("plans.json", list[Plan])[0]
