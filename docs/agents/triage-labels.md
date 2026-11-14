# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the "Label in our tracker" column to match whatever vocabulary you actually use.

## Lane labels

Every ticket after ticket 01 carries one lane label: the folder it owns (AGENTS.md, Parallel work).

| Label | Owns | Folders |
|---|---|---|
| `lane:web` | Screens: upload, PPA table, findings, CCC matrix | `web/` |
| `lane:ai` | The LLM seam, extraction, checks, CCC export | `api/app/llm.py`, `api/app/extract/`, `api/app/checks/` |
| `lane:data` | Plan list and PPA edits, schema, seed data | `api/app/plans/`, `api/app/db/`, `seed/` |

Folder detail: [ARCHITECTURE.md](../../ARCHITECTURE.md#folders-and-lanes).
