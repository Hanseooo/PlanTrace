"""Checks, findings and the CCC matrix. Wiring only: each route calls one function in a
lane-owned file (S4-SH-02). rules.py, findings.py and ccc_export.py are lane:data;
orphan.py, ccc.py and run.py are lane:ai. Change this file only through the
contract."""

from typing import Annotated

import psycopg
from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.checks import ccc_export, findings, run
from app.db import get_conn
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
def get_ccc(conn: Conn) -> CccMatrix:
    return findings.ccc_matrix(conn)


@router.get(
    "/ccc/export",
    response_class=Response,
    responses={200: {"content": {XLSX_MEDIA_TYPE: {}}}},
)
def export_ccc(conn: Conn) -> Response:
    return Response(
        ccc_export.export(conn),
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": 'attachment; filename="ccc_export.xlsx"'},
    )
