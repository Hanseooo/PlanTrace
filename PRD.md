> [README](README.md) / PRD

# PRD: PlanTrace, a plan consistency checker for a city LGU

2026-11-14. Working name; the team can rename it. Labels: **Documented**, **Reported**, **Inference**. This PRD pivots [proposal 2](../ds3-lgu-wiki/decisions/proposals/2-institutional-memory.md), which the mentor approved, toward slide 13 and [problem H](../ds3-lgu-wiki/problems/h-plan-budget-risk.md). Show the pivot to the mentor early.

## 1. Summary

**Problem.** A city has many plans: CLUP, CDP, LDIP, AIP, LDRRMP, LCCAP and more. They should connect, but offices often write them separately. So the same project shows up twice with different costs, AIP projects have no parent in the CDP, and projects clash with each other or with land use and hazard zones. Planners must find these by hand. One required step is the Conflict-Compatibility-Complementarity (CCC) test, which compares projects pair by pair.

**Solution.** Upload the city's plans. The AI extracts every program, project and activity (PPA) into one table, and a planner confirms it. The tool then runs 4 checks: duplicates, orphans, CCC pairs and zone conflicts. Each finding shows a reason and the source page, and a person confirms it. Later (deferred): "Ask the records" answers questions along the plan chain with citations.

**User.** City Planning and Development Office (CPDO) staff in one city LGU in Davao Region (Region XI). Named example: Mati City, Davao Oriental, where the mentor was City Planning and Development Coordinator. This is horizontal scope: across the city's own plans and offices. The mentor advised horizontal first (Reported, from the team).

**Mindanao anchor.** Slide 29 requires a named Mindanao community. The problem is anchored in real Region XI cases (slide 12 Davao Occidental scenario, slide 14 Masara landslide in Davao de Oro). The demo city stays fictional and is labelled synthetic, so no invented plan is passed off as a real LGU's.

**MVP (about 9 hours of building, 3 people).** The hackathon runs 21:44 to 09:29 with code freeze at 06:29. A fictional Davao Region city, 4 plans, about 15 to 20 PPAs with planted issues, AI extraction with one live upload, 4 checks, findings review, and a CCC matrix export. No login. The plan chain view (F6) and Ask the records (F7) are deferred.

## 2. Why this problem

| Claim | Label | Source |
|---|---|---|
| The land use plan is meant to flow into the development plan, then investment plans, then the budget | Documented | [DEval 2018](https://www.deval.org/fileadmin/Redaktion/PDF/05-Publikationen/Policy_Briefs/2018_1_Land_Use_Planning_Philippines/DEval_Policy_Brief_Land_Use_Planning_Philippines_2018_EN.pdf) |
| CDP is the 6-year plan "in accordance to the CLUP"; LDIP implements the CDP with budgets; AIP is the yearly part of the LDIP | Reported (secondary) | [Mandated local plans](https://es.slideshare.net/jobitonio/mandated-local-plans) |
| LDIP PPAs are a subset of CDP PPAs | Reported | [CDP Assessment Tool](https://www.scribd.com/document/421694047/1-CDP-Assessment-Tool-pdf) |
| CDP step 3.3 includes PPAs "from LDRRMP, LCCAP and CLUP if applicable". This is where duplicates can enter | Reported (DILG-linked deck) | [DRR-CCA mainstreaming deck](https://docs.google.com/presentation/d/1obexxFx0ioQBtSAvUcDAMecwmuskjAKq/htmlpresent) |
| The CCC test is one of 4 methods in LDIP Stream 1 to screen and rank PPAs, with the Resource Impact, Urgency and Goal Achievement matrices | Reported (same deck; names the test, does not describe it) | same |
| DILG names "multiplicity of plans" and sectoral plans "prepared independently of the CDP and CLUP" as problems | Reported | [DILG CDP–LDIP deck](https://docs.google.com/presentation/d/1JuEn7WlL6raSEFctQfGicPej-I4n_a4L/htmlpresent), [CDP Quick Guide](https://www.slideshare.net/slideshow/cdp-quick-guide/58211838) |
| The DILG guide tells planners to "take note of inconsistencies between existing plans" | Reported | [problem H](../ds3-lgu-wiki/problems/h-plan-budget-risk.md) |
| Slide 13: plans "must connect to every stage of delivery", or they remain separate documents | Documented (mentor slide) | [slide 13](../ds3-lgu-wiki/slides/10-15-three-major-challenges.md) |
| The challenge requires a real problem in a named Mindanao community | Documented (mentor slide) | [slides 26 to 29](../ds3-lgu-wiki/slides/26-29-requirements-and-challenge.md) |
| How long a CCC test takes by hand | **Unknown** | Ask the mentor. Nobody on the team has done one |

**Why it is bigger than turnover (Inference).** Turnover hurts at specific moments and we have no data on the share of contract staff. Plan inconsistency is named in DILG's own material, hits every planning cycle, and has a required step (CCC) where a tool fits.

## 3. What exists and the gap

| System | What it does | Gap (Inference) |
|---|---|---|
| Climate change expenditure tagging (JMC 2015-01) | Tags climate PPAs in the AIP | Tags single lines; does not compare PPAs or trace them to the CDP or CLUP |
| SubayBAYAN, PrIME | Track national-funded projects | Start after funding; not plan consistency |
| DMS4LGUs | Stores LGU documents (pilots outside Mindanao, 2026) | Stores files; does not read plans or compare them |
| Spreadsheets and consultants | CCC and other matrices by hand | Slow, depends on one person, no trace to source pages |

**The gap.** No tool found reads a city's plans together, links each PPA to its parent and its source page, and flags duplicates, orphans and conflicts before the LDC approves. Check with the mentor whether DILG has a digital CDP or LDIP tool.

## 4. Goals and success measures

**Demo goals**

| Measure | Target |
|---|---|
| Extraction: PPA fields correct on the seed plans (title, office, barangay, sector, cost, years, page) | 90% or better after the AI pass, 100% after the planner confirms |
| Planted issues found: 3 duplicates, 2 orphans, 1 zone conflict, 2 CCC conflict pairs | All 8 found; 2 or fewer false flags |
| CCC time: a teammate fills a 15-PPA CCC matrix by hand vs with the tool | Measure both and show the numbers. Do not claim a saving before measuring |
| Every finding and answer has a source page | 100% |

**Real-world measures (after the hackathon)**
- Share of AIP lines linked to a CDP parent.
- Number of issues found before LDC approval.
- Hours spent on the CCC test per cycle.

## 5. Scope

**In**
1. Upload and extract plans (PDF only; Excel comes first after the deferred list, D1).
2. Confirm the PPA table.
3. Checks: duplicate, orphan, CCC pairs, zone conflict.
4. Findings review: confirm, reject or note.
5. CCC matrix view and Excel export.

**Deferred** (start only if the demo smoke passes on the deployed `main` before 04:30, in this order)
1. Source page images: render each page to PNG at extraction and show it in the source panel.
2. F6 Plan chain view: AIP → LDIP → CDP → CLUP, plus sectoral plans.
3. F7 Ask the records.

**Out (MVP)**
- Login and roles. Next: email login and row-level security per LGU.
- Handover interview. Staff already file a handover document before clearance (Reported, from the team), so it can be uploaded as an ordinary document.
- Public page, offline mode, local languages.
- Cross-LGU view. This is the first stretch item.
- Real maps (GIS). Zones are a lookup table by barangay.
- Resource Impact, Urgency and Goal Achievement matrices.
- LangGraph and multi-step agents.

## 6. Features and acceptance criteria

### F1. Upload and extract

The planner uploads a plan file and picks its type (CLUP, CDP, LDIP, AIP, LDRRMP, LCCAP, Other) and period. The AI reads the file and returns PPAs as structured JSON.

- Each PPA has: title, description, office, sector (fixed list), barangays, cost, start year, end year, source page.
- Each page's text is stored for search and citations (PyMuPDF, one row per page). The uploaded file itself is not kept.
- Extraction runs in the background. The screen polls the plan's status.
- A CLUP upload also extracts zones: barangay, zone type, hazard, and the uses it allows or forbids.
- Failure states: wrong file type, file too large, AI timeout, AI returns invalid JSON. Each shows a message and a retry. Gemini fails → OpenRouter fallback.
- Status per upload: uploading, extracting, ready to confirm, failed.

### F2. Confirm the PPA table

An editable table per plan. The planner fixes fields, deletes rows, adds rows and confirms the plan. Only confirmed PPAs go into checks.

- The source page's text and page number open next to the row.
- Sector and barangay are dropdowns from fixed lists. Barangays use PSGC codes.

### F3. Checks

The planner runs checks on all confirmed plans. Each check makes findings with a reason and source pages.

| Check | Logic | AI role |
|---|---|---|
| 1. Duplicate | PPA pairs from **different** plans with similar titles (`pg_trgm` similarity above a set threshold) and a shared barangay or sector. Shows differences in cost and years | Optional: "same project? yes/no + reason" for borderline pairs |
| 2. Orphan | AIP PPA with no confirmed parent in the CDP (or LDIP). The tool suggests the best parent; the planner accepts or rejects it | Suggests the parent with a reason |
| 3. CCC pairs | Candidate pairs: shared barangay, or same sector, with overlapping years. SQL pre-filter, so not all N² pairs. For each pair the AI returns **Conflict**, **Compatible** or **Complementary**, a reason, and the pages it used | Classifies each pair |
| 4. Zone conflict | PPA barangay matches a CLUP zone or hazard area whose rules forbid the PPA's category (lookup table) | None |

- The person confirms every finding. Unconfirmed findings are labelled "AI suggestion".
- Rejected findings stay rejected on the next run unless the PPAs change.

### F4. Findings review

A list grouped by check and by barangay. Each finding shows both PPAs side by side, the reason and the source pages. Actions: confirm, reject, add a note. Empty state: "No issues found for this check" with the number of pairs checked.

### F5. CCC matrix and export

A grid of PPAs × PPAs. Each cell shows C, Cm or Cp (Conflict, Compatible, Complementary), or blank if the pair was not a candidate. Clicking a cell opens the reason and sources. Export to Excel.

**The real CCC sheet layout is unknown.** The MVP uses the grid above (Inference). Keep the export layout in one module so it can change after the mentor shows a real sheet.

### F6. Plan chain view (deferred)

A graph (React Flow): CLUP zone → CDP program → LDIP → AIP project, with LDRRMP and LCCAP PPAs as side inputs. Orphans and flagged PPAs are coloured. Clicking a node opens the PPA and its findings.

### F7. Ask the records (deferred)

The planner asks a question, for example: "Why is the drainage project in the AIP?" or "Which projects are in Barangay 5 and flood-prone?"

- Retrieval: plan chain links first, then Postgres full-text search on page text.
- The AI answers only from the passages sent, and cites page IDs.
- The server rejects an answer that cites an ID it did not send.
- No passage found → "No source in the records, so no answer."

## 7. Demo script (3 minutes of the pitch)

Fictional **City of Sampaguita, Davao Region**, labelled synthetic on screen. Open by naming the real Region XI context (slide 12 Davao Occidental scenario, slide 14 Masara landslide), then show that a city like Mati could catch the same kind of risk in its plans. 4 plans are pre-loaded and confirmed.

1. Upload a short LCCAP excerpt live. The AI extracts 3 PPAs, the planner fixes 1 field and confirms. (Fallback: pre-extracted copy.)
2. Run checks. 8 findings appear.
3. **Duplicate:** "Drainage improvement, Barangay 5" is in the CDP at ₱12M for 2027 and in the LDRRMP at ₱9.5M for 2028.
4. **Orphan:** an AIP road has no CDP parent. The tool suggests "Farm-to-market roads program"; the planner accepts.
5. **The community scene:** the CDP plans a housing project in Barangay 9. The CLUP marks Barangay 9 as high flood susceptibility, and the LDRRMP plans an evacuation centre there. Zone conflict plus a CCC **Conflict**, caught before money is spent.
6. Open the CCC matrix and export it to Excel. Show the measured time: by hand vs with the tool.

Only if F7 ships: ask "Why is the evacuation centre in the AIP?" The answer cites LDRRMP page 14 and AIP line 22.

## 8. Synthetic data spec

All data is synthetic (slide 26, RA 10173). The city is fictional and placed in Davao Region. Barangays named "Barangay 1" to "Barangay 12", or fictional names, never real barangays, so invented hazard zones cannot be mistaken for real ones. No real people.

| Plan | Content | Planted issues |
|---|---|---|
| CLUP | 12 barangays; zones (residential, agricultural, protected, flood-prone high/moderate) | Barangay 9 high flood susceptibility, no new housing |
| CDP | About 8 programs, 10 PPAs | Housing in Barangay 9; drainage in Barangay 5 (₱12M, 2027) |
| LDRRMP | About 5 PPAs | Drainage in Barangay 5 (₱9.5M, 2028); evacuation centre in Barangay 9 |
| AIP | About 10 lines | 2 lines with no CDP parent; 1 line duplicates an LDRRMP PPA |
| LCCAP excerpt | 3 PPAs, for the live upload | 1 duplicate of a CDP PPA |

Make each plan a short PDF (2 to 5 pages) with real-looking tables, and keep an answer key (`seed/expected_findings.json`) for the measures in section 4.

## 9. Architecture

Moved to [ARCHITECTURE.md](ARCHITECTURE.md): stack, folders and lanes, contract, data model and API. Coding rules are in [CODING_STANDARDS.md](CODING_STANDARDS.md).

## 10. Team plan (about 9 hours of building, 3 people)

Lanes and their folders: [ARCHITECTURE.md](ARCHITECTURE.md#folders-and-lanes). The data lane also owns the pitch. Slice order and what runs in parallel: [roadmap](docs/specs/plantrace-roadmap.md).

| Time | Web (1) | AI and checks (1) | Data, pitch (1) |
|---|---|---|---|
| 21:44 to 23:00 | Ticket 01 together: repo, Next.js, FastAPI stubs serving `seed/fixtures/`, schema, deploy, demo smoke, CI | Same | Write the 4 synthetic plans and the answer key |
| 23:00 to 02:00 | Upload screen, PPA table, findings list | Extraction, fallback, AI cache; checks 1, 2 and 4 | Seed script; pytest for the checks against the answer key |
| 02:00 to 04:30 | CCC matrix, export; loading, empty and error states | CCC pair classifier; tune thresholds, fix false flags | Measure CCC time by hand; pitch and slides |
| 04:30 to 06:29 | Deferred items if the smoke passes; polish | Cache every demo AI call | Demo script; rehearse |
| 06:29 | Code freeze. One person walks the demo on the deployed app | | |
| 06:29 to 09:29 | Fixes only for what the rehearsal breaks | Same | Same |

**Team rules**
- One repo with `web/` and `api/` folders, each with a README of 3 setup commands or fewer.
- `.env.example` is committed, `.env` is not. Share keys privately, use one Gemini key per teammate for development, and keep a separate key for the demo.
- One person owns schema changes.

**Demo fallbacks:** pre-extracted plans, cached check results and answers, and a local Postgres from the seed script.

## 11. Equity and law checks

- **Slide 15 (who is left out).**
  - The tool serves planners, not residents directly. The benefit to residents is fewer conflicting or duplicate projects, for example no housing in a flood-prone barangay.
  - Left out: LGUs whose plans exist only on paper (photo upload is next), and small municipalities without a planner.
  - English UI. Plans are mostly in English (Inference).
- **Slide 26 (law).**
  - RA 10173: plans are public documents, but uploaded handover files may hold names, so store the minimum. The demo uses synthetic data only.
  - The AI suggests and a person decides. Every finding shows its source.
- **No fault attribution (slide 14).** Findings describe plans, not people or offices to blame.

## 12. Risks

| Risk | What we do |
|---|---|
| The CCC layout or meaning differs from our working model | Ask the mentor first. Export lives in one module |
| AI extraction errors on messy PDFs | The planner confirms every row. Demo uses clean synthetic PDFs plus one live upload with a fallback |
| AI invents conflicts | Reason and source page required. A person confirms. Measure false flags against the answer key |
| Judges see it as "just a form filler" | Lead with the community scene, not the matrix |
| Synthetic plans mistaken for a real Davao Region LGU's | Fictional city and barangays, "synthetic data" label on screen |
| About 9 hours is not enough | F6 and F7 deferred; the demo journey is steps 1 to 6 |
| The mentor expected the turnover story | Show the pivot early: same engine (reads plans, cites sources), sharper problem from slide 13 |
| DILG builds a similar tool | Ask the mentor; position as a module that could plug into DILG systems |
| Venue Wi-Fi fails | Cached results, local database backup |
| Free-tier API limits | One key per teammate; cache all demo AI calls |

## 13. Open questions for the mentor

- [ ] Can you show us a real CCC test sheet? What is compared with what, and how is it scored?
- [ ] How long does the CCC test take a city planning office? Who does it, staff or a consultant?
- [ ] Does DILG have a digital CDP or LDIP tool now, or plans for one?
- [ ] Which plan conflicts cause the most trouble in Region XI cities?
- [ ] Are plans kept as PDF, Word, Excel or paper?
- [ ] Would a city or DILG Region XI pilot this, and how would they pay for it?

## 14. Stretch, in order

After the deferred items in section 5:

1. Cross-LGU overlap: a neighbouring city's CDP and one shared flag (proposal 2's overlap finder).
2. Climate tagging check: compare JMC 2015-01 tags in the AIP with LCCAP PPAs.
3. Photo upload for paper plans.
4. Login and row-level security per LGU.
5. A pre-screen model (for example Jev) for cities with hundreds of PPAs.
