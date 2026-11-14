"""S2-13: field cleanup of the model's raw PPAs, a pure function (no database)."""

from app.extract.extraction import RawPpa, clean_ppas
from app.models import PpaInput

BARANGAYS = {"1199900012", "1199900007"}
PAGE_IDS = {1: 41, 2: 42, 3: 43}  # a 3-page PDF: page number -> pages.id


def test_bad_fields_become_blank_and_the_rest_is_kept() -> None:
    raw = RawPpa(
        code="LCCAP-01",
        title="Mangrove rehabilitation along the coast",
        description="Replanting of 20 hectares of coastal mangroves",
        office="City Environment and Natural Resources Office",
        sector="parks",
        barangays=["1199900012", "9999999999"],
        cost="about 3M",
        year_start="2026",
        year_end="2028",
        page=9,
    )
    assert clean_ppas([raw], BARANGAYS, PAGE_IDS) == [
        PpaInput(
            code="LCCAP-01",
            title="Mangrove rehabilitation along the coast",
            description="Replanting of 20 hectares of coastal mangroves",
            office="City Environment and Natural Resources Office",
            sector=None,
            barangays=["1199900012"],
            cost=None,
            year_start=2026,
            year_end=2028,
            page_id=None,
        )
    ]
