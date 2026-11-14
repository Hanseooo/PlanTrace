"""Duplicate and zone checks: SQL, no AI (lane:data, S4-04 to S4-07).

Stubs: they find nothing until #38 lands the real queries.
"""

import psycopg

from app.checks.findings import NewFinding
from app.models import CheckCount


def find_duplicates(conn: psycopg.Connection) -> tuple[CheckCount, list[NewFinding]]:
    """Similar confirmed PPAs of different plans sharing a barangay or sector (S4-05)."""
    return CheckCount(check="duplicate", checked=0, found=0), []


def find_zone_conflicts(conn: psycopg.Connection) -> tuple[CheckCount, list[NewFinding]]:
    """Confirmed PPAs in a barangay whose CLUP zone forbids their sector (S4-06)."""
    return CheckCount(check="zone", checked=0, found=0), []
