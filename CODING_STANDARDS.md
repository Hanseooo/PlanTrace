> [README](README.md) / Coding standards

# PlanTrace coding standards

For a codebase that exists for one night and one demo. [AGENTS.md](AGENTS.md) wins where they differ. Structure and seams are in [ARCHITECTURE.md](ARCHITECTURE.md). `/code-review` checks diffs against this file.

## 1. Abstractions

**Default: write it inline.** A route handler may validate, run SQL and return the result in one function. No routers → services → repositories layers.

**Extract on the third copy.** Two similar blocks stay duplicated. The third time, extract a helper next to its callers.

**Only these seams exist:**

| Seam | File | Why it is allowed |
|---|---|---|
| LLM call | `api/app/llm.py` | Provider fallback and the demo cache live in one place |
| CCC export layout | `api/app/checks/ccc_export.py` | The real CCC sheet is unknown and will change |
| API contract | `api/app/models.py` → `web/src/lib/api-types.ts` | Web and api agree on shapes |

Any other seam needs team agreement first.

**Never:**
- An interface, base class or registry with one implementation.
- A factory, plugin system or strategy pattern.
- Config or env vars for values that never change. Use a module constant.
- A TypeScript type written by hand for an API shape. Use the generated types.
- Code for a deferred feature (F6, F7, page images) before its ticket starts.

**Allowed without asking:** a module constant, a small pure function used in one place when it gets a name a reader needs (for example `overlapping_years`), and a Pydantic model for each AI output.

## 2. Python (`api/`)

- ruff and pyright pass. Type hints on every function.
- SQL uses psycopg parameters (`%s`). Never build SQL with f-strings or `+`.
- Keep SQL next to the code that runs it, as a triple-quoted constant. Schema changes go only in `db/migrations/NNN_name.sql`, by the schema owner.
- No bare `except`. Catch the specific error and turn it into a status or an HTTP error with a message the planner can act on.
- A background extraction never fails silently. Any error ends with `plans.status = 'failed'` and `error` set.

## 3. AI output

- Every model call goes through `llm.py` and returns a validated Pydantic object.
- Prompts are module constants next to their caller.
- Every finding stores the `page_ids` it rests on. A finding without a source is a bug.
- AI findings start as `suggested`. The UI labels them "AI suggestion" until a person confirms them.
- A reason describes the plans, never a person or office at fault (PRD section 11).

## 4. Web (`web/`)

- Server data goes through TanStack Query. No global store.
- Use shadcn/ui primitives and the platform controls. No custom select, scrollbar or date picker.
- Every demo-journey screen has loading, empty, error and disabled states and an in-app way back.
- Destructive actions (delete a PPA row, reject a finding) have a confirm or an undo.
- Every control has an accessible name. Enter and Escape work in forms and dialogs.
- The "synthetic data" label is visible on every screen.

## 5. Data

- Synthetic only. Fictional city, "Barangay 1" to "Barangay 12" or fictional names, no real barangays, no real people (RA 10173).
- Domain values are exact strings shared by schema, models and UI: check `duplicate | orphan | ccc | zone`; finding status `suggested | confirmed | rejected`; PPA status `draft | confirmed`; CCC verdict `Conflict | Compatible | Complementary`.
- Fixtures in `seed/fixtures/` match the Pydantic models. A model change updates them in the same PR.

## 6. Tests

- pytest for the 4 checks against `seed/expected_findings.json`: all 8 planted issues found, 2 or fewer false flags (PRD section 4). CCC tests read AI results from `ai_cache`, so they are repeatable.
- One Playwright demo smoke test. A ticket that changes a demo-journey screen adds that screen's step.
- `/tdd` at parsers, data transforms and branching check logic. Nothing else is required.
- Expected values come from the answer key or a hand-worked example, never from the code under test.

## 7. Secrets

Read only `.env.example`. Keys never appear in code, logs, fixtures, test output or chat.
