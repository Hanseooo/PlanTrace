"""Plan list, PPA table edits, confirm (lane:data). Stubs: they ignore path IDs and
don't persist writes until the real queries land (SH-01)."""

from fastapi import APIRouter, Response

from app.fixtures import load_fixture
from app.models import Plan, Ppa, PpaInput

router = APIRouter()


@router.get("/plans")
def list_plans() -> list[Plan]:
    return load_fixture("plans.json", list[Plan])


@router.get("/plans/{plan_id}")
def get_plan(plan_id: int) -> Plan:
    return load_fixture("plans.json", list[Plan])[0]


@router.get("/plans/{plan_id}/ppas")
def list_ppas(plan_id: int) -> list[Ppa]:
    return load_fixture("ppas.json", list[Ppa])


@router.post("/plans/{plan_id}/ppas")
def add_ppa(plan_id: int, body: PpaInput) -> Ppa:
    return load_fixture("ppas.json", list[Ppa])[0]


@router.patch("/ppas/{ppa_id}")
def update_ppa(ppa_id: int, body: PpaInput) -> Ppa:
    return load_fixture("ppas.json", list[Ppa])[0]


@router.delete("/ppas/{ppa_id}", status_code=204)
def delete_ppa(ppa_id: int) -> Response:
    return Response(status_code=204)


@router.post("/plans/{plan_id}/confirm")
def confirm_plan(plan_id: int) -> Plan:
    return load_fixture("plans.json", list[Plan])[0]
