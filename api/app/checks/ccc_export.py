"""The CCC matrix as an .xlsx workbook (lane:data, S5-09). Every layout choice lives here
(S5-SH-01); the data comes from findings.ccc_matrix, the query the screen reads too."""

from io import BytesIO

import psycopg
from openpyxl import Workbook

from app.checks.findings import ccc_matrix
from app.models import CccCell, CccPpa

TITLE = "City of Sampaguita CCC matrix. Synthetic demo data."
LEGEND = "* AI suggestion, not yet reviewed"
SYMBOLS = {"Conflict": "C", "Compatible": "Cm", "Complementary": "Cp"}
STATUS_LABELS = {"suggested": "AI suggestion", "confirmed": "Confirmed", "rejected": "Rejected"}
PAIR_HEADERS = ["PPA A", "PPA B", "Verdict", "Status", "Reason", "Pages"]

SELECT_PAGES = """
SELECT pg.id, pl.type, pg.page_no FROM pages pg JOIN plans pl ON pl.id = pg.plan_id
WHERE pg.id = ANY (%s)
"""


def label(ppa: CccPpa) -> str:
    return f"{ppa.plan_type} {ppa.code}: {ppa.title or ''}"


def cell_text(cell: CccCell) -> str | None:
    """C, Cm or Cp; a `*` while it is only an AI suggestion; blank once rejected."""
    if cell.status == "rejected":
        return None
    return SYMBOLS[cell.verdict] + ("*" if cell.status == "suggested" else "")


def pages_text(conn: psycopg.Connection, page_ids: list[int]) -> str:
    rows = {r[0]: f"{r[1]} p. {r[2]}" for r in conn.execute(SELECT_PAGES, (page_ids,))}
    return "; ".join(rows[i] for i in page_ids if i in rows)


def export(conn: psycopg.Connection) -> bytes:
    matrix = ccc_matrix(conn)
    ppas = {p.id: p for p in matrix.ppas}
    # A finding whose PPA was since unconfirmed has no row or column; it is left out.
    cells = [c for c in matrix.cells if c.ppa_a in ppas and c.ppa_b in ppas]

    book = Workbook()
    grid = book.active
    assert grid
    grid.title = "CCC matrix"
    grid.append([TITLE])
    grid.append([None, *(label(p) for p in matrix.ppas)])
    texts = {(c.ppa_a, c.ppa_b): cell_text(c) for c in cells}
    texts |= {(b, a): t for (a, b), t in texts.items()}
    for row in matrix.ppas:
        grid.append([label(row), *(texts.get((row.id, col.id)) for col in matrix.ppas)])
    grid.append([])
    grid.append([LEGEND])

    pairs = book.create_sheet("Pairs")
    pairs.append(PAIR_HEADERS)
    for c in cells:
        pairs.append(
            [
                label(ppas[c.ppa_a]),
                label(ppas[c.ppa_b]),
                c.verdict,
                STATUS_LABELS[c.status],
                c.reason,
                pages_text(conn, c.page_ids),
            ]
        )

    out = BytesIO()
    book.save(out)
    return out.getvalue()
