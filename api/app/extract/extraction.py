"""What the model reads and returns for one plan, and the cleanup of its answer (S2-12, S2-13).

The prompt and `RawExtraction` live only here: the S2-19 cache loader and the tests import
them, so the cache key never drifts from what the upload sends (SH-02).
"""

import math
from typing import cast, get_args

import pymupdf
from pydantic import BaseModel

from app.db.seed import page_texts
from app.models import PpaInput, Sector

SECTORS: frozenset[str] = frozenset(get_args(Sector))

EXTRACTION_PROMPT = f"""\
You read a Philippine local government plan and list every program, project or activity \
(PPA) it contains.

The plan's text follows, page by page. Each page starts with a line "=== page N ===".
After the pages comes the city's barangay list, one "code: name" pair per line.

For each PPA return:
- code: the plan's own code for it, as printed (for example "CDP-01"), or null.
- title, description, office (the implementing office): as printed, or null.
- sector: one of {", ".join(sorted(SECTORS))}; or null if none fits.
- barangays: the codes from the barangay list of every barangay the PPA names. \
Use only codes from the list. Empty if it names none.
- cost: the total cost in pesos, digits only (for example "3000000"), or null.
- year_start, year_end: four-digit years, or null. A single year is both start and end.
- page: the N of the "=== page N ===" marker the PPA appears under.

Copy values from the text. Never guess: leave a value null when the text doesn't give it.
Return {{"ppas": []}} if the plan lists no PPAs.
"""


class RawPpa(BaseModel):
    """One PPA as the model returns it. Sector, barangays, cost and years are plain strings
    so the provider's constrained decoding never rejects the whole answer (S2-13)."""

    code: str | None = None
    title: str | None = None
    description: str | None = None
    office: str | None = None
    sector: str | None = None
    barangays: list[str] = []
    cost: str | None = None
    year_start: str | None = None
    year_end: str | None = None
    page: int | None = None


class RawExtraction(BaseModel):
    """The model's answer: a list of PPAs. Any other shape is invalid output (S2-13)."""

    ppas: list[RawPpa]


class ExtractionError(Exception):
    """The plan can't be extracted. The message is shown to the planner as the plan's error."""


def read_pages(pdf: bytes) -> list[str]:
    """Each page's text, page 1 first, with the seed's flags so the text hashes the same."""
    try:
        with pymupdf.open("pdf", pdf) as doc:
            if doc.needs_pass:
                raise ExtractionError("Not a readable PDF")
        return page_texts(pdf)
    except ExtractionError:
        raise
    except Exception as e:  # PyMuPDF raises several types for a corrupt file
        raise ExtractionError("Not a readable PDF") from e


def model_input(texts: list[str], barangays: list[tuple[str, str]]) -> str:
    """The pages under `=== page N ===` markers, then the barangays as `code: name` (S2-12).

    Raises `ExtractionError` when every page is empty (a scanned PDF).
    """
    if not any(text.strip() for text in texts):
        raise ExtractionError("No text found. Scanned PDFs aren't supported.")
    pages = [f"=== page {n} ===\n{text.strip()}" for n, text in enumerate(texts, start=1)]
    city = "\n".join(f"{code}: {name}" for code, name in barangays)
    return "\n\n".join(pages) + f"\n\n=== barangays ===\n{city}\n"


def _text(value: str | None) -> str | None:
    value = (value or "").strip()
    return value or None


def _number(value: str | None) -> float | None:
    try:
        number = float((value or "").replace(",", "").strip())
    except ValueError:
        return None
    return number if math.isfinite(number) else None  # "nan" and "inf" parse as floats


def _year(value: str | None) -> int | None:
    number = _number(value)
    return int(number) if number is not None and number.is_integer() else None


def _sector(value: str | None) -> Sector | None:
    sector = (value or "").strip().lower().replace(" ", "_")
    return cast(Sector, sector) if sector in SECTORS else None


def clean_ppas(
    raw: list[RawPpa], barangay_codes: set[str], page_ids: dict[int, int]
) -> list[PpaInput]:
    """Blank or drop each field that doesn't fit; never invent one (S2-13).

    `page_ids` maps each page number of the PDF to its `pages.id`.
    """
    return [
        PpaInput(
            code=_text(p.code),
            title=_text(p.title),
            description=_text(p.description),
            office=_text(p.office),
            sector=_sector(p.sector),
            barangays=[
                b for b in dict.fromkeys(b.strip() for b in p.barangays) if b in barangay_codes
            ],
            cost=_number(p.cost),
            year_start=_year(p.year_start),
            year_end=_year(p.year_end),
            page_id=page_ids.get(p.page) if p.page is not None else None,
        )
        for p in raw
    ]
