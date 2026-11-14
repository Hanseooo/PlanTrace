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
   cites the master spec's AC IDs, then `/han-to-tickets`. S0 is ticket 01,
   the walking skeleton (Parallel work).
4. Each person claims a ticket, branches, and runs `/stint #<n>`.

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
- Install: none yet: ticket 01 adds it (assumed: npm in `web/`, `uv sync` in `api/`)
- Dev: none yet: ticket 01 adds it
- Typecheck: none yet: ticket 01 adds it
- Lint: none yet: ticket 01 adds it
- Unit tests: none yet: ticket 01 adds it
- Demo smoke: none yet: ticket 01 adds it

## Parallel work
- Ticket 01, the **walking skeleton**: the app deployed, the demo journey's
  screens reachable on mock data, the contract files written, the demo smoke
  passing, and a CI check that runs typecheck, lint, unit tests and the demo
  smoke on every PR. It blocks every other ticket.
- **Contract files**: shared types, schema, mock data, root layout,
  `package.json` and lockfile, env names. Paths: <listed by ticket 01>.
- Every later ticket owns one folder, labelled `lane:<folder>` on GitHub.
  Edit outside your folder only in contract files, after telling the team.
- Claim before starting: assign yourself on GitHub.
- One branch per ticket. PR body says `Closes #<n>`. Self-merge when CI
  passes. `main` stays demoable.
- Deferred work (the roadmap's optional extensions) starts only when the demo smoke passes
  on the deployed `main` and it is before 2026-11-15 04:30.

## Testing
- `/tdd` at these seams: parsers, data transforms, branching domain logic.
- Demo smoke: one Playwright test walking the demo journey.
- A ticket that changes a demo-journey screen adds that screen's step to the
  demo smoke, which covers its UI components and glue code.

## Review
- Every ticket: one `/code-review` pass after `/stint`'s commit step, before
  the branch is pushed.
- Shared or System-wide blast radius, as the ticket's Blast radius field says:
  `/stint`'s second `/code-review` pass too, over the first pass's fixes,
  also before the push.

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
