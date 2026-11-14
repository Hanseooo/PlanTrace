"""S1-11: GET /plans reads the plans table (D7: the seeded TEST_DATABASE_URL only).

The seeded test uses the `empty_db` fixture (conftest.py), as test_seed does.
"""

import json
from collections.abc import Iterator
from pathlib import Path

import psycopg
import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter

from app.db import get_conn
from app.db.migrate import migrate
from app.db.seed import SEED_DIR, seed
from app.main import app
from app.models import Plan
from tests.db import TEST_DATABASE_URL, needs_db


@pytest.fixture
def seeded_client(empty_db: psycopg.Connection, tmp_path: Path) -> Iterator[TestClient]:
    migrate(empty_db)
    seed(empty_db, tmp_path)

    def test_conn() -> Iterator[psycopg.Connection]:
        assert TEST_DATABASE_URL
        with psycopg.connect(TEST_DATABASE_URL) as conn:
            yield conn

    app.dependency_overrides[get_conn] = test_conn
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_conn)


@needs_db
def test_list_plans_returns_the_4_seeded_plans(seeded_client: TestClient) -> None:
    response = seeded_client.get("/plans")
    assert response.status_code == 200, response.text
    plans = TypeAdapter(list[Plan]).validate_python(response.json())
    # The hand-written S0 fixture holds the same 4 plans the seed loads.
    expected = json.loads((SEED_DIR / "fixtures" / "plans.json").read_text(encoding="utf-8"))
    assert [p.model_dump() for p in plans] == expected


def test_list_plans_without_database_url_is_503(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    response = TestClient(app).get("/plans")
    assert response.status_code == 503
    assert "DATABASE_URL" in response.json()["detail"]
