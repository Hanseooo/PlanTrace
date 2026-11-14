"""Plan list, PPA table edits, confirm (lane:data). GET /plans reads the database (S1-11).
The rest are stubs: they ignore path IDs and don't persist writes until the real
queries land (SH-01)."""

from typing import Annotated

import psycopg
from fastapi import APIRouter, Depends, Response
from psycopg.rows import class_row

from app.db import get_conn
from app.fixtures import load_fixture
from app.models import Plan, Ppa, PpaInput

router = APIRouter()

SELECT_PLANS = """
SELECT id, lgu_psgc, type, title, period_start, period_end, status, error
FROM plans ORDER BY id
"""


@router.get("/plans")
def list_plans(conn: Annotated[psycopg.Connection, Depends(get_conn)]) -> list[Plan]:
    with conn.cursor(row_factory=class_row(Plan)) as cur:
        return cur.execute(SELECT_PLANS).fetchall()


@router.get("/plans/{plan_id}")
def get_plan(plan_id: int) -> Plan:
    return load_fixture("plans.json", list[Plan])[0]


@router.get("/plans/{plan_id}/ppas")
def list_ppas(plan_id: int) -> list[Ppa]:
    return load_fixture("ppas.json", list[Ppa])


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
