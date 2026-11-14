"""Storing a run, listing findings, review and the latest run (lane:data, S4-08 to S4-11)."""

from dataclasses import dataclass
from datetime import datetime

import psycopg
from fastapi import HTTPException
from psycopg.rows import class_row
from psycopg.types.json import Jsonb

from app.models import (
    CccCell,
    CccMatrix,
    CccPpa,
    CccVerdict,
    CheckCount,
    CheckName,
    CheckRunResult,
    Finding,
    FindingCreatedBy,
    FindingPpa,
    FindingStatus,
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


@dataclass
class OldReview:
    """What a re-run may carry over from a stored finding (D5)."""

    check: CheckName
    ppa_a: int
    ppa_b: int | None
    barangay: str | None
    status: FindingStatus
    note: str | None
    reviewed_at: datetime | None
    verdict: CccVerdict | None
    # Both PPAs unchanged since the review: the status and reviewed_at carry over.
    unchanged: bool


# D5: kept only when reviewed and both PPAs were last updated before the review.
SELECT_OLD_REVIEWS = """
SELECT f."check", f.ppa_a, f.ppa_b, f.barangay, f.status, f.note, f.reviewed_at,
       f.verdict,
       coalesce(f.reviewed_at > pa.updated_at
                AND (pb.id IS NULL OR f.reviewed_at > pb.updated_at), false) AS unchanged
FROM findings f
JOIN ppas pa ON pa.id = f.ppa_a
LEFT JOIN ppas pb ON pb.id = f.ppa_b
"""
DELETE_FINDINGS = "DELETE FROM findings"
INSERT_FINDING = """
INSERT INTO findings ("check", ppa_a, ppa_b, verdict, reason, page_ids, status, note,
                      created_by, reviewed_at, barangay)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
"""
INSERT_RUN = "INSERT INTO check_runs (counts) VALUES (%s) RETURNING ran_at, counts"
SELECT_LATEST_RUN = "SELECT ran_at, counts FROM check_runs ORDER BY id DESC LIMIT 1"

FINDING_COLUMNS = """id, "check", ppa_a, ppa_b, verdict, reason, page_ids, status, note,
       created_by, barangay"""
# S5-07: a CCC finding of any other verdict feeds only the matrix.
SELECT_FINDINGS = f"""
SELECT {FINDING_COLUMNS} FROM findings
WHERE "check" <> 'ccc' OR verdict = 'Conflict'
ORDER BY "check", barangay, id
"""
# S5-08: every confirmed PPA of a confirmed plan, and every stored CCC verdict.
SELECT_CCC_PPAS = """
SELECT p.id, pl.type AS plan_type, coalesce(p.code, '') AS code, p.title
FROM ppas p JOIN plans pl ON pl.id = p.plan_id
WHERE p.status = 'confirmed' AND pl.status = 'confirmed'
ORDER BY pl.type, p.code, p.id
"""
SELECT_CCC_CELLS = """
SELECT ppa_a, ppa_b, verdict, status, reason, page_ids
FROM findings WHERE "check" = 'ccc' AND verdict IS NOT NULL AND ppa_b IS NOT NULL
ORDER BY id
"""
SELECT_FINDING = f"SELECT {FINDING_COLUMNS} FROM findings WHERE id = %s"
SELECT_FINDING_PPAS = """
SELECT p.id, p.plan_id, p.code, p.title, p.description, p.office, p.sector, p.barangays,
       p.cost, p.year_start, p.year_end, p.page_id, p.status, pl.type AS plan_type
FROM ppas p JOIN plans pl ON pl.id = p.plan_id
WHERE p.id = ANY (%s)
"""
# S4-10: confirmed or rejected stamps reviewed_at, suggested clears it; a null status or
# an unsent note leaves that column alone.
UPDATE_FINDING = """
UPDATE findings SET
    status = coalesce(%(status)s::text, status),
    reviewed_at = CASE
        WHEN %(status)s::text IS NULL THEN reviewed_at
        WHEN %(status)s::text = 'suggested' THEN NULL
        ELSE now()
    END,
    note = CASE WHEN %(set_note)s::boolean THEN %(note)s::text ELSE note END
WHERE id = %(id)s
RETURNING id
"""

# (check, ppa_a, ppa_b, barangay) as store_run matches an old finding to a new one.
ReviewKey = tuple[str, int, int | None, str | None]


@dataclass
class StoredFinding:
    id: int
    check: CheckName
    ppa_a: int
    ppa_b: int | None
    verdict: CccVerdict | None
    reason: str
    page_ids: list[int]
    status: FindingStatus
    note: str | None
    created_by: FindingCreatedBy
    barangay: str | None


def review_key(check: str, ppa_a: int, ppa_b: int | None, barangay: str | None) -> ReviewKey:
    """S4-08: match on check, ppa_a and ppa_b; an orphan on ppa_a only. A zone finding also
    matches on its barangay, since one PPA can conflict with two barangays' zones."""
    return (
        check,
        ppa_a,
        None if check == "orphan" else ppa_b,
        barangay if check == "zone" else None,
    )


def store_run(
    conn: psycopg.Connection, counts: list[CheckCount], findings: list[NewFinding]
) -> CheckRunResult:
    """Replace the findings, carry over reviews (D5), insert a check_runs row, in one
    transaction (S4-08)."""
    with conn.transaction():
        with conn.cursor(row_factory=class_row(OldReview)) as cur:
            old = {
                review_key(r.check, r.ppa_a, r.ppa_b, r.barangay): r
                for r in cur.execute(SELECT_OLD_REVIEWS).fetchall()
            }
        conn.execute(DELETE_FINDINGS)
        for f in findings:
            review = old.get(review_key(f.check, f.ppa_a, f.ppa_b, f.barangay))
            status, reviewed_at = "suggested", None
            # An orphan matches on ppa_a, so its note carries, but a review of one suggested
            # parent says nothing about another: the status carries only for the same ppa_b.
            # S5-06: a CCC review also needs the same verdict; its note carries regardless.
            if (
                review
                and review.unchanged
                and review.ppa_b == f.ppa_b
                and review.verdict == f.verdict
            ):
                status, reviewed_at = review.status, review.reviewed_at
            conn.execute(
                INSERT_FINDING,
                (
                    f.check,
                    f.ppa_a,
                    f.ppa_b,
                    f.verdict,
                    f.reason,
                    f.page_ids,
                    status,
                    review.note if review else None,
                    f.created_by,
                    reviewed_at,
                    f.barangay,
                ),
            )
        with conn.cursor(row_factory=class_row(CheckRunResult)) as cur:
            result = cur.execute(INSERT_RUN, (Jsonb([c.model_dump() for c in counts]),)).fetchone()
    assert result
    conn.commit()
    return result


def with_ppas(conn: psycopg.Connection, stored: list[StoredFinding]) -> list[Finding]:
    ids = {f.ppa_a for f in stored} | {f.ppa_b for f in stored if f.ppa_b is not None}
    with conn.cursor(row_factory=class_row(FindingPpa)) as cur:
        ppas = {p.id: p for p in cur.execute(SELECT_FINDING_PPAS, (list(ids),)).fetchall()}
    return [
        Finding(
            id=f.id,
            check=f.check,
            ppa_a=ppas[f.ppa_a],
            ppa_b=ppas[f.ppa_b] if f.ppa_b is not None else None,
            verdict=f.verdict,
            reason=f.reason,
            page_ids=f.page_ids,
            status=f.status,
            note=f.note,
            created_by=f.created_by,
            barangay=f.barangay,
        )
        for f in stored
    ]


def list_findings(conn: psycopg.Connection) -> list[Finding]:
    """Every finding with both PPAs, ordered by check, barangay, id (S4-09)."""
    with conn.cursor(row_factory=class_row(StoredFinding)) as cur:
        stored = cur.execute(SELECT_FINDINGS).fetchall()
    return with_ppas(conn, stored)


def update_finding(conn: psycopg.Connection, finding_id: int, body: FindingUpdate) -> Finding:
    """Confirm, reject or note a finding; accept or reject an orphan's parent link.
    404 for an unknown id (S4-10)."""
    set_note = "note" in body.model_fields_set
    note = (body.note or "").strip() or None
    params = {"id": finding_id, "status": body.status, "set_note": set_note, "note": note}
    if conn.execute(UPDATE_FINDING, params).fetchone() is None:
        raise HTTPException(status_code=404, detail="Finding not found")
    with conn.cursor(row_factory=class_row(StoredFinding)) as cur:
        stored = cur.execute(SELECT_FINDING, (finding_id,)).fetchone()
    assert stored
    # Imported here: orphan.py imports NewFinding from this module.
    from app.checks.orphan import apply_review

    # Same transaction as the finding, so the finding and its link change together.
    apply_review(conn, stored.check, stored.ppa_a, stored.ppa_b, body.status)
    conn.commit()
    return with_ppas(conn, [stored])[0]


def latest_run(conn: psycopg.Connection) -> CheckRunResult | None:
    """The newest check_runs row, or None before any run (S4-11)."""
    with conn.cursor(row_factory=class_row(CheckRunResult)) as cur:
        return cur.execute(SELECT_LATEST_RUN).fetchone()


def ccc_matrix(conn: psycopg.Connection) -> CccMatrix:
    """The CCC matrix the screen and the export both read (S5-08, S5-SH-01)."""
    with conn.cursor(row_factory=class_row(CccPpa)) as cur:
        ppas = cur.execute(SELECT_CCC_PPAS).fetchall()
    with conn.cursor(row_factory=class_row(CccCell)) as cur:
        cells = cur.execute(SELECT_CCC_CELLS).fetchall()
    return CccMatrix(ppas=ppas, cells=cells)
