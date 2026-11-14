"""Checks, findings and the CCC matrix. Wiring only: each route calls one function in a
lane-owned file (S4-SH-02). rules.py and findings.py are lane:data; orphan.py and run.py
are lane:ai, and S5 adds ccc.py. Change this file only through the contract.

The /ccc stubs ignore path IDs until S5 lands the real queries (SH-01)."""

from typing import Annotated

import psycopg
from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse

from app.checks import findings, run
from app.db import get_conn
from app.fixtures import FIXTURES_DIR, load_fixture
from app.models import CccMatrix, CheckRunResult, Finding, FindingUpdate

router = APIRouter()

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

Conn = Annotated[psycopg.Connection, Depends(get_conn)]


@router.post("/checks/run")
def run_checks(conn: Conn) -> CheckRunResult:
    return run.run_checks(conn)


@router.get("/checks/latest")
def get_latest_run(conn: Conn) -> CheckRunResult | None:
    return findings.latest_run(conn)


@router.get("/findings")
def list_findings(conn: Conn) -> list[Finding]:
    return findings.list_findings(conn)


@router.patch("/findings/{finding_id}")
def update_finding(finding_id: int, body: FindingUpdate, conn: Conn) -> Finding:
    return findings.update_finding(conn, finding_id, body)


@router.get("/ccc")
def get_ccc() -> CccMatrix:
    return load_fixture("ccc.json", CccMatrix)


@router.get(
    "/ccc/export",
    response_class=FileResponse,
    responses={200: {"content": {XLSX_MEDIA_TYPE: {}}}},
)
def export_ccc() -> FileResponse:
    return FileResponse(
        FIXTURES_DIR / "ccc_export.xlsx",
        media_type=XLSX_MEDIA_TYPE,
        filename="ccc_export.xlsx",
    )
