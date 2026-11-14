"""S0-06: every MVP endpoint answers with a body valid against its model.

GET /plans (S1-11), GET /plans/{id}, GET /plans/{id}/ppas (S2-16), GET /barangays and
GET /pages/{id} (S3-01, S3-02) read the database, as do the PPA writes and confirm (S3-03 to
S3-08); tests/test_plans.py covers them. POST /plans (S2-10) is covered by
tests/test_extract.py. POST /checks/run, GET /checks/latest, GET /findings,
PATCH /findings/{id} (S4-08 to S4-11), GET /ccc and GET /ccc/export (S5-08, S5-09) are
covered by tests/test_checks.py. No stub is left, so no case remains here for the
no-database check.
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_retry_is_advertised_as_multipart() -> None:
    """The retry's behaviour is tested in test_extract.py against the database (S2-14)."""
    content = app.openapi()["paths"]["/plans/{plan_id}/retry"]["post"]["requestBody"]["content"]
    assert list(content) == ["multipart/form-data"]
