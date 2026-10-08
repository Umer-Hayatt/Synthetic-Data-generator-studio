# PROJECT_STATE.md

## Current Phase
REPAIR — fixing the product one vertical slice at a time. Plan: `REPAIR_PLAN.md`.

## Active Task
Prompt-only synthetic table generation complete. Tabular engine creates rows from spec hints alone with cross-column coherence (total=price*qty, start_date<=end_date, email/name coherence), reference-free quality evaluation, deterministic offline fallback across 10 domains, and preview with Edit schema. Next: S6 — Documents tab in the classic studio.

## Baseline
- Frontend: `npx tsc --noEmit` passes with 0 errors.
- Backend: `pytest` passes with 159 passed, 1 skipped, 0 failures (including 13 prompt generation tests).
- Classic studio workflow verified: file upload OR AI prompt -> generate rows -> preview table -> quality summary ("Not applicable (generated from prompt)" without reference) -> export (CSV/JSON).
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
