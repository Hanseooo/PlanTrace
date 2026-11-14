"""S2-17, S2-18: llm.py with fake providers at the provider boundary (`llm.PROVIDERS`).

The cache tests run against TEST_DATABASE_URL (D7) through the `empty_db` fixture.
"""

import time
from collections.abc import Callable

import psycopg
import pytest
from pydantic import BaseModel

from app import llm
from app.db.migrate import migrate
from tests.db import needs_db

PROMPT = "List the PPAs."
INPUT = "=== page 1 ===\nDrainage upgrade, Barangay 12"


class Answer(BaseModel):
    titles: list[str]


GOOD = '{"titles": ["Drainage upgrade"]}'


class FakeProvider:
    """Returns `reply` (or raises it) and counts its calls."""

    def __init__(self, reply: str | BaseException | Callable[[], str]) -> None:
        self.reply = reply
        self.calls = 0

    def __call__(self, prompt: str, input: str, output_model: type[BaseModel]) -> str:
        self.calls += 1
        if isinstance(self.reply, BaseException):
            raise self.reply
        return self.reply() if callable(self.reply) else self.reply


@pytest.fixture
def db(empty_db: psycopg.Connection) -> psycopg.Connection:
    migrate(empty_db)
    return empty_db


def use(monkeypatch: pytest.MonkeyPatch, gemini: FakeProvider, openrouter: FakeProvider) -> None:
    monkeypatch.setattr(llm, "PROVIDERS", [("Gemini", gemini), ("OpenRouter", openrouter)])


def cache_rows(conn: psycopg.Connection) -> list[tuple[str, str]]:
    return conn.execute("SELECT key, response FROM ai_cache").fetchall()


@needs_db
def test_primary_raises_fallback_answers_and_one_row_is_cached(
    db: psycopg.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    gemini, openrouter = FakeProvider(ConnectionError("503")), FakeProvider(GOOD)
    use(monkeypatch, gemini, openrouter)

    assert llm.call_llm(db, PROMPT, INPUT, Answer) == Answer(titles=["Drainage upgrade"])
    assert (gemini.calls, openrouter.calls) == (1, 1)
    rows = cache_rows(db)
    assert len(rows) == 1
    assert rows[0][0] == llm.cache_key(PROMPT, INPUT, Answer)


@needs_db
def test_both_fail_raises_one_error_naming_both(
    db: psycopg.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    use(monkeypatch, FakeProvider(ConnectionError("key=secret")), FakeProvider("not json"))

    with pytest.raises(llm.LLMError) as e:
        llm.call_llm(db, PROMPT, INPUT, Answer)
    assert str(e.value) == "Gemini failed (ConnectionError); OpenRouter returned invalid JSON."
    assert "secret" not in str(e.value)


@needs_db
def test_invalid_output_raises_and_caches_nothing(
    db: psycopg.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    wrong_shape = '{"titles": "Drainage upgrade"}'
    use(monkeypatch, FakeProvider(wrong_shape), FakeProvider(wrong_shape))

    with pytest.raises(llm.LLMError, match="Gemini returned output that failed validation"):
        llm.call_llm(db, PROMPT, INPUT, Answer)
    assert cache_rows(db) == []


@needs_db
def test_second_identical_call_makes_no_provider_call(
    db: psycopg.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    gemini, openrouter = FakeProvider(GOOD), FakeProvider(GOOD)
    use(monkeypatch, gemini, openrouter)

    first = llm.call_llm(db, PROMPT, INPUT, Answer)
    second = llm.call_llm(db, PROMPT, INPUT, Answer)
    assert first == second
    assert (gemini.calls, openrouter.calls) == (1, 0)


@needs_db
def test_missing_keys_count_as_failures(
    db: psycopg.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The real providers: with no keys set they fail before any network call.
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    with pytest.raises(llm.LLMError) as e:
        llm.call_llm(db, PROMPT, INPUT, Answer)
    assert str(e.value) == "Gemini has no API key set; OpenRouter has no API key set."


@needs_db
def test_a_slow_provider_times_out(db: psycopg.Connection, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(llm, "TIMEOUT_S", 0.1)

    def slow() -> str:
        time.sleep(1)
        return GOOD

    use(monkeypatch, FakeProvider(slow), FakeProvider(GOOD))
    assert llm.call_llm(db, PROMPT, INPUT, Answer) == Answer(titles=["Drainage upgrade"])

    use(monkeypatch, FakeProvider(slow), FakeProvider(slow))
    with pytest.raises(llm.LLMError, match=r"^Gemini timed out after 0.1 s; OpenRouter timed out"):
        llm.call_llm(db, PROMPT, "another input", Answer)


def test_cache_key_covers_prompt_input_and_output_model() -> None:
    class Other(BaseModel):
        titles: list[str]

    key = llm.cache_key(PROMPT, INPUT, Answer)
    assert key == llm.cache_key(PROMPT, INPUT, Answer)
    assert key != llm.cache_key(PROMPT + " ", INPUT, Answer)
    assert key != llm.cache_key(PROMPT, INPUT + " ", Answer)
    assert key != llm.cache_key(PROMPT, INPUT, Other)
