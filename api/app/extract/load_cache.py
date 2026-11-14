"""Load the committed AI answers into `ai_cache`: the LCCAP extraction (S2-19) and the
orphans' suggested parents (S4-15) and the CCC verdicts (S5-05).

Usage:
  uv run python -m app.extract.load_cache [DATABASE_URL]
  uv run python -m app.extract.load_cache --capture [DATABASE_URL]
  uv run python -m app.extract.load_cache --capture-orphans [DATABASE_URL]
  uv run python -m app.extract.load_cache --capture-ccc [DATABASE_URL]

The keys are computed here, with llm.py's `cache_key` and each caller's prompt (SH-02):
the LCCAP's from seed/pdfs/lccap.pdf's page text and the seeded barangays, each orphan's
from the input `checks/orphan.py` sends on this database. A prompt change therefore never
leaves a stale key: rerun this. Seed first, so the keys match what the app sends.

seed/ai_cache/orphans.json maps an orphan's code to its answer. Until it is captured, the
orphans run live, or without a suggestion when no provider answers (S4-13).

`--capture` is the human-only step: it asks the real providers (GEMINI_API_KEY or
OPENROUTER_API_KEY must be set), primes the cache, and rewrites seed/ai_cache/lccap.json
and orphans.json. `--capture-orphans` rewrites only orphans.json.

seed/ai_cache/ccc.json lists `{input, answer}` for each CCC candidate pair: the exact model
input, because the LCCAP's PPAs don't exist until J2 (S5-05). `--capture-ccc` asks the real
providers about every current candidate pair and rewrites it: run it after J2 and J3, on a
database that was seeded and had this loader run. A missing file primes nothing.
"""

import json
import sys
from pathlib import Path

import psycopg

from app import llm
from app.checks import ccc
from app.checks.orphan import ORPHAN_PROMPT, OrphanSuggestion, model_inputs
from app.db import connect
from app.db.seed import SEED_DIR
from app.extract.extraction import EXTRACTION_PROMPT, RawExtraction, model_input, read_pages
from app.extract.routes import barangays

LCCAP_PDF = SEED_DIR / "pdfs" / "lccap.pdf"
LCCAP_RESPONSE = SEED_DIR / "ai_cache" / "lccap.json"
ORPHANS_RESPONSE = SEED_DIR / "ai_cache" / "orphans.json"
CCC_RESPONSE = SEED_DIR / "ai_cache" / "ccc.json"


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


def load_orphans(conn: psycopg.Connection, response: Path = ORPHANS_RESPONSE) -> int:
    """Upsert each committed answer under the key of the orphan with that code on this
    database. A missing file, or a code that isn't an orphan here, primes nothing.
    Returns how many answers were primed."""
    if not response.exists():
        return 0
    answers = json.loads(response.read_text(encoding="utf-8"))
    primed = 0
    for code, input in model_inputs(conn).items():
        if code in answers:
            answer = OrphanSuggestion.model_validate(answers[code])
            key = llm.cache_key(ORPHAN_PROMPT, input, OrphanSuggestion)
            conn.execute(llm.UPSERT_CACHE, (key, answer.model_dump_json()))
            primed += 1
    conn.commit()
    return primed


def capture_orphans(
    conn: psycopg.Connection, response: Path = ORPHANS_RESPONSE
) -> dict[str, OrphanSuggestion]:
    """Ask the real providers for each orphan's parent and commit the answers to `response`."""
    answers: dict[str, OrphanSuggestion] = {}
    for code, input in model_inputs(conn).items():
        key = llm.cache_key(ORPHAN_PROMPT, input, OrphanSuggestion)
        conn.execute("DELETE FROM ai_cache WHERE key = %s", (key,))
        answers[code] = llm.call_llm(conn, ORPHAN_PROMPT, input, OrphanSuggestion)
    conn.commit()
    response.parent.mkdir(parents=True, exist_ok=True)
    dumped = {code: a.model_dump() for code, a in answers.items()}
    response.write_text(json.dumps(dumped, indent=2) + "\n", encoding="utf-8")
    return answers


def load_ccc(conn: psycopg.Connection, response: Path = CCC_RESPONSE) -> int:
    """Upsert each committed `{input, answer}` under the key of that input. A missing file
    primes nothing. Returns how many answers were primed."""
    if not response.exists():
        return 0
    entries = json.loads(response.read_text(encoding="utf-8"))
    for entry in entries:
        answer = ccc.CccAnswer.model_validate(entry["answer"])
        key = llm.cache_key(ccc.CCC_PROMPT, entry["input"], ccc.CccAnswer)
        conn.execute(llm.UPSERT_CACHE, (key, answer.model_dump_json()))
    conn.commit()
    return len(entries)


def capture_ccc(conn: psycopg.Connection, response: Path = CCC_RESPONSE) -> list[dict[str, object]]:
    """Ask the real providers about every current candidate pair and commit the answers to
    `response`, input first. An unanswered pair raises `LLMError`: nothing is written."""
    entries: list[dict[str, object]] = []
    for input in ccc.model_inputs(conn):
        key = llm.cache_key(ccc.CCC_PROMPT, input, ccc.CccAnswer)
        conn.execute("DELETE FROM ai_cache WHERE key = %s", (key,))
        answer = llm.call_llm(conn, ccc.CCC_PROMPT, input, ccc.CccAnswer)
        entries.append({"input": input, "answer": answer.model_dump()})
    conn.commit()
    response.parent.mkdir(parents=True, exist_ok=True)
    response.write_text(json.dumps(entries, indent=2) + "\n", encoding="utf-8")
    return entries


def main() -> None:
    args = sys.argv[1:]
    flags = {"--capture", "--capture-orphans", "--capture-ccc"}
    urls = [a for a in args if a not in flags]
    with connect(urls[0] if urls else None) as conn:
        # Host and database name only: never the password (S1-05).
        print(f"Cache for {conn.info.host} / {conn.info.dbname}", flush=True)
        if "--capture" in args:
            answer = capture(conn)
            print(f"Captured {len(answer.ppas)} PPAs into {LCCAP_RESPONSE}")
        if "--capture" in args or "--capture-orphans" in args:
            print(f"Captured {len(capture_orphans(conn))} orphans into {ORPHANS_RESPONSE}")
        if "--capture-ccc" in args:
            print(f"Captured {len(capture_ccc(conn))} CCC pairs into {CCC_RESPONSE}")
        if any(f in args for f in flags):
            return
        print(f"Loaded {LCCAP_RESPONSE.name} as key {load(conn)[:12]}…")
        if ORPHANS_RESPONSE.exists():
            print(f"Loaded {load_orphans(conn)} orphan answers from {ORPHANS_RESPONSE.name}")
        else:
            print(f"No {ORPHANS_RESPONSE.name} yet: orphans run live or without a suggestion")
        if CCC_RESPONSE.exists():
            print(f"Loaded {load_ccc(conn)} CCC answers from {CCC_RESPONSE.name}")
        else:
            print(f"No {CCC_RESPONSE.name} yet: CCC pairs run live or are skipped")


if __name__ == "__main__":
    main()
