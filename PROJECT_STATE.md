# PROJECT_STATE.md

## Current Phase
REPAIR — fixing the product one vertical slice at a time. Plan: `REPAIR_PLAN.md`.

## Active Task
S1 complete (TSTR removed completely). Next: S2 — Schema & Privacy summary (classic studio).

## Baseline
- Frontend: `npx tsc --noEmit` passes with 0 errors.
- Backend: `pytest` passes with 113 passed, 1 skipped, 11 failed (all 8 TSTR tests removed cleanly; the remaining 11 failures are baseline issues scheduled for S5 and S7).
- Classic studio workflow verified: upload/ingest -> generate -> preview -> quality -> export (CSV/JSON) all functional.
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
- Prompt-to-spec has no deterministic offline fallback (handled in S5).
- Untracked scratch files: `backend/_baseline.py`, `backend/_check.py`, `qa/`.
