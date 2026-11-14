"""Database test switch (D7): tests read TEST_DATABASE_URL and never DATABASE_URL."""

import os

import pytest

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")

needs_db = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="TEST_DATABASE_URL is unset; database tests skipped (D7: tests never use DATABASE_URL)",
)
