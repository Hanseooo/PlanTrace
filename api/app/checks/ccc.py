"""CCC check: classify every cross-plan candidate pair as Conflict, Compatible or
Complementary through llm.py (lane:ai, S5-01 to S5-04).

The model reads PPAs by plan type, code, title, description, sector, barangay name and
years, never by database id, office or cost, so the cache key survives a reseed and J3's
office edit. `app.extract.load_cache` primes it from seed/ai_cache/ccc.json (S5-05).
"""

from dataclasses import dataclass

import psycopg
from psycopg.rows import class_row
from pydantic import BaseModel

from app import llm
from app.checks.findings import NewFinding
from app.checks.orphan import BARANGAY_NAMES
from app.models import CccVerdict, CheckCount

CCC_PROMPT = """\
You help a Philippine city planner compare projects (PPAs) from two different local plans. \
The input gives PPA A and PPA B. Each reads "plan | code | title | description | sector | \
barangays | years".

Classify how the two projects relate:
- Conflict: one project hinders or undermines the other, for example both claim the same \
site or the same barangay's land for incompatible uses.
- Compatible: both can go ahead without affecting each other.
- Complementary: one supports or strengthens the other.

Return:
- verdict: Conflict, Compatible or Complementary.
- reason: one or two sentences on why. Describe the plans and projects only, never an \
office or person at fault.
"""

# S5-01: confirmed PPAs of confirmed plans (AC-15), from different plans, sharing a barangay
# or a non-null sector, with overlapping years. A missing year_end counts as year_start; a
# PPA with no year_start is never a candidate. Each pair once (a.id < b.id); the order of
# the pair is set in Python, so it doesn't depend on ids or on database collation.
SELECT_PPAS = f"""
SELECT p.id, pl.type AS plan_type, p.code, p.title, p.description, p.sector, p.barangays,
       {BARANGAY_NAMES}, p.year_start, p.year_end, p.page_id
FROM ppas p JOIN plans pl ON pl.id = p.plan_id
WHERE p.status = 'confirmed' AND pl.status = 'confirmed' AND p.year_start IS NOT NULL
"""
SELECT_PAIRS = """
SELECT a.id AS a, b.id AS b
FROM ppas a
JOIN plans pa ON pa.id = a.plan_id
JOIN ppas b ON b.id > a.id
JOIN plans pb ON pb.id = b.plan_id
WHERE a.status = 'confirmed' AND pa.status = 'confirmed' AND a.year_start IS NOT NULL
  AND b.status = 'confirmed' AND pb.status = 'confirmed' AND b.year_start IS NOT NULL
  AND a.plan_id <> b.plan_id
  AND (a.barangays && b.barangays OR a.sector = b.sector)
  AND a.year_start <= coalesce(b.year_end, b.year_start)
  AND b.year_start <= coalesce(a.year_end, a.year_start)
"""


class CccAnswer(BaseModel):
    """The model's answer for one pair (S5-02)."""

    verdict: CccVerdict
    reason: str


@dataclass
class _Ppa:
    id: int
    plan_type: str
    code: str | None
    title: str | None
    description: str | None
    sector: str | None
    barangays: list[str]  # PSGC codes, for grouping
    barangay_names: list[str]  # what the model reads
    year_start: int | None
    year_end: int | None
    page_id: int | None


def _sort_key(p: _Ppa) -> tuple[str, str, int]:
    return p.plan_type, p.code or "", p.id


def _line(p: _Ppa) -> str:
    if p.year_end is None or p.year_start == p.year_end:
        years = str(p.year_start)
    else:
        years = f"{p.year_start}-{p.year_end}"
    fields = [
        p.plan_type,
        p.code,
        p.title,
        p.description,
        p.sector,
        ", ".join(p.barangay_names) or None,
        years,
    ]
    return " | ".join(f or "not stated" for f in fields)


def _model_input(a: _Ppa, b: _Ppa) -> str:
    return f"PPA A:\n{_line(a)}\n\nPPA B:\n{_line(b)}\n"


def candidate_pairs(conn: psycopg.Connection) -> list[tuple[_Ppa, _Ppa]]:
    """Every candidate pair, `ppa_a` first by plan type, then code, then id (S5-01)."""
    with conn.cursor(row_factory=class_row(_Ppa)) as cur:
        ppas = {p.id: p for p in cur.execute(SELECT_PPAS).fetchall()}
    pairs: list[tuple[_Ppa, _Ppa]] = []
    for a_id, b_id in conn.execute(SELECT_PAIRS).fetchall():
        a, b = sorted((ppas[a_id], ppas[b_id]), key=_sort_key)
        pairs.append((a, b))
    return sorted(pairs, key=lambda pair: (_sort_key(pair[0]), _sort_key(pair[1])))


def model_inputs(conn: psycopg.Connection) -> list[str]:
    """Each candidate pair's model input, in pair order: what find_ccc sends, so the cache
    loader computes the same keys (S5-05)."""
    return [_model_input(a, b) for a, b in candidate_pairs(conn)]


def find_ccc(conn: psycopg.Connection) -> tuple[CheckCount, list[NewFinding]]:
    """One finding per classified pair, every verdict kept (S5-03). A pair whose call
    fails, or whose reason is empty, is skipped."""
    pairs = candidate_pairs(conn)
    found: list[NewFinding] = []
    for a, b in pairs:
        try:
            answer = llm.call_llm(conn, CCC_PROMPT, _model_input(a, b), CccAnswer)
        except llm.LLMError:
            continue
        reason = answer.reason.strip()
        if not reason:
            continue
        shared = set(a.barangays) & set(b.barangays)
        found.append(
            NewFinding(
                check="ccc",
                ppa_a=a.id,
                ppa_b=b.id,
                # The lowest shared barangay, else ppa_a's lowest, else none (S4-05).
                barangay=min(shared or a.barangays, default=None),
                reason=reason,
                page_ids=[p.page_id for p in (a, b) if p.page_id is not None],
                created_by="ai",
                verdict=answer.verdict,
            )
        )
    conflicts = sum(f.verdict == "Conflict" for f in found)
    return CheckCount(check="ccc", checked=len(pairs), found=conflicts), found
