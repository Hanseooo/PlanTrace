# PlanTrace

A plan consistency checker for a city LGU. Working name. Built for the DS3 hackathon (2026-11-14 21:44 to 11-15 09:29, 3 people) for city planning offices in Davao Region.

A city's plans (CLUP, CDP, LDIP, AIP, LDRRMP, LCCAP) should connect, but offices often write them separately. PlanTrace reads the uploaded plans, extracts every program, project and activity (PPA) into one table for a planner to confirm, and runs 4 checks:

1. **Duplicate:** the same project in two plans, often with different costs or years.
2. **Orphan:** an AIP or LDIP project with no parent in the CDP.
3. **CCC pair:** the Conflict-Compatibility-Complementarity test, pre-filled as a matrix with Excel export.
4. **Zone conflict:** a project in a land use or hazard zone that forbids it.

Each finding shows a reason and the source page, and a person confirms or rejects it. Deferred: a plan chain view and "Ask the records", which answers questions along the plan chain with citations.

## Documents

| File | What |
|---|---|
| [PRD.md](PRD.md) | Problem, scope, features F1 to F7, demo script, team plan, risks |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack, folders and lanes, contract, data model, API |
| [CODING_STANDARDS.md](CODING_STANDARDS.md) | When to abstract, language rules, tests. `/code-review` checks against it |
| [Master spec](docs/specs/plantrace-spec.md) | Demo journey J1 to J9, acceptance criteria, open decisions D1 to D13 |
| [Slice roadmap](docs/specs/plantrace-roadmap.md) | Slices S0 to S6, their order and what runs in parallel |
| [GLOSSARY.md](GLOSSARY.md) | Terms used in code, issues and the UI |
| [Research wiki](../ds3-lgu-wiki/README.md) | Mentor slides, problem research, earlier proposals |

## Status

PRD, architecture, coding standards, master spec and slice roadmap. No code yet.

## Planned layout

```
plantrace/
  web/    Next.js, shadcn/ui, TanStack Table and Query
  api/    FastAPI, Pydantic, uv, psycopg 3, PyMuPDF, LangChain (Gemini, OpenRouter fallback)
  seed/   Synthetic plans for the fictional City of Sampaguita, and expected_findings.json
```

Full layout and lane owners: [ARCHITECTURE.md](ARCHITECTURE.md#folders-and-lanes). The database is a shared Supabase project, used as plain Postgres. Setup commands go in `web/README.md` and `api/README.md` when those folders exist, 3 commands or fewer each.

## Team rules

- Commit `.env.example`. Never commit `.env`.
- Share keys privately. One Gemini key per teammate for development, a separate key for the demo.
- One person owns schema changes.
- The API contract in [ARCHITECTURE.md](ARCHITECTURE.md#api) is fixed in hour 0. Change it only with the team's agreement.

## Data

Synthetic only. No real resident or staff data (RA 10173). Findings describe plans, not people.
