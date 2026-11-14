"""API contract. Every request and response shape lives here.

A change here is a contract change: tell the team, regenerate web/src/lib/api-types.ts,
and update seed/fixtures/ in the same PR (ARCHITECTURE.md "Contract").
"""

from datetime import datetime
from typing import Literal

from fastapi import UploadFile
from pydantic import BaseModel

# Exact domain strings (CODING_STANDARDS.md section 5, D3 sector list on issue #1).
PlanType = Literal["CLUP", "CDP", "LDIP", "AIP", "LDRRMP", "LCCAP", "Other"]
# "uploading" is web-only (AC-03); the API never returns it.
PlanStatus = Literal["extracting", "ready", "confirmed", "failed"]
PpaStatus = Literal["draft", "confirmed"]
Sector = Literal[
    "housing",
    "drainage",
    "flood_control",
    "roads",
    "evacuation",
    "agriculture",
    "water_supply",
    "health",
    "education",
    "livelihood",
    "commercial",
    "industrial",
]
CheckName = Literal["duplicate", "orphan", "ccc", "zone"]
FindingStatus = Literal["suggested", "confirmed", "rejected"]
CccVerdict = Literal["Conflict", "Compatible", "Complementary"]
FindingCreatedBy = Literal["ai", "rule"]


class Plan(BaseModel):
    id: int
    lgu_psgc: str
    type: PlanType
    title: str
    period_start: int
    period_end: int
    status: PlanStatus
    error: str | None


class PlanUpload(BaseModel):
    """Multipart body of POST /plans."""

    file: UploadFile
    type: PlanType
    period_start: int
    period_end: int


class PlanRetry(BaseModel):
    """Multipart body of POST /plans/{id}/retry: the same file again (S2-14, D2)."""

    file: UploadFile


class Barangay(BaseModel):
    """One of the city's barangays, for the barangay picker and names in cells (S3-01)."""

    psgc_code: str
    name: str


class Page(BaseModel):
    """One page of an uploaded plan, for the source panel (S3-02)."""

    id: int
    plan_id: int
    page_no: int
    text: str


class Ppa(BaseModel):
    """One PPA row. Missing values are null, never invented (AC-05)."""

    id: int
    plan_id: int
    code: str | None
    title: str | None
    description: str | None
    office: str | None
    sector: Sector | None
    barangays: list[str]  # PSGC codes
    cost: float | None  # pesos
    year_start: int | None
    year_end: int | None
    page_id: int | None
    status: PpaStatus


class PpaInput(BaseModel):
    """Body of POST /plans/{id}/ppas (an empty body adds a blank row) and
    PATCH /ppas/{id} (only the fields sent change)."""

    code: str | None = None
    title: str | None = None
    description: str | None = None
    office: str | None = None
    sector: Sector | None = None
    barangays: list[str] | None = None
    cost: float | None = None
    year_start: int | None = None
    year_end: int | None = None
    page_id: int | None = None


class FindingPpa(Ppa):
    """A PPA as shown in a finding's side-by-side view (AC-27)."""

    plan_type: PlanType


class Finding(BaseModel):
    id: int
    check: CheckName
    ppa_a: FindingPpa
    # The other PPA: the duplicate, the suggested parent (orphan) or the CCC pair.
    # Null for a zone finding.
    ppa_b: FindingPpa | None
    verdict: CccVerdict | None  # set only for check "ccc"
    reason: str
    page_ids: list[int]
    status: FindingStatus
    note: str | None
    created_by: FindingCreatedBy
    barangay: str | None  # PSGC code the finding is grouped under (AC-26)


class FindingUpdate(BaseModel):
    """Body of PATCH /findings/{id}: confirm, reject, or set a note."""

    status: FindingStatus | None = None
    note: str | None = None


class CheckCount(BaseModel):
    check: CheckName
    checked: int  # pairs or PPAs checked (AC-23)
    found: int  # findings raised


class CheckRunResult(BaseModel):
    ran_at: datetime
    counts: list[CheckCount]


class CccPpa(BaseModel):
    """A row and column header of the CCC matrix (AC-32)."""

    id: int
    plan_type: PlanType
    code: str  # empty when the PPA has none
    title: str | None


class CccCell(BaseModel):
    """One candidate pair. Pairs not listed were not candidates and show blank."""

    ppa_a: int
    ppa_b: int
    verdict: CccVerdict
    status: FindingStatus
    reason: str
    page_ids: list[int]


class CccMatrix(BaseModel):
    ppas: list[CccPpa]
    cells: list[CccCell]
