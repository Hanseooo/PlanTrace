"""Shared database fixtures (D7).

`empty_db` drops and recreates the public schema of TEST_DATABASE_URL, so never point
TEST_DATABASE_URL at a database you want to keep. Mark its tests with `tests.db.needs_db`.
"""

from collections.abc import Iterator

import psycopg
import pytest

from tests.db import TEST_DATABASE_URL


@pytest.fixture
def empty_db() -> Iterator[psycopg.Connection]:
    """An autocommit connection to the test database with an empty public schema."""
    assert TEST_DATABASE_URL
    with psycopg.connect(TEST_DATABASE_URL, autocommit=True) as conn:
        conn.execute("DROP SCHEMA public CASCADE")
        conn.execute("CREATE SCHEMA public")
        yield conn
