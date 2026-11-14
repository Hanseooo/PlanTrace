import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
