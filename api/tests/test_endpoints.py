"""S0-06: every MVP endpoint answers with a body valid against its model.

GET /plans (S1-11), GET /plans/{id}, GET /plans/{id}/ppas (S2-16), GET /barangays and
GET /pages/{id} (S3-01, S3-02) read the database, as do the PPA writes and confirm (S3-03 to
S3-08); tests/test_plans.py covers them. POST /plans (S2-10) is covered by
tests/test_extract.py. POST /checks/run, GET /checks/latest, GET /findings and
PATCH /findings/{id} (S4-08 to S4-11) are covered by tests/test_checks.py.

The /ccc stubs take no connection, so these tests hand the app none. Remove a case here
once its real query lands.
"""

from collections.abc import Iterator
from io import BytesIO
from typing import Any

import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook
from pydantic import TypeAdapter

from app.db import get_conn
from app.main import app
from app.models import CccMatrix

client = TestClient(app)


@pytest.fixture(autouse=True)
def no_database() -> Iterator[None]:
    app.dependency_overrides[get_conn] = lambda: None
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_conn)


CASES: list[tuple[str, str, dict[str, Any], Any]] = [
    ("GET", "/ccc", {}, CccMatrix),
]


@pytest.mark.parametrize(("method", "path", "kwargs", "model"), CASES)
def test_endpoint_body_matches_model(
    method: str, path: str, kwargs: dict[str, Any], model: Any
) -> None:
    response = client.request(method, path, **kwargs)
    assert response.status_code == 200, response.text
    TypeAdapter(model).validate_python(response.json())


def test_retry_is_advertised_as_multipart() -> None:
    """The retry's behaviour is tested in test_extract.py against the database (S2-14)."""
    content = app.openapi()["paths"]["/plans/{plan_id}/retry"]["post"]["requestBody"]["content"]
    assert list(content) == ["multipart/form-data"]


def test_ccc_export_is_an_xlsx() -> None:
    response = client.get("/ccc/export")
    assert response.status_code == 200
    assert response.headers["content-type"] == (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert 'filename="ccc_export.xlsx"' in response.headers["content-disposition"]
    load_workbook(BytesIO(response.content))
