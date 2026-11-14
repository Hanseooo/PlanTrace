"""POST /checks/run: duplicate, orphan and zone, then storage (lane:ai, S4-14).

Until #38 and #39 land, the checks find nothing and store_run returns the fixture.
"""

import psycopg

from app.checks import findings, orphan, rules
from app.models import CheckCount, CheckRunResult


def run_checks(conn: psycopg.Connection) -> CheckRunResult:
    duplicate_count, duplicates = rules.find_duplicates(conn)
    orphan_count, orphans = orphan.find_orphans(conn)
    zone_count, zones = rules.find_zone_conflicts(conn)
    # S5 replaces this with the CCC check.
    ccc_count = CheckCount(check="ccc", checked=0, found=0)
    return findings.store_run(
        conn,
        [duplicate_count, orphan_count, ccc_count, zone_count],
        duplicates + orphans + zones,
    )
