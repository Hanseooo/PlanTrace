> [README](../../README.md) / Master spec

# PlanTrace master spec

2026-11-14. **Status: Draft.** Decisions D1 to D13 below are open. Criteria marked *(pending Dn)* follow the recommendation and change only if the team picks another option. When all are settled, this becomes Ready.

Sources: [PRD.md](../../PRD.md) (product, demo script, data), [ARCHITECTURE.md](../../ARCHITECTURE.md) (structure, contract, data model, API), [CODING_STANDARDS.md](../../CODING_STANDARDS.md) (how code is written), [AGENTS.md](../../AGENTS.md) (process, freeze). This spec does not repeat their content. It states what must be observably true.

Nothing is built yet. Every criterion below describes agreed behavior, not existing behavior.

## 1. Purpose and scope

**Problem.** A city's plans (CLUP, CDP, LDIP, AIP, LDRRMP, LCCAP) should connect, but offices often write them separately. Planners find duplicates, orphan projects and clashes by hand, including the pair-by-pair CCC test.

**Solution.** The planner uploads plans, the AI extracts every PPA into one table, the planner confirms it, and the tool runs 4 checks: duplicate, orphan, CCC pairs, zone conflict. Every finding shows a reason and the source page, and a person confirms or rejects it.

**User.** CPDO staff in one city in Davao Region. Named example: Mati City. The demo city is the fictional City of Sampaguita, labelled synthetic.

**Included:** F1 upload and extract, F2 confirm the PPA table, F3 checks, F4 findings review, F5 CCC matrix and Excel export, and the seeded demo data.

**Excluded from this spec:**
- Deferred (PRD section 5, start only if the demo smoke passes on the deployed `main` before 04:30): source page images, F6 plan chain view, F7 Ask the records. `/chain` and `/ask` exist in the contract only.
- Out of MVP (PRD section 5): login and roles, handover interview, public page, offline mode, local languages, cross-LGU view, GIS maps, other LDIP matrices, LangGraph.
- Check 1's optional AI "same project?" pass for borderline pairs. Added only if false flags exceed the target.
- The by-hand vs tool CCC timing. It is measured by a person and shown in the pitch, not in the app.
- Concurrent use by several people. The demo has one presenter.

### Acceptance journey (the demo journey)

Preconditions: the deployed app, the seed loaded (US-06), and the LCCAP extraction already in `ai_cache`.

| Step | Presenter does | Observable result |
|---|---|---|
| J1 | Opens the app | The plans list shows CLUP, CDP, LDRRMP and AIP as confirmed, and the synthetic data label |
| J2 | Uploads the LCCAP excerpt PDF, type LCCAP, with its period | Status goes from uploading to extracting to ready to confirm. The PPA table shows 3 PPAs |
| J3 | Fixes 1 field in one row and confirms the plan | The edit is saved and the plan shows as confirmed |
| J4 | Runs checks | 8 findings appear: 3 duplicates, 2 orphans, 1 zone conflict, 2 CCC conflicts |
| J5 | Opens the drainage duplicate | Side by side: "Drainage improvement, Barangay 5", CDP ₱12M 2027 vs LDRRMP ₱9.5M 2028, with the cost and year differences and both source pages |
| J6 | Opens an AIP road orphan and accepts the suggested parent | The suggestion "Farm-to-market roads program" shows with a reason. After accepting, the finding shows as confirmed |
| J7 | Opens the Barangay 9 findings | A zone conflict (CDP housing in a high flood susceptibility zone) and a CCC Conflict (CDP housing vs LDRRMP evacuation centre), each with reason and source pages |
| J8 | Opens the CCC matrix and clicks the housing × evacuation centre cell | The cell shows C. Its reason and sources open |
| J9 | Exports the matrix | An `.xlsx` file downloads and opens with the same grid |

Fallback for J2: if the live upload fails, the presenter opens the pre-extracted LCCAP copy and continues from J3 *(pending D10)*.

## 2. User stories and acceptance criteria

### US-01 Upload a plan and get its PPAs extracted (F1)

As a planner, I want to upload a plan and get its PPAs as a table, so that I don't retype them.

Applies: SH-01, SH-02, SH-03, SH-07, SH-09

- **AC-01** The upload form takes one file, a plan type (CLUP, CDP, LDIP, AIP, LDRRMP, LCCAP, Other) and a period (start and end year). Submit is disabled until all three are set.
- **AC-02** Accepted files: PDF only, up to 10 MB *(pending D1, D8)*. Any other file type or a larger file is refused before upload, with a message naming the limit. The form keeps its other values.
- **AC-03** On submit the plan appears with status "uploading", then "extracting". Extraction keeps running if the planner leaves the screen. The plans list shows the current status.
- **AC-04** When extraction succeeds the status becomes "ready to confirm" and the plan's PPA table opens with draft rows.
- **AC-05** Each extracted PPA has title, description, office, sector, barangays, cost, start year, end year and source page. Missing values are blank, not invented.
- **AC-06** Every page's text is stored with its page number. The uploaded file is not kept.
- **AC-07** A CLUP upload also extracts zones: barangay, zone type, hazard, and forbidden sectors, each with its source page.
- **AC-08** If Gemini fails, the same request goes to OpenRouter without any action from the planner.
- **AC-09** If both providers fail, time out or return invalid JSON, the status becomes "failed" with a message saying which. A Retry button resends the same file *(pending D2)*.

### US-02 Review and confirm the PPA table (F2)

As a planner, I want to correct the extracted rows and confirm them, so that checks run only on data I trust.

Applies: SH-01, SH-02, SH-03, SH-05, SH-06, SH-07

- **AC-10** Every field of a row can be edited in place. Enter or leaving the cell saves the edit. Escape cancels the edit and restores the value.
- **AC-11** Sector is a dropdown from the fixed sector list *(pending D3)*. Barangays is a multi-select from the city's barangays, stored as PSGC codes. Cost and years accept numbers only.
- **AC-12** The planner can add a blank row and delete a row. Delete asks for confirmation or offers undo.
- **AC-13** Selecting a row opens the source panel with that page's text and page number. Escape or a close button closes it and focus returns to the row.
- **AC-14** "Confirm plan" marks the plan and all its rows confirmed. It is disabled while the plan has no rows.
- **AC-15** Only confirmed PPAs go into checks.
- **AC-16** A confirmed plan stays editable. Edits take effect on the next check run *(pending D6)*.

### US-03 Run the checks (F3)

As a planner, I want to run all checks on the confirmed plans, so that I see every inconsistency in one pass.

Applies: SH-01, SH-03, SH-04, SH-08, SH-09

- **AC-17** "Run checks" runs all 4 checks on all confirmed PPAs. The button is disabled while a run is in progress.
- **AC-18** **Duplicate:** a pair of PPAs from different plans with similar titles (trigram similarity above a set threshold) and a shared barangay or sector. The finding shows the differences in cost and years. PPAs in the same plan are never paired.
- **AC-19** **Orphan:** an AIP PPA with no confirmed parent link to a CDP or LDIP PPA. The finding carries the AI's suggested parent and a reason.
- **AC-20** **CCC:** candidate pairs share a barangay, or the same sector, with overlapping years. The AI returns Conflict, Compatible or Complementary, a reason, and the page IDs it used. Pairs that don't meet the filter aren't sent.
- **AC-21** **Zone conflict:** a PPA whose barangay lies in a CLUP zone that forbids the PPA's sector *(pending D3)*. No AI.
- **AC-22** Every finding stores a reason and at least one source page ID. Rule findings start as `suggested` like AI findings.
- **AC-23** The run result reports, for each check, the number of pairs or PPAs checked and the number of findings.
- **AC-24** On a re-run, confirmed and rejected findings keep their status when neither PPA has changed since the review. Otherwise they come back as `suggested` *(pending D5)*.
- **AC-25** A CCC result counts as a finding in the list only when its verdict is Conflict. Compatible and Complementary results appear only in the matrix. This follows from the PRD's count of 8 findings.

### US-04 Review findings (F4)

As a planner, I want to see each finding with both PPAs and their sources, and decide on it, so that only issues I've checked go to the LDC.

Applies: SH-01, SH-02, SH-03, SH-04, SH-05, SH-06, SH-07, SH-08

- **AC-26** Findings are grouped by check. Within a check they are grouped by barangay.
- **AC-27** Opening a finding shows both PPAs side by side (plan, title, office, barangays, cost, years), the reason, and the source pages as links that open the source panel.
- **AC-28** Actions on each finding: Confirm, Reject, Add note. The new status shows at once. Reject asks for confirmation or offers undo.
- **AC-29** An orphan finding has "Accept parent" and "Reject". Accepting confirms the parent link and the finding. Rejecting rejects both *(pending D4)*.
- **AC-30** A check with no findings shows "No issues found for this check" with the number of pairs checked from AC-23.
- **AC-31** Before any run, the findings screen shows that checks haven't been run, with a Run checks button.

### US-05 CCC matrix and export (F5)

As a planner, I want the CCC test pre-filled as a matrix I can export, so that I can review and file it instead of filling it by hand.

Applies: SH-01, SH-02, SH-03, SH-04, SH-05, SH-07

- **AC-32** The matrix has one row and one column per confirmed PPA, labelled with plan and title.
- **AC-33** Each cell shows C (Conflict), Cm (Compatible) or Cp (Complementary), or is blank if the pair wasn't a candidate. A rejected verdict shows blank. A suggested verdict is marked "AI suggestion" *(pending D9)*.
- **AC-34** Clicking a cell, or pressing Enter on a focused cell, opens its reason and sources. Escape closes it and focus returns to the cell.
- **AC-35** Export downloads an `.xlsx` with the same grid *(pending D9 for extra sheets)*. The layout lives only in `api/app/checks/ccc_export.py`.
- **AC-36** Before any run, the matrix screen shows that checks haven't been run, with a Run checks button.

### US-06 Demo data and resilience

As the presenter, I want the demo city pre-loaded and every AI call cached, so that the demo works even if a provider or the venue Wi-Fi fails.

Applies: SH-03, SH-09

- **AC-37** One seed command loads the fictional City of Sampaguita: CLUP (12 barangays and zones), CDP, LDRRMP and AIP, all confirmed, with the planted issues in PRD section 8. The LCCAP excerpt is a PDF for the live upload, not seeded.
- **AC-38** All names are fictional ("Barangay 1" to "Barangay 12" or fictional names). No real barangays, people or offices' staff.
- **AC-39** `seed/expected_findings.json` lists the 8 planted findings (and the 3 expected LCCAP PPAs), used by the check tests and the extraction measure. The second CCC conflict pair is chosen by the data lane and recorded there (D11).
- **AC-40** Each plan is a 2 to 5 page PDF with real-looking tables.
- **AC-41** Before the demo, every AI call in the journey is in `ai_cache`, so J2 and J4 make no provider call.

## 3. Shared behavior

- **SH-01 States.** Every screen in the journey has a loading state, an empty state with the next action, an error state with a message and a retry, and disabled controls while an action runs.
- **SH-02 Way back.** A top navigation with Plans, Findings and CCC matrix is on every screen. A plan's PPA table has a link back to the plans list. No screen needs the browser's back button.
- **SH-03 Synthetic label.** "Synthetic demo data" is visible on every screen.
- **SH-04 AI suggestion label.** Every finding, verdict or link with status `suggested` shows "AI suggestion" until a person confirms it.
- **SH-05 Source panel.** One side panel shows a page's text and page number, opened from a PPA row, a finding or a matrix cell. Escape or close shuts it and returns focus to where it was opened from.
- **SH-06 Destructive actions.** Deleting a PPA row and rejecting a finding ask for confirmation or offer undo.
- **SH-07 Keyboard and names.** Every control has an accessible name. Enter submits forms and opens the focused item. Escape closes dialogs and panels. Focus order follows the layout.
- **SH-08 No blame.** Reasons and labels describe plans and projects, never a person or office at fault.
- **SH-09 AI calls.** Every model call goes through `api/app/llm.py`: cache first, then Gemini, then OpenRouter. The output is validated against its Pydantic model before use.

## 4. Edge cases

| Case | Expected behavior | Home |
|---|---|---|
| Upload a non-PDF (e.g. `.docx`, `.xlsx`) | Refused before upload with a message | AC-02, D1 |
| Upload over the size limit | Refused before upload with a message naming the limit | AC-02, D8 |
| Upload with type or period missing | Submit disabled | AC-01 |
| PDF with no text layer (scanned) | Undecided: Gemini may still extract PPAs, but the stored page text would be empty | D13 |
| AI times out or returns invalid JSON, both providers | Status failed, message, Retry | AC-09, D2 |
| Planner leaves the screen during extraction | Extraction continues; plans list shows status | AC-03 |
| Page reloaded after a failed upload | Retry can't resend the file; planner picks it again | D2 |
| Extraction returns zero PPAs | Table empty state with Add row; Confirm disabled | AC-14, SH-01 |
| Extracted field missing | Left blank, never invented | AC-05 |
| Escape while editing a cell | Edit cancelled, value restored | AC-10 |
| Delete a row by mistake | Confirm or undo | AC-12, SH-06 |
| Edit a PPA in a confirmed plan | Allowed; affects next run | AC-16, D6 |
| Run checks with no confirmed plans | Each check shows 0 checked and the empty state | AC-23, AC-30 |
| Click Run checks twice | Button disabled during a run | AC-17 |
| Same project twice in one plan | Not a duplicate finding | AC-18 |
| A pair is both a duplicate and a CCC candidate | Both findings appear, no merging | D12 |
| AIP PPA whose only parent link is rejected | Counts as an orphan | AC-19 |
| AI cites a page ID it wasn't sent | Treated as invalid output; finding not saved | SH-09, D12 |
| Re-run after a finding was rejected | Stays rejected unless a PPA changed | AC-24, D5 |
| No findings for a check | "No issues found for this check" with count | AC-30 |
| Matrix before any run | Not-run state with Run checks | AC-36 |
| Rejected CCC verdict | Blank cell | AC-33 |
| Export with no CCC results | Downloads an empty grid with headers | D9 |
| Provider down during demo | Cache hit, no provider call | AC-41 |
| Shared database used by tests and demo | Tests don't write to the demo data | D7 |

## 5. Design decisions and rationale

Structure, folders, contract, data model and API are in [ARCHITECTURE.md](../../ARCHITECTURE.md). Abstraction and code rules are in [CODING_STANDARDS.md](../../CODING_STANDARDS.md). Feature-specific decisions only:

- **Scope cut to F1 to F5** because the build window is about 9 hours for 3 people. The community scene (J7) carries the demo (grill Q1).
- **Page text, not page images, in the source panel** because citations need page numbers, not layout, and Render's free disk doesn't persist (inferred). Page images are deferred item 1 (grill Q8).
- **Background extraction with polling** so a long AI call can't time out the live upload (grill Q5).
- **Stubs serve `seed/fixtures/`** so the web app has one data path from ticket 01 (grill Q7).
- **AI cache in Postgres** so the demo replays offline and teammates share results (grill Q9).
- **CCC findings in the list are Conflicts only** (AC-25), derived from the PRD's count of 8 findings. Rationale inferred: Compatible and Complementary pairs aren't issues to resolve.
- **Run result includes counts per check** (AC-23) because the F4 empty state needs "number of pairs checked". This adds fields to the `/checks/run` response in `api/app/models.py`.
- **Findings grouped by check, then barangay** (AC-26) is this spec's reading of PRD F4's "grouped by check and by barangay".
- **Similarity threshold** for duplicates is tuned against the answer key by the AI lane. Its value isn't fixed here.

## 6. Verification

Required checks (none run yet):

| Seam | Check | Source |
|---|---|---|
| Check logic | pytest runs the 4 checks on the seed and compares with `seed/expected_findings.json`: all 8 found, 2 or fewer false flags. CCC reads AI results from `ai_cache` so it's repeatable | grill Q10, PRD section 4 |
| Extraction | On the seed PDFs, PPA fields match the answer key at 90% or better after the AI pass. Measured once by a person, reported in the pitch | PRD section 4 |
| Parsers and transforms | `/tdd` on AI output → PPA rows, and on the duplicate and candidate-pair SQL | AGENTS.md Testing |
| Demo journey | One Playwright test walks J1 to J9 on the deployed app. Each ticket that changes a journey screen adds its step | AGENTS.md Testing |
| Sources | Every finding in the seed run has at least one page ID | PRD section 4, AC-22 |
| Freeze rehearsal | At 06:29 one person walks J1 to J9 by hand on the deployed app | AGENTS.md |

## 7. Open decisions

Each has a recommendation. Reply "accept all" or pick by number.

| ID | Decision | Blocks | Recommendation |
|---|---|---|---|
| D1 | Excel upload: PRD section 5 lists PDF and Excel, but the journey uses only PDFs, and an Excel file has no pages to cite | AC-02 | PDF only for the MVP. Excel is the first item after the deferred list |
| D2 | Retry without a stored file | AC-09 | The web app keeps the `File` in memory and resends it. After a reload the planner picks the file again |
| D3 | Sector list. Zone check matches forbidden sectors. With broad CDP sectors (social, economic, ...), forbidding "social" in Barangay 9 would also flag the evacuation centre | AC-11, AC-21 | One fixed, specific sector list (e.g. housing, drainage, roads, evacuation, agriculture) defined by the data lane in ticket 01 |
| D4 | What "accept parent" does on an orphan | AC-29 | Accept confirms the link and the finding. Reject rejects both |
| D5 | How "unless the PPAs change" is detected on re-run | AC-24 | Keep a reviewed finding while both PPAs' `updated_at` are older than the review time |
| D6 | Editing a confirmed plan | AC-16 | Stays editable and confirmed; edits count from the next run |
| D7 | Which database pytest uses | Verification | A Postgres service container in CI, and a second free Supabase project for local runs |
| D8 | Upload size limit | AC-02 | 10 MB |
| D9 | Export contents | AC-33, AC-35 | Sheet 1 is the grid. Sheet 2 lists each pair with verdict, status, reason and page numbers. Suggested verdicts are marked in both |
| D10 | J2 fallback | Journey | Prime `ai_cache` with the LCCAP upload before the demo. A seed flag loads a pre-extracted LCCAP copy as "ready" if the live upload still fails |
| D11 | The second CCC conflict pair | AC-39 | Data lane picks it while writing the plans and records it in the answer key. Doesn't block other work |
| D12 | Overlapping findings and invalid citations | Edge cases | A pair can have both a duplicate and a CCC finding. An AI result citing a page ID it wasn't sent is treated as invalid output |

| D13 | A scanned PDF with no text layer | Edge cases | Extract anyway; the source panel shows "No text on this page" with the page number. The demo uses text PDFs only |

**Readiness:** Draft. D1 to D10, D12 and D13 change criteria. D11 doesn't block.

## 8. Coverage index

| Source | Home |
|---|---|
| PRD F1 type, period, PPA fields | AC-01, AC-05 |
| PRD F1 page text, file not kept | AC-06 |
| PRD F1 background, polling, statuses | AC-03, AC-04 |
| PRD F1 CLUP zones | AC-07 |
| PRD F1 failure states, retry, fallback | AC-02, AC-08, AC-09, D1, D2, D8 |
| PRD F2 edit, add, delete, confirm, only confirmed checked | AC-10, AC-12, AC-14, AC-15 |
| PRD F2 source page next to row | AC-13, SH-05 |
| PRD F2 dropdowns, PSGC | AC-11, D3 |
| PRD F3 checks 1 to 4 | AC-18 to AC-21 |
| PRD F3 confirm every finding, AI suggestion label | AC-22, SH-04 |
| PRD F3 rejected stay rejected | AC-24, D5 |
| PRD F4 grouping, side by side, actions, empty state | AC-26 to AC-30 |
| PRD F3 orphan accept or reject | AC-29, D4 |
| PRD F5 grid, cell labels, click, export, one module | AC-32 to AC-35, D9 |
| PRD section 4 measures | Verification |
| PRD section 7 demo script | J1 to J9 |
| PRD section 7 fallback | D10 |
| PRD section 8 synthetic data, answer key | AC-37 to AC-40, D11 |
| PRD section 11 no blame, synthetic only | SH-08, AC-38 |
| PRD section 5 deferred and out | Section 1 Excluded |
| AGENTS.md states and way back | SH-01, SH-02 |
| CODING_STANDARDS.md web rules | SH-06, SH-07 |
| Grill Q5, Q7, Q8, Q9, Q10 | Section 5, Verification |
