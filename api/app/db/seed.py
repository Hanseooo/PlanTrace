"""Seed the fictional City of Sampaguita from seed/city.json (S1, SH-01).

Usage: uv run python -m app.db.seed [DATABASE_URL]
Renders one PDF per plan into seed/pdfs/, then, in one transaction, empties every
table except ai_cache and schema_migrations (restarting identities) and loads the
city. pages.text is the text extracted back from the PDFs, so the source panel shows
what the PDF shows. The LCCAP is rendered for the J2 upload but never loaded.
Change the city only in city.json, then rerun this. Never edit a PDF by hand.
"""

import html
import io
import json
import sys
from pathlib import Path
from typing import Any

import psycopg
import pymupdf
from psycopg import sql

from app.db import connect

SEED_DIR = Path(__file__).resolve().parents[3] / "seed"
CITY_JSON = SEED_DIR / "city.json"
PDF_DIR = SEED_DIR / "pdfs"

# Plans load in this order so their ids are 1 to 4, as in the fixtures and the smoke.
LOAD_ORDER = ("CLUP", "CDP", "LDRRMP", "AIP")

# The renderer sets "fi" and "fl" as ligatures; extract them as plain letters so
# full-text search and title similarity see "office", not a ligature glyph.
TEXT_FLAGS = pymupdf.TEXTFLAGS_TEXT & ~pymupdf.TEXT_PRESERVE_LIGATURES
PAGE_RECT = pymupdf.paper_rect("a4")
MARGIN = 54
BODY_RECT = PAGE_RECT + (MARGIN, MARGIN, -MARGIN, -MARGIN)
# Fixed metadata keeps the committed PDFs byte-identical across seed runs.
METADATA = {
    "title": "",
    "author": "City of Sampaguita (synthetic)",
    "subject": "Synthetic demo data",
    "creator": "PlanTrace seed",
    "producer": "PyMuPDF",
    "creationDate": "D:20261115000000Z",
    "modDate": "D:20261115000000Z",
}

CSS = """
* { font-family: sans-serif; font-size: 9pt; }
h1 { font-size: 15pt; margin: 0 0 2pt 0; }
h2 { font-size: 11pt; margin: 10pt 0 4pt 0; }
p { margin: 0 0 6pt 0; }
.sub { font-size: 9pt; margin: 0 0 8pt 0; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid black; padding: 3pt; font-size: 8pt; vertical-align: top;
         text-align: left; }
td b { font-size: 8pt; }
th { background-color: #dddddd; }
"""

TRUNCATE_TARGETS = """
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND tablename NOT IN ('ai_cache', 'schema_migrations')
ORDER BY tablename
"""

INSERT_LGU = """
INSERT INTO lgus (psgc_code, name, level) VALUES (%s, %s, %s)
"""

INSERT_PLAN = """
INSERT INTO plans (lgu_psgc, type, title, period_start, period_end, status)
VALUES (%s, %s, %s, %s, %s, 'confirmed') RETURNING id
"""

INSERT_PAGE = """
INSERT INTO pages (plan_id, page_no, text) VALUES (%s, %s, %s) RETURNING id
"""

INSERT_PPA = """
INSERT INTO ppas (plan_id, code, title, description, office, sector, barangays, cost,
                  year_start, year_end, page_id, status)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'confirmed') RETURNING id
"""

INSERT_ZONE = """
INSERT INTO zones (plan_id, barangay, zone_type, hazard, forbidden_sectors, page_id)
VALUES (%s, %s, %s, %s, %s, %s)
"""

INSERT_LINK = """
INSERT INTO links (child_ppa_id, parent_ppa_id, source, status)
VALUES (%s, %s, 'manual', 'confirmed')
"""

Json = dict[str, Any]


def load_city() -> Json:
    return json.loads(CITY_JSON.read_text(encoding="utf-8"))


def _years(start: int, end: int) -> str:
    return str(start) if start == end else f"{start}-{end}"


def _sector_label(sector: str) -> str:
    return sector.replace("_", " ").capitalize()


def _page_html(city: Json, plan: Json, page_index: int) -> str:
    e = html.escape
    names = {b["psgc_code"]: b["name"] for b in city["barangays"]}
    page = plan["pages"][page_index]
    parts: list[str] = []
    if page_index == 0:
        parts.append(f"<h1>{e(city['city']['name'])}</h1>")
        parts.append(f"<p class='sub'>{e(plan['title'])}</p>")
    parts.append(f"<h2>{e(page['heading'])}</h2>")
    parts += [f"<p>{e(text)}</p>" for text in page["paragraphs"]]
    if "zones" in page:
        rows = "".join(
            f"<tr><td>{e(names[z['barangay']])}</td><td>{e(z['zone_type'].capitalize())}</td>"
            f"<td>{e(z['hazard'].capitalize())}</td><td>{e(z['allowed_uses'])}</td>"
            f"<td>{e(', '.join(map(_sector_label, z['forbidden_sectors'])) or 'None')}</td></tr>"
            for z in page["zones"]
        )
        parts.append(
            "<table><tr><th>Barangay</th><th>Zone</th><th>Flood susceptibility</th>"
            f"<th>Allowed uses</th><th>Not allowed</th></tr>{rows}</table>"
        )
    if "ppas" in page:
        rows = "".join(
            f"<tr><td>{e(p['code'])}</td><td><b>{e(p['title'])}</b><br/>{e(p['description'])}</td>"
            f"<td>{e(p['office'])}</td><td>{e(_sector_label(p['sector']))}</td>"
            f"<td>{e(', '.join(names[b] for b in p['barangays']))}</td>"
            f"<td>{p['cost']:,}</td><td>{_years(p['year_start'], p['year_end'])}</td></tr>"
            for p in page["ppas"]
        )
        parts.append(
            "<table><tr><th>Code</th><th>Program, project or activity</th>"
            "<th>Implementing office</th><th>Sector</th><th>Location</th>"
            f"<th>Cost (PHP)</th><th>Schedule</th></tr>{rows}</table>"
        )
    return "".join(parts)


def render_pdf(city: Json, plan: Json) -> bytes:
    """One PDF page per page in city.json: title header, bordered table, footer."""
    buffer = io.BytesIO()
    writer = pymupdf.DocumentWriter(buffer)
    for i in range(len(plan["pages"])):
        story = pymupdf.Story(_page_html(city, plan, i), user_css=CSS)
        device = writer.begin_page(PAGE_RECT)
        more, _ = story.place(BODY_RECT)
        if more:
            raise ValueError(f"{plan['file']} page {i + 1} overflows; split it in city.json")
        story.draw(device)
        writer.end_page()
    writer.close()

    doc = pymupdf.open("pdf", buffer.getvalue())
    for page_no in range(1, doc.page_count + 1):
        page = doc[page_no - 1]
        footer = (
            f"{city['city']['name']} | {plan['title']} | Synthetic data for demonstration"
            f" | Page {page_no} of {doc.page_count}"
        )
        page.insert_text((MARGIN, PAGE_RECT.height - 30), footer, fontsize=7)
    doc.set_metadata({**METADATA, "title": plan["title"]})
    return doc.tobytes(garbage=4, deflate=True, no_new_id=True)


def page_texts(pdf: bytes) -> list[str]:
    with pymupdf.open("pdf", pdf) as doc:
        return [str(page.get_text(flags=TEXT_FLAGS)) for page in doc]


def render_pdfs(city: Json, pdf_dir: Path = PDF_DIR) -> dict[str, list[str]]:
    """Write every plan's PDF into `pdf_dir`. Returns each plan's page texts by type."""
    pdf_dir.mkdir(parents=True, exist_ok=True)
    texts: dict[str, list[str]] = {}
    for plan in city["plans"]:
        pdf = render_pdf(city, plan)
        (pdf_dir / plan["file"]).write_bytes(pdf)
        texts[plan["type"]] = page_texts(pdf)
    return texts


def seed(conn: psycopg.Connection, pdf_dir: Path = PDF_DIR) -> None:
    """Render the PDFs into `pdf_dir`, then reset the database to the seeded city."""
    city = load_city()
    plans = {plan["type"]: plan for plan in city["plans"]}
    texts = render_pdfs(city, pdf_dir)

    with conn.transaction():
        tables = [row[0] for row in conn.execute(TRUNCATE_TARGETS)]
        if not tables:
            raise RuntimeError("The database has no tables: run app.db.migrate first")
        conn.execute(
            sql.SQL("TRUNCATE {} RESTART IDENTITY CASCADE").format(
                sql.SQL(", ").join(map(sql.Identifier, tables))
            )
        )

        city_psgc = city["city"]["psgc_code"]
        conn.execute(INSERT_LGU, (city_psgc, city["city"]["name"], "city"))
        for barangay in city["barangays"]:
            conn.execute(INSERT_LGU, (barangay["psgc_code"], barangay["name"], "barangay"))

        plan_ids: dict[str, int] = {}
        for plan_type in LOAD_ORDER:
            plan = plans[plan_type]
            row = conn.execute(
                INSERT_PLAN,
                (city_psgc, plan_type, plan["title"], plan["period_start"], plan["period_end"]),
            ).fetchone()
            assert row
            plan_ids[plan_type] = row[0]

        page_ids: dict[tuple[str, int], int] = {}
        for plan_type in LOAD_ORDER:
            for page_no, text in enumerate(texts[plan_type], start=1):
                row = conn.execute(INSERT_PAGE, (plan_ids[plan_type], page_no, text)).fetchone()
                assert row
                page_ids[(plan_type, page_no)] = row[0]

        ppa_ids: dict[str, int] = {}
        parents: list[tuple[str, str]] = []
        for plan_type in LOAD_ORDER:
            for page_no, page in enumerate(plans[plan_type]["pages"], start=1):
                for p in page.get("ppas", []):
                    row = conn.execute(
                        INSERT_PPA,
                        (
                            plan_ids[plan_type],
                            p["code"],
                            p["title"],
                            p["description"],
                            p["office"],
                            p["sector"],
                            p["barangays"],
                            p["cost"],
                            p["year_start"],
                            p["year_end"],
                            page_ids[(plan_type, page_no)],
                        ),
                    ).fetchone()
                    assert row
                    ppa_ids[p["code"]] = row[0]
                    if p.get("parent"):
                        parents.append((p["code"], p["parent"]))

        for plan_type in LOAD_ORDER:
            for page_no, page in enumerate(plans[plan_type]["pages"], start=1):
                for z in page.get("zones", []):
                    conn.execute(
                        INSERT_ZONE,
                        (
                            plan_ids[plan_type],
                            z["barangay"],
                            z["zone_type"],
                            z["hazard"],
                            z["forbidden_sectors"],
                            page_ids[(plan_type, page_no)],
                        ),
                    )

        for child, parent in parents:
            conn.execute(INSERT_LINK, (ppa_ids[child], ppa_ids[parent]))


def main() -> None:
    url = sys.argv[1] if len(sys.argv) > 1 else None
    with connect(url) as conn:
        # Host and database name only: never the password (S1-05).
        print(f"Seeding {conn.info.host} / {conn.info.dbname}", flush=True)
        seed(conn)
    print(f"Seeded the City of Sampaguita: {', '.join(LOAD_ORDER)}; PDFs in {PDF_DIR}")


if __name__ == "__main__":
    main()
