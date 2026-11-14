"""Orphan check: AIP PPAs with no confirmed CDP or LDIP parent, and the AI's suggested
parent through llm.py (lane:ai, S4-12, S4-13).

Stub: it checks nothing until #39 lands the real query and AI call.
"""

import psycopg

from app.checks.findings import NewFinding
from app.models import CheckCount


def find_orphans(conn: psycopg.Connection) -> tuple[CheckCount, list[NewFinding]]:
    """One finding per orphan; an AI failure saves it without a suggestion (S4-13)."""
    return CheckCount(check="orphan", checked=0, found=0), []
