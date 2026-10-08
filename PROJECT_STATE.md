# PROJECT_STATE.md

## Current Phase
REPAIR — fixing the product one vertical slice at a time. Plan: `REPAIR_PLAN.md`.

## Active Task
Combined Slice 6 & 7 complete: Documents and Relational tabs unified in the classic studio.
- Relational workspace: Table switcher, relationship map, integrity badges (zero orphan FKs, PK uniqueness, DAG verification), candidate FK configuration, paged multi-table preview.
- Documents workspace: Invoices & bank statements generated with guaranteed reconciliation invariants, visual cards, PDF/ZIP/CSV/JSON export.
- Retired /v2 route and redundant v2 panel components.

## Baseline
- Frontend: `npx tsc --noEmit` passes with 0 errors.
- Backend: `pytest` passes with 159 passed, 1 skipped, 0 failures.
- Unified studio workspace verified: Tabular (Preview, Schema & Privacy, Quality), Relational (multi-table DAG), and Documents (invoices & bank statements).
- Repo: https://github.com/Umer-Hayatt/Synthetic-Data-generator-studio (branch `main`).


## Decisions
- Work in vertical slices; finish, verify and commit one before starting the next.
- TSTR is removed from the product entirely. Statistical quality evaluation stays.
- Classic studio becomes the single workspace: Tabular, AI generator, Documents, Relational.
- AI generator works from the prompt alone, never requires a file.
- Honor user-requested row counts; reject invalid ones instead of silently rewriting them.

## Known open issues (not in the active slice)
- Render deploy crashed on missing module `app.models.relational_rules` (likely uncommitted)
  and used Python 3.14.3 instead of 3.12.10. Deferred (S0 skipped).
- Prompt-to-spec offline & failure path returns deterministic rule-based draft with safe reason code (`no_key`, `rate_limited`, `auth_failed`, `timeout`, `invalid_output`) and helpful note, never mentions uploading a file or manual schema.
- Untracked scratch files: `backend/_baseline.py`, `backend/_check.py`, `qa/`.
