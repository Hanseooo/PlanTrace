"""The LLM seam (RS-09): the only code that calls a model.

`call_llm(conn, prompt, input, OutputModel)` returns a validated `OutputModel`:
1. A cache hit in `ai_cache` returns without any provider call (S2-18).
2. Otherwise Gemini is tried, then OpenRouter, each with a 90 s timeout (S2-17).
3. Only output that passed validation is written to the cache.
4. If every provider fails, `LLMError` names each provider and its reason.

The providers are called in order here rather than through `.with_fallbacks`, because the
error has to name both failures. Tests replace `PROVIDERS` with fakes (the provider boundary).
"""

import hashlib
import json
import os
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout

import psycopg
from langchain_core.messages import BaseMessage
from langchain_core.runnables import Runnable
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from psycopg.pq import TransactionStatus
from pydantic import BaseModel, SecretStr, ValidationError

# Part of the cache key: a primed row keeps hitting whichever provider answered it.
# The `-latest` alias tracks Google's current Flash model; pin an id here if it drifts.
PRIMARY_MODEL = "gemini-flash-latest"
FALLBACK_MODEL = "openai/gpt-4o-mini"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
TIMEOUT_S = 90

SELECT_CACHE = "SELECT response FROM ai_cache WHERE key = %s"
UPSERT_CACHE = """
INSERT INTO ai_cache (key, response) VALUES (%s, %s)
ON CONFLICT (key) DO UPDATE SET response = EXCLUDED.response, created_at = now()
"""


class LLMError(Exception):
    """Every provider failed. The message is safe to show a planner: no keys, no traces."""


class MissingKeyError(Exception):
    """A provider's API key is not set; counts as that provider failing (S2-17)."""


def cache_key(prompt: str, input: str, output_model: type[BaseModel]) -> str:
    """The `ai_cache` key (S2-18). Public so the S2-19 loader computes the same key (SH-02).

    It ignores which provider answered, so a row primed while Gemini was down still hits.
    """
    parts = [PRIMARY_MODEL, prompt, input, output_model.__name__]
    return hashlib.sha256(json.dumps(parts).encode()).hexdigest()


def _messages(prompt: str, input: str) -> list[tuple[str, str]]:
    return [("system", prompt), ("human", input)]


def _raw_text(structured: Runnable, prompt: str, input: str) -> str:
    # include_raw keeps parsing out of LangChain: llm.py validates, so it can name the reason.
    result = structured.invoke(_messages(prompt, input))
    raw = result["raw"] if isinstance(result, dict) else None
    if not isinstance(raw, BaseMessage):
        raise ValueError("no raw message in the structured output")
    return raw.text


def _gemini(prompt: str, input: str, output_model: type[BaseModel]) -> str:
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise MissingKeyError
    chat = ChatGoogleGenerativeAI(
        model=PRIMARY_MODEL, google_api_key=SecretStr(key), timeout=TIMEOUT_S, max_retries=0
    )
    return _raw_text(chat.with_structured_output(output_model, include_raw=True), prompt, input)


def _openrouter(prompt: str, input: str, output_model: type[BaseModel]) -> str:
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        raise MissingKeyError
    chat = ChatOpenAI(
        model=FALLBACK_MODEL,
        api_key=SecretStr(key),
        base_url=OPENROUTER_BASE_URL,
        timeout=TIMEOUT_S,
        max_retries=0,
    )
    structured = chat.with_structured_output(output_model, method="json_schema", include_raw=True)
    return _raw_text(structured, prompt, input)


# The provider boundary: (name shown in errors, call returning the model's raw JSON text).
Provider = Callable[[str, str, type[BaseModel]], str]
PROVIDERS: list[tuple[str, Provider]] = [("Gemini", _gemini), ("OpenRouter", _openrouter)]


def _call_with_timeout(provider: Provider, prompt: str, input: str, model: type[BaseModel]) -> str:
    # A hard deadline on top of the client timeout: no provider call outlives TIMEOUT_S.
    pool = ThreadPoolExecutor(max_workers=1)
    try:
        return pool.submit(provider, prompt, input, model).result(timeout=TIMEOUT_S)
    finally:
        pool.shutdown(wait=False, cancel_futures=True)


def call_llm[T: BaseModel](
    conn: psycopg.Connection, prompt: str, input: str, output_model: type[T]
) -> T:
    """Ask the model and return a validated `output_model`, or raise `LLMError`.

    The cache row is written on `conn`. Before a provider is asked, an open transaction
    on `conn` is committed: a provider can take minutes, and a connection left idle in a
    transaction that long can be closed by the database or its pooler, which failed the
    whole check run (POST /checks/run answered 500 after 212 s). Callers commit their
    writes before asking, so this only ends the reads (and cache rows) so far.
    """
    key = cache_key(prompt, input, output_model)
    row = conn.execute(SELECT_CACHE, (key,)).fetchone()
    if row is not None:
        try:
            return output_model.model_validate_json(row[0])
        except ValidationError:
            pass  # a row from an older output model: ask again and overwrite it

    if conn.info.transaction_status == TransactionStatus.INTRANS:
        conn.commit()

    reasons: list[str] = []
    for name, provider in PROVIDERS:
        try:
            text = _call_with_timeout(provider, prompt, input, output_model)
            parsed = output_model.model_validate_json(text)
        except MissingKeyError:
            reasons.append(f"{name} has no API key set")
        except FutureTimeout:
            reasons.append(f"{name} timed out after {TIMEOUT_S} s")
        except ValidationError as e:
            bad_json = any(err["type"] == "json_invalid" for err in e.errors())
            what = "invalid JSON" if bad_json else "output that failed validation"
            reasons.append(f"{name} returned {what}")
        except Exception as e:  # any provider failure moves on to the next one
            # Only the error's type: provider messages can echo request URLs or keys.
            reasons.append(f"{name} failed ({type(e).__name__})")
        else:
            conn.execute(UPSERT_CACHE, (key, parsed.model_dump_json()))
            return parsed
    raise LLMError("; ".join(reasons) + ".")
