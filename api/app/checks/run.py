"""POST /checks/run: duplicate, orphan, CCC and zone, then storage (lane:ai, S4-14)."""

import psycopg

from app.checks import ccc, findings, orphan, rules
from app.models import CheckRunResult


def run_checks(conn: psycopg.Connection) -> CheckRunResult:
    duplicate_count, duplicates = rules.find_duplicates(conn)
    orphan_count, orphans = orphan.find_orphans(conn)
    zone_count, zones = rules.find_zone_conflicts(conn)
    ccc_count, ccc_findings = ccc.find_ccc(conn)
    return findings.store_run(
        conn,
        [duplicate_count, orphan_count, ccc_count, zone_count],
        duplicates + orphans + ccc_findings + zones,
    )
