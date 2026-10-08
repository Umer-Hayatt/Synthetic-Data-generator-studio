# PROJECT_STATE.md

## Current Phase
REPAIR — fixing the product one vertical slice at a time. Plan: `REPAIR_PLAN.md`.

## Active Task
S8 complete: one active input with consistent output lifecycle.
- S8-S12 and the seven owner decisions are recorded in `REPAIR_PLAN.md`.
- Next slice: S9, analyze and normalize the full generated tabular snapshot.
- Source identity/prompt, revisions and snapshot ownership are retained. New input,
  model edits and regeneration clear old outputs and ignore superseded responses.
- Normal relational/document actions use the current spec, never load fixed demos.
  Explicit demos remain on the entry screen. S1-S7 remain completed milestones.
- Relational normalizes the full generated tabular snapshot after user review;
  unclear relationships trigger questions. Documents use the same resulting rows.
- Scope: current upload/prompt flow, invoices/statements, required-field mapping;
  requested counts apply to the named main entity with related counts reviewed.
- Audit found prompt drafts truncated to one table, no upload relationship planner,
  and document actions replacing the active input with demo specifications.
- Verification: backend 159 passed / 1 skipped; 10 React lifecycle tests passed;
  frontend type check and production build passed. Browser verified banking demo,
  seed invalidation and switching to customer-churn sample without stale documents.
- Local backend: 127.0.0.1:8000; built frontend: localhost:3000 (configured CORS origin).

## Last Completed Milestone
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
