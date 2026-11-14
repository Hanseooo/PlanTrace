"""Stub bodies from seed/fixtures/, served until each endpoint's real query lands (SH-01)."""

from pathlib import Path

from pydantic import TypeAdapter

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "seed" / "fixtures"


def load_fixture[T](name: str, model: type[T]) -> T:
    """Read seed/fixtures/<name> and validate it, so a drifted fixture fails loudly."""
    return TypeAdapter(model).validate_json((FIXTURES_DIR / name).read_bytes())
