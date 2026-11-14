"""Upload and extraction (lane:ai). Stubs: return a plan in "extracting" and keep nothing.
The real upload is #20 and the real retry #21."""

from typing import Annotated

from fastapi import APIRouter, File

from app.fixtures import load_fixture
from app.models import Plan, PlanRetry, PlanUpload

router = APIRouter()


@router.post("/plans")
def upload_plan(body: Annotated[PlanUpload, File()]) -> Plan:
    return load_fixture("plan_upload.json", Plan)


@router.post("/plans/{plan_id}/retry")
def retry_plan(plan_id: int, body: Annotated[PlanRetry, File()]) -> Plan:
    return load_fixture("plan_upload.json", Plan)
