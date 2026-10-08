# PROJECT_STATE.md

## Current Phase
REPAIR — fixing the product one vertical slice at a time. Plan: `REPAIR_PLAN.md`.

## Active Task
S5 complete (AI generator in classic studio tabular, prompt-driven, fallback and 10 domain tests, test_intelligence.py passing). S4 complete (link to /v2 hidden). Next: S6 — Documents tab in the classic studio.

## Baseline
- Frontend: `npx tsc --noEmit` passes with 0 errors.
- Backend: `pytest` passes with 133 passed, 1 skipped, 5 failed (exact 5 known baseline failures from job sanitization, locale and email collision tests scheduled for S7).
- Classic studio workflow verified: upload/ingest or AI prompt -> generate -> preview -> quality -> export (CSV/JSON) all functional.
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
