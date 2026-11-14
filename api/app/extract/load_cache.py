"""Load the committed LCCAP extraction response into `ai_cache` (S2-19).

Usage:
  uv run python -m app.extract.load_cache [DATABASE_URL]
  uv run python -m app.extract.load_cache --capture [DATABASE_URL]

The key is computed here, with llm.py's `cache_key` and the extraction prompt (SH-02), from
seed/pdfs/lccap.pdf's page text and the seeded barangays. A prompt change therefore never
leaves a stale key: rerun this. Seed first, so the barangays match what the upload sends.

`--capture` is the human-only step: it asks the real providers (GEMINI_API_KEY or
OPENROUTER_API_KEY must be set), primes the cache, and rewrites seed/ai_cache/lccap.json.
"""

import sys
from pathlib import Path

import psycopg

from app import llm
from app.db import connect
from app.db.seed import SEED_DIR
from app.extract.extraction import EXTRACTION_PROMPT, RawExtraction, model_input, read_pages
from app.extract.routes import barangays

LCCAP_PDF = SEED_DIR / "pdfs" / "lccap.pdf"
LCCAP_RESPONSE = SEED_DIR / "ai_cache" / "lccap.json"


def lccap_key(conn: psycopg.Connection, pdf: Path = LCCAP_PDF) -> tuple[str, str]:
    """(cache key, model input) of an LCCAP upload into this database."""
    input = model_input(read_pages(pdf.read_bytes()), barangays(conn))
    return llm.cache_key(EXTRACTION_PROMPT, input, RawExtraction), input


def load(conn: psycopg.Connection, response: Path = LCCAP_RESPONSE) -> str:
    """Upsert the committed response under the LCCAP's key. Returns the key."""
    answer = RawExtraction.model_validate_json(response.read_text(encoding="utf-8"))
    key, _ = lccap_key(conn)
    conn.execute(llm.UPSERT_CACHE, (key, answer.model_dump_json()))
    conn.commit()
    return key


def capture(conn: psycopg.Connection, response: Path = LCCAP_RESPONSE) -> RawExtraction:
    """Ask the real providers for the LCCAP's PPAs and commit the answer to `response`."""
    key, input = lccap_key(conn)
    conn.execute("DELETE FROM ai_cache WHERE key = %s", (key,))
    answer = llm.call_llm(conn, EXTRACTION_PROMPT, input, RawExtraction)
    conn.commit()
    response.parent.mkdir(parents=True, exist_ok=True)
    response.write_text(answer.model_dump_json(indent=2) + "\n", encoding="utf-8")
    return answer


def main() -> None:
    args = sys.argv[1:]
    capturing = "--capture" in args
    urls = [a for a in args if a != "--capture"]
    with connect(urls[0] if urls else None) as conn:
        # Host and database name only: never the password (S1-05).
        print(f"Cache for {conn.info.host} / {conn.info.dbname}", flush=True)
        if capturing:
            answer = capture(conn)
            print(f"Captured {len(answer.ppas)} PPAs into {LCCAP_RESPONSE}")
        else:
            print(f"Loaded {LCCAP_RESPONSE.name} as key {load(conn)[:12]}…")


if __name__ == "__main__":
    main()
