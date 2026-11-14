import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.checks import routes as checks
from app.extract import routes as extract
from app.plans import routes as plans

# One schema name per model, so web/src/lib/api-types.ts stays stable.
app = FastAPI(title="PlanTrace API", separate_input_output_schemas=False)

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
