"""Upload and extraction (lane:ai). Stub: returns a plan in "extracting" and keeps nothing."""

from typing import Annotated

from fastapi import APIRouter, File

from app.fixtures import load_fixture
from app.models import Plan, PlanUpload

router = APIRouter()


@router.post("/plans")
def upload_plan(body: Annotated[PlanUpload, File()]) -> Plan:
    return load_fixture("plan_upload.json", Plan)
