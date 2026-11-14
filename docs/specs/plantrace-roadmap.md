> [README](../../README.md) / Roadmap

# PlanTrace slice roadmap

2026-11-14. **Status: Active.** Decisions D1 to D13 confirmed by the team on 2026-11-14 (D13 replaced 2026-11-15 by S2-12). Current slice: S4.

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
| D13 | Replaced 2026-11-15 by S2-12 (#17, grilling Q1): the model reads page text, so a PDF with no text fails with "No text found. Scanned PDFs aren't supported." | S2 | Replaced |

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

**Current slice:** S4. Tickets: GitHub Issues on Hanseooo/PlanTrace. S0 ([#1](https://github.com/Hanseooo/PlanTrace/issues/1)), S1 ([#10](https://github.com/Hanseooo/PlanTrace/issues/10)), S2 ([#17](https://github.com/Hanseooo/PlanTrace/issues/17)) and S3 ([#27](https://github.com/Hanseooo/PlanTrace/issues/27)) are Complete; S1's answer key is ready for S4's tests, S2's `llm.py` for S4 and S5, and S3's source panel, AlertDialog and PPA table for S4's findings screen.

| ID | Outcome | Master spec scope | Depends on | Status | Spec |
|---|---|---|---|---|---|
| S0 | Walking skeleton: the deployed app shows every journey screen on `seed/fixtures/`, every endpoint in ARCHITECTURE.md's API table answers, CI runs typecheck, lint, unit tests and the demo smoke | AGENTS.md "Parallel work", RS-01 to RS-03 shells, D3 sector list in the contract, D7 | — | Complete | [#1](https://github.com/Hanseooo/PlanTrace/issues/1); PR [#8](https://github.com/Hanseooo/PlanTrace/pull/8); [CI green](https://github.com/Hanseooo/PlanTrace/actions/runs/43611755202); deployed smoke passed 2026-11-15 on https://plan-trace-gov.vercel.app with api https://plantrace-2a39.onrender.com |
| S1 | Seeded demo city: one command loads CLUP, CDP, LDRRMP and AIP as confirmed; answer key and the LCCAP PDF exist | US-06 AC-37 to AC-40, D11 | S0 | Complete | [#10](https://github.com/Hanseooo/PlanTrace/issues/10); tickets [#11](https://github.com/Hanseooo/PlanTrace/issues/11) to [#13](https://github.com/Hanseooo/PlanTrace/issues/13) in PR [#15](https://github.com/Hanseooo/PlanTrace/pull/15) (with the slice review fixes, `/code-review` pass 1 of 2), closeout [#14](https://github.com/Hanseooo/PlanTrace/issues/14); [CI green](https://github.com/Hanseooo/PlanTrace/actions/runs/43620804166), 38 api tests with none skipped; S1-12: the deployed smoke went red on J1 against the unseeded demo database; seed then run 2026-11-15 on the Supabase demo database, and the deployed smoke passed J1 on https://plan-trace-gov.vercel.app with api https://plantrace-2a39.onrender.com. Accepted findings: `lccap_ppas` in the answer key is a hand copy of `city.json` (a test enforces equality); S1-07's zone-type list omits `industrial` and `commercial`, which S1-07 itself needs; AIP-07 (flood control) links to CDP-09 (evacuation); the page loop appears twice in `seed.py`, and `seed.py` both renders the PDFs and loads the database |
| S2 | Upload and extract: a PDF becomes a plan with draft PPAs, with failure and retry. Ships `llm.py` (cache, Gemini, OpenRouter) first, since S4 and S5 call it | US-01 AC-01 to AC-06, AC-08, AC-09 (AC-07 CLUP zones deferred), RS-09, D1, D2, D8, D13 replaced by S2-12 | S0 | Complete | [#17](https://github.com/Hanseooo/PlanTrace/issues/17); tickets [#18](https://github.com/Hanseooo/PlanTrace/issues/18) to [#20](https://github.com/Hanseooo/PlanTrace/issues/20) and [#22](https://github.com/Hanseooo/PlanTrace/issues/22) in PR [#24](https://github.com/Hanseooo/PlanTrace/pull/24), retry [#21](https://github.com/Hanseooo/PlanTrace/issues/21) in PR [#25](https://github.com/Hanseooo/PlanTrace/pull/25), closeout [#23](https://github.com/Hanseooo/PlanTrace/issues/23); [CI green](https://github.com/Hanseooo/PlanTrace/actions/runs/43628909336) for #24 and [CI green](https://github.com/Hanseooo/PlanTrace/actions/runs/43629686390) for #25 (red first on its 4 new tests: [run](https://github.com/Hanseooo/PlanTrace/actions/runs/43629540826)); `/code-review` pass 1 of 2 over the slice, fixes in c387321 (plain SQL constants, ARCHITECTURE AI row); demo database migrated, seeded and primed with `seed/ai_cache/lccap.json`, the deployed smoke passed J2 2026-11-15 on https://plan-trace-gov.vercel.app with api https://plantrace-2a39.onrender.com, then reseeded and primed again (4 plans). Accepted findings: the cache row shares the extraction's transaction, so a failed PPA insert also drops a valid cache row; broad `except Exception` in `read_pages`, `llm.py` and the background task, each turned into a plan status; the module-level `File` map in `plan-upload.ts` (D2); smells left as is: the 11-field `INSERT_PPA` tuple, the plan query key written three times, `chooseFile` in two pages, thin `apiGet`/`apiPostForm`, `load_cache` importing `barangays` from `routes.py` |
| S3 | Confirm the PPA table: edit, add, delete, source panel, confirm | US-02 AC-10 to AC-14, AC-16 (AC-15 enforced by S4's run query), RS-05, RS-06, D6 | S0 | Complete | [#27](https://github.com/Hanseooo/PlanTrace/issues/27); tickets [#28](https://github.com/Hanseooo/PlanTrace/issues/28) in PR [#35](https://github.com/Hanseooo/PlanTrace/pull/35), [#29](https://github.com/Hanseooo/PlanTrace/issues/29) in PR [#36](https://github.com/Hanseooo/PlanTrace/pull/36), [#30](https://github.com/Hanseooo/PlanTrace/issues/30) in PR [#42](https://github.com/Hanseooo/PlanTrace/pull/42), [#31](https://github.com/Hanseooo/PlanTrace/issues/31) in PR [#43](https://github.com/Hanseooo/PlanTrace/pull/43), [#32](https://github.com/Hanseooo/PlanTrace/issues/32) in PR [#44](https://github.com/Hanseooo/PlanTrace/pull/44), closeout [#33](https://github.com/Hanseooo/PlanTrace/issues/33); `/code-review` pass 1 of 2 over the slice, fixes in PR [#45](https://github.com/Hanseooo/PlanTrace/pull/45) (CSS-escaped blur selector, focus kept after a blur save fails, one save-error slot per cell, source panel closes with its opener row, years 1000 to 9999 on the client, 422 for a non-finite cost, one `ppasKey`, shared SQL column lists), no second pass needed; [CI green](https://github.com/Hanseooo/PlanTrace/actions/runs/43636382817) on `main` (red first on #45's 2 new tests, httpx won't encode NaN: [run](https://github.com/Hanseooo/PlanTrace/actions/runs/43635893794)); the deployed smoke passed J3 2026-11-15 on https://plan-trace-gov.vercel.app with api https://plantrace-2a39.onrender.com, then reseeded and primed again (4 plans). Accepted findings: the barangay editor drops codes not in `/barangays`, unreachable since extraction filters and writes 422 them; `clean_fields` reads the whole barangay list per write, and each distinct `page_id` fetches `GET /pages/{id}` only for "p. N" (`page_no` in `Ppa` would change the contract) |
| S4 | Checks and review for duplicate, orphan and zone: run, findings list, side-by-side, confirm, reject, note, accept parent | US-03 AC-17 to AC-19, AC-21 to AC-24; US-04 AC-26 to AC-31; D4, D5, D12 | S0; S2's `llm.py` for orphan suggestions; S1's answer key for its tests; findings screen on S3's #28 and #30 | Specced | [#34](https://github.com/Hanseooo/PlanTrace/issues/34) |
| S5 | CCC pairs, matrix and export | US-03 AC-20, AC-25; US-05 AC-32 to AC-36; D9, D12 | S4's run endpoint and findings list; S2's `llm.py` | Outline | — |
| S6 | Demo resilience: the whole journey replays from `ai_cache`, with the J2 fallback | US-06 AC-41, D10 | S2, S4, S5 | Outline | — |

**Parallel start after S0** (lane owners from ARCHITECTURE.md): data lane on S1; AI lane on S2's `llm.py` and extraction, then S4 and S5 check logic; web lane on S3's table, then S4's findings screen and S5's matrix. S4 and S5 can be specced while S2 is built; their code waits only on the dependencies above.

## Uncertainty and next step

| Open | Blocks | Next evidence |
|---|---|---|
| Real CCC sheet layout and meaning | S5's export layout only (contained in `ccc_export.py`) | Mentor shows a real sheet |
| Move the duplicate and zone SQL checks from the AI lane to the data lane, to unload the AI lane | S4 ticket lanes | Decided in S4 grilling Q4 (2026-11-15): split `checks/` by file, data lane takes `rules.py`, run storage and `PATCH /findings`; team to be told and ARCHITECTURE.md updated in S4's contract PR |

**Next:** S4 tickets #37 to #41, built by one person in parallel with #28 to #32: #37 after #28; #38 after #37; #39 after #38; #40 after #39, #30 and #32; the closeout #41 last.

## Changes

- 2026-11-14: Created from the PRD and the master spec, which keeps the detailed behavior. Slices follow the master spec's US groups; US-03 is split between S4 (rule and orphan checks) and S5 (CCC) so the CCC work, the part with the most unknowns, can move on its own.
- 2026-11-14: Team confirmed D1 to D13 as recommended. Master spec marked Ready.
- 2026-11-14: S0 specced as [#1](https://github.com/Hanseooo/PlanTrace/issues/1). Team decisions: confirmed test seams (demo smoke, endpoint test, migrations on CI Postgres); `/chain` and `/ask` get no stubs, so S0's "every endpoint" means the MVP rows; api deploys on Render. Env contract gains `TEST_DATABASE_URL` (D7 guard).
- 2026-11-14: S0 broken into #2 to #7, sub-issues of #1 with native blocking links. #7, the closeout, takes over "ticket 01"'s role as the gate for later slices.
- 2026-11-15: S0 Complete. #2 to #6 merged in PR #8, CI green, deployed smoke green on Vercel and Render, demo database migrated (#7). Accepted open findings from the final review: the export link shows `undefined/ccc/export` when `NEXT_PUBLIC_API_URL` is unset at build; findings show raw `suggested` (the "AI suggestion" label comes with S3 to S5); "Source pages" shows page IDs (links come with S3); `GET /plans/{id}` stub always returns the CLUP. Gaps for S3: no barangay name endpoint, no page text endpoint, nothing sets `findings.reviewed_at` yet.
- 2026-11-15: S1 specced as [#10](https://github.com/Hanseooo/PlanTrace/issues/10). Grilling: one `seed/city.json` source renders the PDFs with PyMuPDF and loads the DB; the seed always resets every table except `ai_cache`; D11 pair chosen; a seed pytest guards the answer key. S1 also makes `GET /plans` real, since S1 completes J1.
- 2026-11-15: S1 broken into #11 to #14, sub-issues of #10 with native blocking links. #11 and #12 to Aaeyron, #13 to katto-1204, #14 (closeout, human) to Hanseooo. Ticket PRs are reviewed and merged by Hanseooo, not self-merged.
- 2026-11-15: S2 specced as [#17](https://github.com/Hanseooo/PlanTrace/issues/17). Grilling: the model reads page text with page markers, not the PDF, so D13 is replaced (scanned PDFs fail with a message); the barangay list goes in the prompt so LCCAP-01 maps to `1199900012`; status and Retry live on `/plans/[id]`; new `POST /plans/{id}/retry` (contract); title derived from type and period; AC-07 (CLUP zones) deferred; S2 makes the two plan read routes real; 90 s timeout per provider. Edge cases: only valid output is cached, the cache key ignores the answering provider, a committed real LCCAP response primes CI, the api fails stuck `extracting` plans on startup. Team to be told about D13, AC-07, retry, LangChain and the startup hook before the contract PR merges.
- 2026-11-15: S2 broken into #18 to #23, sub-issues of #17 with native blocking links: #18 `llm.py`, #19 contract and plan reads, #20 upload and extraction, #21 retry endpoint, #22 web form, status and Retry, #23 closeout (human). No owners assigned. Ticket PRs are reviewed and merged by Hanseooo.
- 2026-11-15: S3 specced as [#27](https://github.com/Hanseooo/PlanTrace/issues/27). Grilling: new `GET /barangays` and `GET /pages/{id}` (contract); a "p. N" button opens a source panel that doesn't block the table, shared with S4 and S5; delete asks for confirmation; rows added to a confirmed plan start confirmed (D6); Base UI Combobox for barangays; saving shows a pending state, no optimistic update. S3 runs in parallel with S4; S4's findings screen waits only on S3's contract ticket.
- 2026-11-15: S3 broken into #28 to #33, sub-issues of #27 with native blocking links: #28 contract (`GET /barangays`, `GET /pages/{id}`), #29 PPA writes and confirm, #30 shared source panel and JSON helpers, #31 editable cells, #32 add, delete and confirm, #33 closeout (human). No owners assigned.
- 2026-11-15: S4 grilled, all recommendations accepted. Q1 migration 002 `check_runs` plus `GET /checks/latest` (contract) so AC-30/AC-31 survive a reload; Q2 the suggested parent lives only in `finding.ppa_b`, Accept (PATCH `confirmed` on an orphan) upserts a confirmed `ai` link, Reject rejects the finding only (D4 wording changes, behavior doesn't; tell the team), a failed or out-of-list AI answer still saves the orphan without a parent; Q3 Reject uses S3's AlertDialog; Q4 `checks/` split by file between data and AI lanes; Q5 `POST /checks/run` is synchronous. Rules: duplicate threshold 0.4 (seed pairs: 0.84, 0.67, 0.53 vs best other 0.22, inferred from a Python pg_trgm emulation, a test confirms); the orphan prompt names PPAs by code so the cache survives a reseed; re-run replaces findings and carries status, note and `reviewed_at` from a match under D5 (orphans match on `ppa_a`), note always carried; group by first shared barangay or the zone's barangay. S4 backend needs nothing from S3; the findings screen waits on #28 and #30.
- 2026-11-15: S4 specced as [#34](https://github.com/Hanseooo/PlanTrace/issues/34). Added while writing: `findings.barangay` in migration 002 (a zone finding's barangay isn't otherwise in the payload); Reject on an accepted orphan rejects its link (D4); `load_cache` also primes the orphan answers from `seed/ai_cache/orphans.json`, so J6 works in CI and on the demo database without a key. S4 completes J5 and J6, J4 at 6 of 8, J7's zone half. Its closeout runs after S3's J3.
- 2026-11-15: S4 broken into #37 to #41, sub-issues of #34 with native blocking links: #37 contract (after #28), #38 duplicate and zone run with storage, #39 orphan with AI parent and cache priming (human captures `orphans.json`), #40 findings screen and smoke (after #30 and #32), #41 closeout (human). One builder, in parallel with S3's #28 to #32.
- 2026-11-15: S3 Complete. #28 to #32 merged in PRs #35, #36 and #42 to #44; slice review pass 1 fixed in #45; CI green on `main`; deployed smoke passed J3, demo database reseeded and primed (#33). Closed the open row "Whether `api/app/plans/` stays in the data lane": it does, as ARCHITECTURE.md records (team decision on #1); S3's writes shipped there as lane:data. Current slice moves to S4.
