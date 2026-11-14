> [README](../../README.md) / Roadmap

# PlanTrace slice roadmap

2026-11-14. **Status: Active.** Decisions D1 to D13 confirmed by the team on 2026-11-14. Current slice: S0.

## Working with this roadmap

Read this roadmap when it is referenced in discussion, spec writing, implementation
or review. Read only the relevant slice's linked spec and evidence. Update the
roadmap during that session; no Docket invocation is needed.

- During grilling or brainstorming, record settled decisions, open questions and
  newly visible work. Revise provisional slices within the agreed outcome as
  evidence warrants; record why. Keep technical prerequisites inside the user
  outcome they enable; a new slice must deliver a separately usable outcome.
  A slice that needs more than one spec splits into slices on this roadmap
  before any spec is written. Ask before changing product scope or confirmed
  decisions. An uncertainty becomes a question first, not automatically a slice.
- When the user invokes their spec skill, publish that slice's spec to the
  configured tracker, link the returned issue from its roadmap entry, and retain
  stable decision IDs and source links. The spec cites this roadmap's rules by
  RS ID, numbers its own rules SH, and lists in its verification the J
  journeys this slice completes, so its ticket breakdown ends with a closeout
  that runs them. In the spec handoff include this roadmap's path and an
  instruction to read and update it after implementation and review; preserve
  that pointer in derived work items. Spec and ticket creation remain
  separately user-invoked.
- After implementation or review, reconcile the slice against its spec using
  supplied implementation, test and review references. Mark Complete only when
  every acceptance check passes, review is complete, and the user has explicitly
  accepted any remaining findings. Record those references and accepted findings.
  Missing evidence or failed checks leave the slice incomplete with a visible gap.
  Adequate supplied evidence needs no repeat audit. Move the current-slice line
  when the next slice starts.
- At the next slice discussion, reconcile any stale status first. Discussion may
  proceed while earlier slices are incomplete; keep their gaps visible and gate
  dependent implementation on unmet prerequisites.
- Keep a slice's detailed behavior and acceptance checks in its linked spec.
  Keep this roadmap to outcomes, roadmap rules and journeys, dependencies,
  decisions or source links, uncertainty, status and evidence. Preserve IDs,
  rationale, exclusions and history.
  Approval or discussion alone authorizes no implementation or external changes.

### Lightweight slice specs (this project)

The behavior is already written in the [master spec](plantrace-spec.md). A slice spec does not rewrite it. It lists the master spec's AC IDs it owns, adds slice-only SH rules if any, names its lane split (`lane:web`, `lane:ai`, `lane:data`), and lists the J journeys it completes. Target: one screen of text.

## Destination and scope

- **User:** CPDO staff in one city; the presenter of the demo. Source: [PRD](../../PRD.md) section 1.
- **Minimum outcome:** the demo journey J1 to J9 runs on the deployed app with the seeded City of Sampaguita before the code freeze, 2026-11-15 06:29 ([AGENTS.md](../../AGENTS.md)).
- **Observable success:** the Playwright demo smoke walks J1 to J9 on the deployed `main`; the checks find all 8 planted issues with 2 or fewer false flags (PRD section 4).
- **Constraints:** 3 people, one lane each; ticket 01 blocks all others; contract changes need the team ([ARCHITECTURE.md](../../ARCHITECTURE.md)); synthetic data only.
- **Excluded:** master spec section 1 "Excluded".
- **Optional extensions** (start only if the smoke passes on deployed `main` before 04:30, in order): source page images, F6 plan chain view, F7 Ask the records. Not slices yet.

## Shared decisions

Detail lives once, in the [master spec section 7](plantrace-spec.md#7-decisions). All rows were confirmed by the team on 2026-11-14 as the master spec recommended.

| ID | Choice (short) | Binds | Status |
|---|---|---|---|
| D1 | PDF only | S2 | User-confirmed |
| D2 | Retry resends the in-memory `File` | S2 | User-confirmed |
| D3 | One fixed, specific sector list, written by the data lane | S0, S1, S3, S4 | User-confirmed. Needed before S1 writes the plans |
| D4 | Accept parent confirms link and finding | S4 | User-confirmed |
| D5 | Reviewed finding kept while both PPAs' `updated_at` are older than the review | S4 | User-confirmed |
| D6 | Confirmed plan stays editable | S3 | User-confirmed |
| D7 | Test database: CI Postgres service, second Supabase project locally | S0 | User-confirmed |
| D8 | 10 MB upload limit | S2 | User-confirmed |
| D9 | Export: sheet 1 grid, sheet 2 pair list | S5 | User-confirmed |
| D10 | Prime `ai_cache`; seed flag loads a pre-extracted LCCAP | S6 | User-confirmed |
| D11 | Data lane picks the second CCC conflict pair | S1 | Delegated to the data lane (master spec AC-39) |
| D12 | Overlapping findings allowed; citing an unsent page ID is invalid output | S4, S5 | User-confirmed |
| D13 | Scanned PDF: extract anyway, panel shows "No text on this page" | S2 | User-confirmed |

## Roadmap rules

The rules are master spec section 3 (SH-01 to SH-09). This roadmap names them RS-01 to RS-09, same numbers, same text; read them there. Slice specs cite the RS ID.

| RS | Master spec rule |
|---|---|
| RS-01 | SH-01 States |
| RS-02 | SH-02 Way back |
| RS-03 | SH-03 Synthetic label |
| RS-04 | SH-04 AI suggestion label |
| RS-05 | SH-05 Source panel |
| RS-06 | SH-06 Destructive actions |
| RS-07 | SH-07 Keyboard and names |
| RS-08 | SH-08 No blame |
| RS-09 | SH-09 AI calls through `api/app/llm.py` |

## Journeys

Full steps: [master spec section 1](plantrace-spec.md#acceptance-journey-the-demo-journey).

| J | Step | Completed by |
|---|---|---|
| J1 | Plans list shows 4 confirmed plans and the synthetic label | S1 |
| J2 | Live LCCAP upload reaches "ready to confirm" with 3 PPAs | S2 |
| J3 | Fix a field, confirm the plan | S3 |
| J4 | Run checks: 8 findings | S5 (needs S4's 6 plus S5's 2 CCC conflicts) |
| J5 | Drainage duplicate side by side | S4 |
| J6 | Accept the orphan's suggested parent | S4 |
| J7 | Barangay 9: zone conflict and CCC Conflict | S5 (zone part from S4) |
| J8 | Matrix cell shows C with reason | S5 |
| J9 | Export `.xlsx` | S5 |
| J1–J9 | Whole journey with providers unreachable | S6 |

## Slices

**Current slice:** S0. Tickets: GitHub Issues on Hanseooo/PlanTrace (none yet).

| ID | Outcome | Master spec scope | Depends on | Status | Spec |
|---|---|---|---|---|---|
| S0 | Walking skeleton: the deployed app shows every journey screen on `seed/fixtures/`, every endpoint in ARCHITECTURE.md's API table answers, CI runs typecheck, lint, unit tests and the demo smoke | AGENTS.md "Parallel work", RS-01 to RS-03 shells, D3 sector list in the contract, D7 | — | Outline | — |
| S1 | Seeded demo city: one command loads CLUP, CDP, LDRRMP and AIP as confirmed; answer key and the LCCAP PDF exist | US-06 AC-37 to AC-40, D11 | S0 | Outline | — |
| S2 | Upload and extract: a PDF becomes a plan with draft PPAs (and zones for a CLUP), with failure and retry. Ships `llm.py` (cache, Gemini, OpenRouter) first, since S4 and S5 call it | US-01 AC-01 to AC-09, RS-09, D1, D2, D8, D13 | S0 | Outline | — |
| S3 | Confirm the PPA table: edit, add, delete, source panel, confirm | US-02 AC-10 to AC-16, RS-05, RS-06, D6 | S0 | Outline | — |
| S4 | Checks and review for duplicate, orphan and zone: run, findings list, side-by-side, confirm, reject, note, accept parent | US-03 AC-17 to AC-19, AC-21 to AC-24; US-04 AC-26 to AC-31; D4, D5, D12 | S0; S2's `llm.py` for orphan suggestions; S1's answer key for its tests | Outline | — |
| S5 | CCC pairs, matrix and export | US-03 AC-20, AC-25; US-05 AC-32 to AC-36; D9, D12 | S4's run endpoint and findings list; S2's `llm.py` | Outline | — |
| S6 | Demo resilience: the whole journey replays from `ai_cache`, with the J2 fallback | US-06 AC-41, D10 | S2, S4, S5 | Outline | — |

**Parallel start after S0** (lane owners from ARCHITECTURE.md): data lane on S1; AI lane on S2's `llm.py` and extraction, then S4 and S5 check logic; web lane on S3's table, then S4's findings screen and S5's matrix. S4 and S5 can be specced while S2 is built; their code waits only on the dependencies above.

## Uncertainty and next step

| Open | Blocks | Next evidence |
|---|---|---|
| Real CCC sheet layout and meaning | S5's export layout only (contained in `ccc_export.py`) | Mentor shows a real sheet |
| Whether `api/app/plans/` stays in the data lane | S3 ticket lanes | Team decides at ticket 01 (ARCHITECTURE.md) |
| Move the duplicate and zone SQL checks from the AI lane to the data lane, to unload the AI lane | S4 ticket lanes | Team decides before S4 tickets (lane change in ARCHITECTURE.md) |

**Next:** write S0's spec with your spec skill (`/han-to-spec`) and break it into tickets. S1 to S3 specs can be written in parallel by their lane owners while S0 is built.

## Changes

- 2026-11-14: Created from the PRD and the master spec, which keeps the detailed behavior. Slices follow the master spec's US groups; US-03 is split between S4 (rule and orphan checks) and S5 (CCC) so the CCC work, the part with the most unknowns, can move on its own.
- 2026-11-14: Team confirmed D1 to D13 as recommended. Master spec marked Ready.
