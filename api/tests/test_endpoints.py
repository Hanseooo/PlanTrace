"""S0-06: every MVP endpoint answers with a body valid against its model.

GET /plans (S1-11), GET /plans/{id} and GET /plans/{id}/ppas (S2-16) read the database;
tests/test_plans.py covers them.
"""

from io import BytesIO
from typing import Any

import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook
from pydantic import TypeAdapter

from app.main import app
from app.models import CccMatrix, CheckRunResult, Finding, Plan, Ppa

client = TestClient(app)

CASES: list[tuple[str, str, dict[str, Any], Any]] = [
    ("POST", "/plans/2/ppas", {"json": {}}, Ppa),
    ("PATCH", "/ppas/201", {"json": {"cost": 1000}}, Ppa),
    ("POST", "/plans/2/confirm", {}, Plan),
    ("POST", "/checks/run", {}, CheckRunResult),
    ("GET", "/findings", {}, list[Finding]),
    ("PATCH", "/findings/1", {"json": {"status": "confirmed"}}, Finding),
    ("GET", "/ccc", {}, CccMatrix),
]


@pytest.mark.parametrize(("method", "path", "kwargs", "model"), CASES)
def test_endpoint_body_matches_model(
    method: str, path: str, kwargs: dict[str, Any], model: Any
) -> None:
    response = client.request(method, path, **kwargs)
    assert response.status_code == 200, response.text
    TypeAdapter(model).validate_python(response.json())


def test_upload_returns_extracting_plan() -> None:
    response = client.post(
        "/plans",
        files={"file": ("lccap.pdf", b"%PDF-1.4", "application/pdf")},
        data={"type": "LCCAP", "period_start": "2026", "period_end": "2028"},
    )
    assert response.status_code == 200, response.text
    assert Plan.model_validate(response.json()).status == "extracting"
    # The web client is generated from OpenAPI, so the upload must be advertised as multipart.
    content = app.openapi()["paths"]["/plans"]["post"]["requestBody"]["content"]
    assert list(content) == ["multipart/form-data"]


def test_retry_returns_a_plan() -> None:
    """Stub until #21: the retry route exists in the contract (S2-14)."""
    response = client.post(
        "/plans/5/retry", files={"file": ("lccap.pdf", b"%PDF-1.4", "application/pdf")}
    )
    assert response.status_code == 200, response.text
    Plan.model_validate(response.json())
    content = app.openapi()["paths"]["/plans/{plan_id}/retry"]["post"]["requestBody"]["content"]
    assert list(content) == ["multipart/form-data"]


def test_delete_ppa_returns_no_content() -> None:
    assert client.delete("/ppas/201").status_code == 204


def test_fixtures_show_the_sampaguita_journey() -> None:
    findings = client.get("/findings").json()
    assert len(findings) == 8
    assert {f["check"] for f in findings} == {"duplicate", "orphan", "ccc", "zone"}
    counts = client.post("/checks/run").json()["counts"]
    assert sum(c["found"] for c in counts) == 8


def test_ccc_export_is_an_xlsx() -> None:
    response = client.get("/ccc/export")
    assert response.status_code == 200
    assert response.headers["content-type"] == (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert 'filename="ccc_export.xlsx"' in response.headers["content-disposition"]
    load_workbook(BytesIO(response.content))
