# PROJECT_STATE.md

## Current Phase
REPAIR — fixing the product one vertical slice at a time. Plan: `REPAIR_PLAN.md`.

## Active Task
S9 complete: hybrid relationship analysis and lossless normalization.
- S8-S12 and the seven owner decisions are recorded in `REPAIR_PLAN.md`.
- Next slice: S10, compact relational inspection and truthful complete results.
- AI proposes mappings from metadata and retained prompt context. Full-row checks,
  explicit review and exact reconstruction govern normalization.
- Source identity/prompt, revisions and snapshot ownership are retained. New input,
  model edits and regeneration clear old outputs and ignore superseded responses.
- Normal relational/document actions use the current spec, never load fixed demos.
  Explicit demos remain on the entry screen. S1-S7 remain completed milestones.
- Relational normalizes the full generated tabular snapshot after user review;
  unclear relationships trigger questions. S11-S12 will assess and render documents
  from the same resulting rows; those repairs remain pending.
- Scope: current upload/prompt flow, invoices/statements, required-field mapping;
  requested counts apply to the named main entity with related counts reviewed.
- Prompt entity intent/counts now survive flattening. Generation preserves
  declared groups and evidenced upload dependencies, including across batches.
- Verification: backend 176 passed / 1 skipped; 13 React lifecycle tests passed;
  frontend type check/build passed. Browser: live AI -> 40 enrollments, 10 students,
  5 courses -> accepted exact split; 60-row commerce upload/rejoin/export verified.
- Local Gemini model updated to gemini-3.8-flash after the old model returned 404.
  Provider-compatible suggestion schema and strict local validation verified live;
  unavailable AI uses input-specific checked hints/mappings with visible status.
- Local backend: 127.0.0.1:8000; built frontend: localhost:3000 (configured CORS origin).

## Last Completed Milestone
S9 complete (2026-10-09): proposals and normalized tables derive from the active
generated snapshot, with review, full-data evidence and exact duplicate-preserving
reconstruction. Existing regression fixtures are now self-contained backend tests.

## Baseline
- Frontend: `npx tsc --noEmit` passes with 0 errors.
- Backend: `pytest` passes with 176 passed, 1 skipped, 0 failures.
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
