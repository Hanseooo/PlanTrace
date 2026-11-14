"""Duplicate and zone checks: SQL, no AI (lane:data, S4-04 to S4-07)."""

from dataclasses import dataclass
from decimal import Decimal

import psycopg
from psycopg.rows import class_row

from app.checks.findings import NewFinding
from app.models import CheckCount
from app.plans.routes import SELECT_BARANGAYS

# S4-05. On the seed the 3 planted pairs score 0.84, 0.67 and 0.53; the best other pair 0.22.
SIMILARITY_THRESHOLD = 0.4

# S4-04 (AC-15): only confirmed PPAs of confirmed plans are checked.
CHECKED_PPAS = """
WITH checked AS (
    SELECT p.*, pl.type AS plan_type
    FROM ppas p JOIN plans pl ON pl.id = p.plan_id
    WHERE p.status = 'confirmed' AND pl.status = 'confirmed'
)
"""
# Every candidate pair (S4-07 counts them), with its title similarity.
SELECT_DUPLICATE_CANDIDATES = f"""{CHECKED_PPAS}
SELECT a.id AS ppa_a, b.id AS ppa_b, a.plan_type AS plan_a, b.plan_type AS plan_b,
       ARRAY(SELECT unnest(a.barangays) INTERSECT SELECT unnest(b.barangays) ORDER BY 1)
           AS shared_barangays,
       a.barangays AS barangays_a,
       CASE WHEN a.sector = b.sector THEN a.sector END AS shared_sector,
       a.cost AS cost_a, b.cost AS cost_b,
       a.year_start AS start_a, a.year_end AS end_a,
       b.year_start AS start_b, b.year_end AS end_b,
       a.page_id AS page_a, b.page_id AS page_b,
       coalesce(similarity(a.title, b.title), 0) AS score
FROM checked a JOIN checked b
  ON a.id < b.id
 AND a.plan_id <> b.plan_id
 AND (a.barangays && b.barangays OR a.sector = b.sector)
ORDER BY a.id, b.id
"""
# Every (PPA with a sector, zone of one of its barangays) pair, forbidden or not (S4-07).
SELECT_ZONE_CANDIDATES = f"""{CHECKED_PPAS}
SELECT p.id AS ppa, p.sector, p.page_id AS ppa_page, z.barangay, z.zone_type, z.hazard,
       z.page_id AS zone_page, zp.type AS zone_plan,
       p.sector = ANY (z.forbidden_sectors) AS forbidden
FROM checked p
JOIN zones z ON z.barangay = ANY (p.barangays)
JOIN plans zp ON zp.id = z.plan_id AND zp.status = 'confirmed'
WHERE p.sector IS NOT NULL
ORDER BY p.id, z.barangay
"""

NOT_STATED = "not stated"


@dataclass
class DuplicateCandidate:
    ppa_a: int
    ppa_b: int
    plan_a: str
    plan_b: str
    shared_barangays: list[str]
    barangays_a: list[str]
    shared_sector: str | None
    cost_a: Decimal | None
    cost_b: Decimal | None
    start_a: int | None
    end_a: int | None
    start_b: int | None
    end_b: int | None
    page_a: int | None
    page_b: int | None
    score: float


@dataclass
class ZoneCandidate:
    ppa: int
    sector: str
    ppa_page: int | None
    barangay: str
    zone_type: str | None
    hazard: str | None
    zone_page: int | None
    zone_plan: str
    forbidden: bool


def barangay_names(conn: psycopg.Connection) -> dict[str, str]:
    return dict(conn.execute(SELECT_BARANGAYS).fetchall())


def sector_label(sector: str) -> str:
    return sector.replace("_", " ")


def year_range(start: int | None, end: int | None) -> str:
    if start is None or end is None or start == end:
        return str(start or end or NOT_STATED)
    return f"{start}–{end}"


def peso(amount: Decimal | None) -> str:
    return NOT_STATED if amount is None else f"₱{amount:,.0f}"


def duplicate_reason(c: DuplicateCandidate, names: dict[str, str]) -> str:
    if c.shared_barangays:
        where = " and ".join(names.get(code, code) for code in c.shared_barangays)
    else:
        assert c.shared_sector
        where = f"the {sector_label(c.shared_sector)} sector"
    if c.cost_a is None or c.cost_b is None:
        cost = f"Cost: {peso(c.cost_a)} vs {peso(c.cost_b)}"
    else:
        cost = f"Cost differs by {peso(abs(c.cost_a - c.cost_b))}"
    years = f"{year_range(c.start_a, c.end_a)} vs {year_range(c.start_b, c.end_b)}"
    return f"Similar titles in {c.plan_a} and {c.plan_b}, both in {where}. {cost}. Years: {years}."


def zone_reason(c: ZoneCandidate, names: dict[str, str]) -> str:
    if c.zone_type:
        article = "an" if c.zone_type[0].lower() in "aeiou" else "a"
        zone = f"{article} {c.zone_type} zone"
    else:
        zone = "a zone"
    hazard = f" ({c.hazard})" if c.hazard else ""
    return (
        f"{names.get(c.barangay, c.barangay)} is {zone}{hazard} in the {c.zone_plan}, "
        f"where {sector_label(c.sector)} is not an allowed use."
    )


def pages(*page_ids: int | None) -> list[int]:
    return [p for p in page_ids if p is not None]


def find_duplicates(conn: psycopg.Connection) -> tuple[CheckCount, list[NewFinding]]:
    """Similar confirmed PPAs of different plans sharing a barangay or sector (S4-05)."""
    with conn.cursor(row_factory=class_row(DuplicateCandidate)) as cur:
        candidates = cur.execute(SELECT_DUPLICATE_CANDIDATES).fetchall()
    names = barangay_names(conn)
    found = [
        NewFinding(
            check="duplicate",
            ppa_a=c.ppa_a,
            ppa_b=c.ppa_b,
            # The lowest shared barangay, else ppa_a's lowest, else none.
            barangay=min(c.shared_barangays or c.barangays_a, default=None),
            reason=duplicate_reason(c, names),
            page_ids=pages(c.page_a, c.page_b),
            created_by="rule",
        )
        for c in candidates
        if c.score >= SIMILARITY_THRESHOLD
    ]
    return CheckCount(check="duplicate", checked=len(candidates), found=len(found)), found


def find_zone_conflicts(conn: psycopg.Connection) -> tuple[CheckCount, list[NewFinding]]:
    """Confirmed PPAs in a barangay whose CLUP zone forbids their sector (S4-06)."""
    with conn.cursor(row_factory=class_row(ZoneCandidate)) as cur:
        candidates = cur.execute(SELECT_ZONE_CANDIDATES).fetchall()
    names = barangay_names(conn)
    found = [
        NewFinding(
            check="zone",
            ppa_a=c.ppa,
            ppa_b=None,
            barangay=c.barangay,
            reason=zone_reason(c, names),
            page_ids=pages(c.ppa_page, c.zone_page),
            created_by="rule",
        )
        for c in candidates
        if c.forbidden
    ]
    return CheckCount(check="zone", checked=len(candidates), found=len(found)), found
