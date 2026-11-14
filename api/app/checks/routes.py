"""Checks, findings and the CCC matrix (lane:ai). Stubs: they ignore path IDs and
don't persist writes until the real queries land (SH-01)."""

from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.fixtures import FIXTURES_DIR, load_fixture
from app.models import CccMatrix, CheckRunResult, Finding, FindingUpdate

router = APIRouter()

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.post("/checks/run")
def run_checks() -> CheckRunResult:
    return load_fixture("checks_run.json", CheckRunResult)


@router.get("/findings")
def list_findings() -> list[Finding]:
    return load_fixture("findings.json", list[Finding])


@router.patch("/findings/{finding_id}")
def update_finding(finding_id: int, body: FindingUpdate) -> Finding:
    return load_fixture("findings.json", list[Finding])[0]


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
        filename="ccc_matrix.xlsx",
    )
