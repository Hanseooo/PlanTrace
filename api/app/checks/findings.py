"""Storing a run, listing findings, review and the latest run (lane:data, S4-08 to S4-11).

Stubs: they ignore the connection and serve seed/fixtures/ until #38 lands the real queries.
"""

from dataclasses import dataclass

import psycopg

from app.fixtures import load_fixture
from app.models import (
    CccVerdict,
    CheckCount,
    CheckName,
    CheckRunResult,
    Finding,
    FindingCreatedBy,
    FindingUpdate,
)


@dataclass
class NewFinding:
    """A finding a check raised, before store_run gives it an id and a review status."""

    check: CheckName
    ppa_a: int
    ppa_b: int | None  # null for a zone finding or an orphan without a suggestion
    barangay: str | None  # PSGC code it is grouped under
    reason: str
    page_ids: list[int]
    created_by: FindingCreatedBy
    verdict: CccVerdict | None = None  # set only for check "ccc" (S5)


def store_run(
    conn: psycopg.Connection, counts: list[CheckCount], findings: list[NewFinding]
) -> CheckRunResult:
    """Replace the findings, carry over reviews (D5), insert a check_runs row, in one
    transaction (S4-08)."""
    return load_fixture("checks_run.json", CheckRunResult)


def list_findings(conn: psycopg.Connection) -> list[Finding]:
    """Every finding with both PPAs, ordered by check, barangay, id (S4-09)."""
    return load_fixture("findings.json", list[Finding])


def update_finding(conn: psycopg.Connection, finding_id: int, body: FindingUpdate) -> Finding:
    """Confirm, reject or note a finding; accept or reject an orphan's parent link.
    404 for an unknown id (S4-10)."""
    return load_fixture("findings.json", list[Finding])[0]


def latest_run(conn: psycopg.Connection) -> CheckRunResult | None:
    """The newest check_runs row, or None before any run (S4-11)."""
    return load_fixture("checks_run.json", CheckRunResult)
