import logging
import os
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.checks import routes as checks
from app.extract import routes as extract
from app.plans import routes as plans


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # S2-15: a redeploy or crash mid-extraction never leaves a plan stuck in "extracting".
    # Honours a test override of get_connector, so tests stay on TEST_DATABASE_URL (D7).
    connector = app.dependency_overrides.get(extract.get_connector, extract.get_connector)()
    extract.reset_interrupted(connector)
    yield


# One schema name per model, so web/src/lib/api-types.ts stays stable.
app = FastAPI(title="PlanTrace API", separate_input_output_schemas=False, lifespan=lifespan)

logger = logging.getLogger("plantrace")

# The message the web app shows for an unexpected error; it adds the final full stop.
UNEXPECTED_ERROR = "The PlanTrace API hit an unexpected error; try again"


@app.middleware("http")
async def unexpected_errors_as_json(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """An unhandled error becomes a JSON 500 here, inside CORSMiddleware (added after this,
    so it wraps it), so the answer keeps its CORS headers. Without this the browser blocks
    the 500 and the web app can only say the API is unreachable. The traceback is logged."""
    try:
        return await call_next(request)
    except Exception:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse({"detail": UNEXPECTED_ERROR}, status_code=500)


app.add_middleware(
    CORSMiddleware,
    # Comma-separated, e.g. "http://localhost:3000,https://plantrace.vercel.app".
    allow_origins=[o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(extract.router)
app.include_router(plans.router)
app.include_router(checks.router)
