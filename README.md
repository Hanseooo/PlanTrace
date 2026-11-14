# PlanTrace

A plan consistency checker for a city LGU. Working name. Built for the DS3 hackathon (19 hours, 4 people), 2026-11-14.

A city's plans (CLUP, CDP, LDIP, AIP, LDRRMP, LCCAP) should connect, but offices often write them separately. PlanTrace reads the uploaded plans, extracts every program, project and activity (PPA) into one table for a planner to confirm, and runs 4 checks:

1. **Duplicate:** the same project in two plans, often with different costs or years.
2. **Orphan:** an AIP or LDIP project with no parent in the CDP.
3. **CCC pair:** the Conflict-Compatibility-Complementarity test, pre-filled as a matrix with Excel export.
4. **Zone conflict:** a project in a land use or hazard zone that forbids it.

Each finding shows a reason and the source page, and a person confirms or rejects it. "Ask the records" answers questions along the plan chain, with citations.

## Documents

| File | What |
|---|---|
| [PRD.md](PRD.md) | Problem, scope, features F1 to F7, demo script, data model, API draft, team plan, risks |
| [Research wiki](../ds3-lgu-wiki/README.md) | Mentor slides, problem research, earlier proposals |

## Status

PRD only. No code yet.

## Planned layout

```
plantrace/
  web/    Next.js, shadcn/ui, TanStack Table and Query, React Flow
  api/    FastAPI, Pydantic, uv, PyMuPDF, LangChain (Gemini, OpenRouter fallback)
  seed/   Synthetic plans for the fictional City of Sampaguita, and expected_findings.json
```

The database is a shared Supabase project, used as plain Postgres. Setup commands go in `web/README.md` and `api/README.md` when those folders exist, 3 commands or fewer each.

## Team rules

- Commit `.env.example`. Never commit `.env`.
- Share keys privately. One Gemini key per teammate for development, a separate key for the demo.
- One person owns schema changes.
- The API contract in [PRD section 9](PRD.md#api-first-draft-fixed-in-hour-0) is fixed in hour 0. Change it only with the team's agreement.

## Data

Synthetic only. No real resident or staff data (RA 10173). Findings describe plans, not people.
