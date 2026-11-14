"""Orphan check: AIP PPAs with no confirmed CDP or LDIP parent, and the AI's suggested
parent through llm.py (lane:ai, S4-12, S4-13), plus the parent link a review sets (S4-10).

The model reads PPAs by code, never by database id, so the cache key survives a reseed and
`app.extract.load_cache` can prime it from seed/ai_cache/orphans.json (S4-15).
"""

from dataclasses import dataclass

import psycopg
from psycopg.rows import class_row
from pydantic import BaseModel

from app import llm
from app.checks.findings import NewFinding
from app.models import CheckCount, CheckName, FindingStatus

ORPHAN_PROMPT = """\
You help a Philippine city planner link projects across plans. An Annual Investment Program \
(AIP) project should carry out a program of the Comprehensive Development Plan (CDP) or the \
Local Development Investment Program (LDIP), but this one is linked to none.

The input gives the AIP project, then the candidate CDP and LDIP programs. Each line reads \
"code | title | sector | barangays | years".

Pick the one candidate this AIP project most plausibly carries out: same sector, an \
overlapping barangay and overlapping years count most. Return:
- parent_code: that candidate's code, copied exactly from the list; or null if none fits.
- reason: one or two sentences on what the two projects share. Describe the plans and \
projects only, never an office or person at fault.
"""

NO_SUGGESTION = (
    "No CDP or LDIP PPA is linked as this project's parent. No AI suggestion is available."
)

# The model reads barangay names, so its reason names them too, never a PSGC code (J6).
BARANGAY_NAMES = """array(
           SELECT b.name FROM lgus b
           WHERE b.level = 'barangay' AND b.psgc_code = ANY (p.barangays)
           ORDER BY b.psgc_code
       ) AS barangay_names"""

# Confirmed AIP PPAs of confirmed plans (S4-04), and whether a confirmed link already gives
# them a CDP or LDIP parent. A rejected link doesn't count (AC-19).
SELECT_AIP_PPAS = f"""
SELECT p.id, p.code, p.title, p.sector, p.barangays, {BARANGAY_NAMES}, p.year_start,
       p.year_end, p.page_id,
       EXISTS (
           SELECT 1 FROM links l
           JOIN ppas parent ON parent.id = l.parent_ppa_id
           JOIN plans parent_plan ON parent_plan.id = parent.plan_id
           WHERE l.child_ppa_id = p.id AND l.status = 'confirmed'
             AND parent_plan.type IN ('CDP', 'LDIP')
       ) AS has_parent
FROM ppas p JOIN plans pl ON pl.id = p.plan_id
WHERE pl.type = 'AIP' AND pl.status = 'confirmed' AND p.status = 'confirmed'
ORDER BY p.code, p.id
"""

# A candidate without a code can't be named in the answer, so it isn't sent.
SELECT_CANDIDATES = f"""
SELECT p.id, p.code, p.title, p.sector, p.barangays, {BARANGAY_NAMES}, p.year_start,
       p.year_end, p.page_id, false AS has_parent
FROM ppas p JOIN plans pl ON pl.id = p.plan_id
WHERE pl.type IN ('CDP', 'LDIP') AND pl.status = 'confirmed' AND p.status = 'confirmed'
  AND p.code IS NOT NULL
ORDER BY p.code, p.id
"""

UPSERT_LINK = """
INSERT INTO links (child_ppa_id, parent_ppa_id, source, status)
VALUES (%s, %s, 'ai', 'confirmed')
ON CONFLICT (child_ppa_id, parent_ppa_id)
DO UPDATE SET source = EXCLUDED.source, status = EXCLUDED.status
"""

REJECT_LINK = """
UPDATE links SET status = 'rejected' WHERE child_ppa_id = %s AND parent_ppa_id = %s
"""


class OrphanSuggestion(BaseModel):
    """The model's answer for one orphan (S4-12)."""

    parent_code: str | None
    reason: str


@dataclass
class _Ppa:
    id: int
    code: str | None
    title: str | None
    sector: str | None
    barangays: list[str]  # PSGC codes, for grouping
    barangay_names: list[str]  # what the model reads
    year_start: int | None
    year_end: int | None
    page_id: int | None
    has_parent: bool


def _line(p: _Ppa) -> str:
    if p.year_start is None and p.year_end is None:
        years = "not stated"
    elif p.year_start == p.year_end or p.year_end is None:
        years = str(p.year_start)
    else:
        years = f"{p.year_start or 'not stated'}-{p.year_end}"
    fields = [p.code, p.title, p.sector, ", ".join(p.barangay_names) or None, years]
    return " | ".join(f or "not stated" for f in fields)


def _model_input(orphan: _Ppa, candidates: list[_Ppa]) -> str:
    lines = "\n".join(_line(c) for c in candidates)
    return f"AIP project:\n{_line(orphan)}\n\nCandidate parents:\n{lines}\n"


def _orphans_and_candidates(conn: psycopg.Connection) -> tuple[int, list[_Ppa], list[_Ppa]]:
    """(confirmed AIP PPAs checked, the orphans among them, the candidate parents)."""
    with conn.cursor(row_factory=class_row(_Ppa)) as cur:
        aip = cur.execute(SELECT_AIP_PPAS).fetchall()
        candidates = cur.execute(SELECT_CANDIDATES).fetchall()
    return len(aip), [p for p in aip if not p.has_parent], candidates


def model_inputs(conn: psycopg.Connection) -> dict[str, str]:
    """Each coded orphan's model input, by orphan code: what find_orphans sends, so the
    cache loader computes the same keys (S4-15). Empty when there are no candidates."""
    _, orphans, candidates = _orphans_and_candidates(conn)
    if not candidates:
        return {}
    return {o.code: _model_input(o, candidates) for o in orphans if o.code}


def _pages(*ppas: _Ppa) -> list[int]:
    return [p.page_id for p in ppas if p.page_id is not None]


def find_orphans(conn: psycopg.Connection) -> tuple[CheckCount, list[NewFinding]]:
    """One finding per orphan; an AI failure saves it without a suggestion (S4-13)."""
    checked, orphans, candidates = _orphans_and_candidates(conn)
    by_code: dict[str, _Ppa] = {}
    for c in candidates:
        if c.code:
            by_code.setdefault(c.code, c)  # a code sent twice resolves to the first

    found: list[NewFinding] = []
    for o in orphans:
        barangay = min(o.barangays, default=None)
        parent: _Ppa | None = None
        reason = NO_SUGGESTION
        if candidates:
            try:
                answer = llm.call_llm(
                    conn, ORPHAN_PROMPT, _model_input(o, candidates), OrphanSuggestion
                )
            except llm.LLMError:
                answer = None
            # D12: a code the model wasn't sent, or no code at all, is no suggestion.
            if answer and answer.parent_code and answer.reason.strip():
                parent = by_code.get(answer.parent_code.strip())
                if parent:
                    reason = answer.reason.strip()
        if parent:
            found.append(
                NewFinding("orphan", o.id, parent.id, barangay, reason, _pages(o, parent), "ai")
            )
        else:
            found.append(NewFinding("orphan", o.id, None, barangay, reason, _pages(o), "rule"))
    return CheckCount(check="orphan", checked=checked, found=len(found)), found


def apply_review(
    conn: psycopg.Connection,
    check: CheckName,
    ppa_a: int,
    ppa_b: int | None,
    status: FindingStatus | None,
) -> None:
    """The parent link a review of an orphan with a suggested parent sets (S4-10, D4).

    Confirmed upserts links (ppa_a → ppa_b, 'ai', 'confirmed'). Rejected sets that link to
    'rejected' if it exists. Anything else, or any other check, changes nothing. Runs on
    the caller's connection, inside the PATCH's transaction.
    """
    if check != "orphan" or ppa_b is None:
        return
    if status == "confirmed":
        conn.execute(UPSERT_LINK, (ppa_a, ppa_b))
    elif status == "rejected":
        conn.execute(REJECT_LINK, (ppa_a, ppa_b))
