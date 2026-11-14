# PlanTrace — hackathon agent rules

DS3 Hackathon, 2026-11-14 21:44 to 2026-11-15 09:29. Team of 3, each driving their own agent.
Code freeze: 2026-11-15 06:29. At the freeze, one person walks the demo journey
by hand on the deployed app with the demo data. After the freeze, only fixes
for what that rehearsal breaks merge.

This repo serves one **demo journey**: the steps a judge sees, defined as the
acceptance journey (J1 to J9) in [docs/specs/plantrace-spec.md](docs/specs/plantrace-spec.md).
A working demo outranks maintainability.
Product scope and the demo script: [PRD.md](PRD.md).
Structure, seams and contract: [ARCHITECTURE.md](ARCHITECTURE.md). How to write code: [CODING_STANDARDS.md](CODING_STANDARDS.md).

## Kickoff
1. `/han-grill`: pick the problem from the shortlist and the backend by the
   rule under Decisions. Record both there. Done 2026-11-14, see Decisions.
2. Master spec: `docs/specs/plantrace-spec.md` holds every acceptance
   criterion. Done and Ready 2026-11-14; decisions D1 to D13 confirmed.
3. Slice roadmap: `docs/specs/plantrace-roadmap.md` splits the spec into
   slices S0 to S6. Per slice: `/han-to-spec` writes a short slice spec that
   cites the master spec's AC IDs, then `/han-to-tickets`. S0, the walking
   skeleton, is spec #1 with tickets #2 to #7 (Parallel work).
4. Each person claims a ticket, branches, and runs `/implement #<n>`.

## Decisions
Change a line here only after telling the team. One line each: choice, because reason.
- Problem: PlanTrace, a plan consistency checker for one city LGU (PRD.md), because the mentor's slide 13 and problem H point at plans that don't connect, and the mentor approved proposal 2, which this pivots.
- Backend: Supabase Postgres (plain Postgres, no Supabase Auth or auto API) plus a Python service (FastAPI in `api/`), because extraction and checks need Python-only libraries (PyMuPDF, pandas, LangChain).
  Rule used:
  - Supabase Postgres: default.
  - Convex: live multi-user sync is the core of the demo and a teammate has shipped with it.
  - Turso/SQLite: offline or low-connectivity use is the point.
  - Add a Python service: the core needs a Python-only library.

## Commands (use exactly)
- Install (api): `cd api && uv sync`
- Install (web): `cd web && npm ci && npx playwright install chromium` (CI and fresh Linux: `npx playwright install --with-deps chromium`)
- Dev (api): `cd api && uv run uvicorn app.main:app --reload` (port 8000; set `CORS_ORIGINS` to the web origin)
- Dev (web): `cd web && npm run dev` (http://localhost:3000)
- Typecheck (api): `cd api && uv run pyright`
- Typecheck (web): `cd web && npm run typecheck`
- Lint (api): `cd api && uv run ruff check . && uv run ruff format --check .`
- Lint (web): `cd web && npm run lint`
- Generate API types: `cd web && npm run gen:types` (needs `uv sync` in `api/`; writes `web/src/lib/api-types.ts`, never edit it by hand)
- Unit tests (api): `cd api && uv run pytest`
- Migrate: `cd api && uv run python -m app.db.migrate` (reads `DATABASE_URL`; or pass a URL as the argument)
- Seed: `cd api && uv run python -m app.db.seed` (reads `DATABASE_URL`, or pass a URL; migrate first. Renders `seed/pdfs/` from `seed/city.json`, then empties every table except `ai_cache` and `schema_migrations` and loads the City of Sampaguita)
- Load the cached AI answers: `cd api && uv run python -m app.extract.load_cache` (reads `DATABASE_URL`, or pass a URL; seed first. Puts `seed/ai_cache/lccap.json` into `ai_cache` under the key the J2 upload computes, and `seed/ai_cache/orphans.json`, when present, under the keys the orphan check computes. `--capture` asks the real providers instead and rewrites both files; `--capture-orphans` rewrites only `orphans.json`; both need `GEMINI_API_KEY` or `OPENROUTER_API_KEY`)
- Demo smoke: `cd web && npm run smoke` (starts the api on :8000 and builds and starts the web app on :3000 against it; set `DATABASE_URL` to a seeded database first, as CI does with `TEST_DATABASE_URL`); against a deployed web app: `cd web && BASE_URL=<web url> npm run smoke` (PowerShell: `cd web; $env:BASE_URL="<web url>"; npm run smoke`)

## Parallel work
- S0, the **walking skeleton** (spec #1, tickets #2 to #7): the app deployed,
  the demo journey's screens reachable on mock data, the contract files
  written, the demo smoke passing, and a CI check that runs typecheck, lint,
  unit tests and the demo smoke on every PR. #2, #3 and #4 start in parallel.
  #7, the closeout, blocks every ticket of S1 to S6.
- **Contract files**: shared types, schema, mock data, root layout,
  `package.json` and lockfile, env names. Paths: `api/app/models.py`,
  `api/app/main.py`, `api/app/db/migrations/`, `seed/fixtures/`,
  `web/src/lib/api-types.ts` (generated), `web/src/app/layout.tsx`,
  `web/package.json` + `web/package-lock.json`, `api/pyproject.toml` +
  `api/uv.lock`, `.env.example`.
- Every later ticket owns one folder, labelled `lane:<folder>` on GitHub.
  Edit outside your folder only in contract files, after telling the team.
- Claim before starting: assign yourself on GitHub.
- One branch per ticket. PR body says `Closes #<n>`. Self-merge when CI
  passes. `main` stays demoable.
- Deferred work (the roadmap's optional extensions) starts only when the demo smoke passes
  on the deployed `main` and it is before 2026-11-15 04:30.

## Docs
- A PR that changes something a doc states (a command, path, env name,
  schema, endpoint, route or decision) updates that doc in the same PR.
  When code and a doc disagree, the code wins: fix the doc and say so in
  the PR body.
- A new command goes into "Commands" above in the PR that adds it.
- Roadmap: a ticket's PR doesn't edit `docs/specs/plantrace-roadmap.md`.
  After merging, comment the PR and CI run links on the slice's spec issue.
  The slice's closeout ticket writes them into the roadmap, sets the status
  and moves the current-slice line. One writer per slice avoids merge
  conflicts on the shared row.
- A doc change to Decisions, the contract or a confirmed D decision needs
  the team told first, as for code.

## Testing
- `/tdd` at these seams: parsers, data transforms, branching domain logic.
- Demo smoke: one Playwright test walking the demo journey.
- A ticket that changes a demo-journey screen adds that screen's step to the
  demo smoke, which covers its UI components and glue code.

## Review
Reviews cost tokens. Cap: two `/code-review` runs per slice.
- Mandatory: one `/code-review` after a slice's last implementation ticket
  lands, over the whole slice against its spec. A second pass, over the first
  pass's fixes, only when those fixes were more than trivial.
- Per ticket: no review by default. This overrides the review step at the end
  of `/implement`. Review a single ticket only when needed: it is High
  complexity or System-wide and other tickets build on it. That run counts
  toward the cap.
- Findings past the cap are listed in the PR, not fixed.

## Code
- Smallest thing that works: does it need to exist → platform or stdlib →
  installed dependency → minimum code.
- New dependency: allowed when it saves time; tell the team before installing.
- Surgical changes in the existing style. Reuse before writing.
- Demo-journey screens carry loading, empty, error and disabled states and a
  way back.
- Done means it works in the deployed app.
- Secrets: read only `.env.example`; keep keys out of code, logs and chat.

## Agent skills

### Issue tracker
GitHub Issues on Hanseooo/PlanTrace, through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels
The five default labels, plus `lane:web`, `lane:ai`, `lane:data`. See `docs/agents/triage-labels.md`.

### Domain docs
Single-context: `GLOSSARY.md` and `docs/adr/` at the root. See `docs/agents/domain.md`.
