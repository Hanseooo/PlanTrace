import os

import psycopg


def connect(url: str | None = None) -> psycopg.Connection:
    """Open a connection to `url`, or to DATABASE_URL when no url is given."""
    url = url or os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return psycopg.connect(url)
