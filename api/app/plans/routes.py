"""Plan list, PPA table edits, confirm (lane:data). GET /plans (S1-11), GET /plans/{id}
and GET /plans/{id}/ppas (S2-16) read the database. The writes are stubs until S3:
they ignore path IDs and don't persist until the real queries land (SH-01)."""

from typing import Annotated

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Response
from psycopg.rows import class_row

from app.db import get_conn
from app.fixtures import load_fixture
from app.models import Plan, Ppa, PpaInput

router = APIRouter()

PLAN_COLUMNS = "id, lgu_psgc, type, title, period_start, period_end, status, error"
SELECT_PLANS = f"SELECT {PLAN_COLUMNS} FROM plans ORDER BY id"
SELECT_PLAN = f"SELECT {PLAN_COLUMNS} FROM plans WHERE id = %s"
SELECT_PPAS = """
SELECT id, plan_id, code, title, description, office, sector, barangays, cost,
       year_start, year_end, page_id, status
FROM ppas WHERE plan_id = %s ORDER BY id
"""

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
