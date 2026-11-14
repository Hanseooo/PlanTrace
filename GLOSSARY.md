# Glossary

Terms PlanTrace uses in code, issues, tests and the UI. Use the term in the first column; avoid the ones in the last. Sources: [PRD.md](PRD.md), [ARCHITECTURE.md](ARCHITECTURE.md).

| Term | Meaning | Avoid |
|---|---|---|
| LGU | Local government unit. Here, one city | "client", "tenant" |
| PSGC | Philippine Standard Geographic Code. Identifies the LGU and each barangay | barangay names as keys |
| CPDO | City Planning and Development Office, the user | "admin" |
| Plan | One uploaded plan document of one type and period | "file", "document" for the record |
| Plan type | CLUP, CDP, LDIP, AIP, LDRRMP, LCCAP | — |
| Sectoral plan | A plan an office writes for one area, such as the LDRRMP (disaster) or LCCAP (climate). It should feed the CDP | — |
| Plan chain | AIP → LDIP → CDP → CLUP. The yearly budget plan rolls up to the land use base | "hierarchy" |
| PPA | Program, project or activity. One row in a plan | "item", "project" for all three |
| Extraction | The AI reading a plan's pages into draft PPAs | "parsing", "import" |
| Confirm | A planner accepting a plan's PPA table. Only confirmed PPAs are checked | "approve" |
| Check | One of 4 rules that produce findings: duplicate, orphan, CCC, zone | "scan", "test" |
| Finding | One issue a check raises, with a reason and source pages. Status: suggested, confirmed or rejected | "error", "alert" |
| Duplicate | Two PPAs from different plans that describe the same project | "overlap" |
| Orphan | An AIP PPA with no confirmed parent in the CDP or LDIP | "unlinked" |
| Link | A confirmed or suggested parent-child relation between two PPAs | — |
| CCC test | Conflict-Compatibility-Complementarity, the LDIP pair screen. Verdicts: C (Conflict), Cm (Compatible), Cp (Complementary). Whether these codes match the real DILG sheet is unverified | "CCC matrix" for the test itself |
| CCC matrix | The PPA × PPA grid of CCC verdicts and its Excel export | — |
| Zone conflict | A PPA in a CLUP zone or hazard area whose rules forbid its sector | — |
| Answer key | `seed/expected_findings.json`, the planted issues the checks should find | "test data" |
