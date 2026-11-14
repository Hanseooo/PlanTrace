import os
from collections.abc import Iterator

import psycopg
from fastapi import HTTPException


def connect(url: str | None = None) -> psycopg.Connection:
    """Open a connection to `url`, or to DATABASE_URL when no url is given."""
    url = url or os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return psycopg.connect(url)


def get_conn() -> Iterator[psycopg.Connection]:
    """FastAPI dependency: one DATABASE_URL connection per request, 503 when there is none.

    Tests override it with a TEST_DATABASE_URL connection (D7).
    """
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise HTTPException(503, "The PlanTrace API has no DATABASE_URL set")
    try:
        conn = psycopg.connect(url)
    except psycopg.OperationalError as e:
        raise HTTPException(503, "The PlanTrace API can't reach its database") from e
    with conn:
        yield conn
