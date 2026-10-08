# REPAIR_PLAN.md — Active plan (supersedes the V2 work order in TASKS.md)

Rule: one vertical slice at a time. A slice covers backend, frontend, tests and
cleanup for ONE feature. Do not start the next slice until the current one passes
its checks and is committed. Do not touch unrelated features.

## Slice workflow (every slice)
1. Read this file and PROJECT_STATE.md only. Open only the files the slice needs.
2. Delete dead code, files, routes, docs and tests that belong to the slice's feature. No leftovers.
3. Implement the change end to end (API + UI + tests).
4. Verify: backend `pytest`, frontend `npx tsc --noEmit`, and one manual browser run of the slice.
5. Before committing, list any file in the touched area that is no longer imported or referenced anywhere, and delete it. Do not merge or rename modules unless the slice requires it. Update `CODEMAP.md` if files were added, moved, or deleted.
6. Update the status log below and PROJECT_STATE.md, commit "slice N: <name>", push, then STOP and report.

Do not invent requirements. Do not refactor unrelated working code. Never commit secrets.

## Slices

### S0 — Repo hygiene and deploy fix — SKIPPED (deferred by owner)
Not part of the current run. Known pending items, do NOT work on them unless asked:
missing-file deploy crash (app.models.relational_rules), scratch files, Python pin on Render.

### S1 — Remove TSTR completely
- Remove the backend TSTR module, endpoints, schemas and tests; remove the frontend
  TSTR card, target selector, API calls and types. Remove TSTR wording from UI and docs
  (README, REQUIREMENTS, ARCHITECTURE, DESIGN, TASKS).
- Keep statistical quality evaluation intact.
- Done when: `grep -ri tstr` finds nothing in code or UI; pytest and tsc pass; classic studio
  still runs upload/demo -> generate -> preview -> quality -> export.

### S2 — Schema & Privacy summary (classic studio)
Default view shows only:
```
Schema & Privacy
✓ N columns detected
✓ Schema automatically configured
✓ N sensitive fields detected
✓ Privacy protection configured
[ View / Edit Schema ]   [ Privacy Settings ]
```
- Counts come from real inference results, never hardcoded.
- Sensitive fields come from a detector (names, emails, phones, IDs, addresses, etc.).
  If none exists, add a small deterministic one first.
- The two buttons open the existing detail editors (drawer or modal).
- Done when: correct for every demo dataset and an uploaded CSV.

### S3 — Synthetic Quality summary (classic studio)
```
✓ N synthetic rows generated
Quality: NN% <label>      Privacy: Protected      Integrity: Passed
[ View details ]   [ Export ]
```
- Quality % is the existing statistical score; label thresholds live in one place.
- Privacy and Integrity reflect real checks, not static strings.
- View details opens the existing charts. Export keeps CSV/JSON.

### S4 — Hide the link to /v2
- Remove the navigation link to the separate /v2 page now.
- Keep the /v2 route and components until S5-S7 have moved what they need (move, don't copy).
- Delete the /v2 route after S7.

### S5 — AI generator in the classic studio (tabular)
- Placed below the file upload/paste area. Works with NO file; never asks the user to upload one.
- Prompt -> reviewable spec -> generated table, driven only by the prompt.
- Honor requested row counts; reject invalid counts (<=0 or over limit) with a clear error.
  No silent scaling or clamping.
- AI failure or missing key: deterministic rule-based draft or a clear message.
- Fix the 6 failing tests in test_intelligence.py as part of this slice.
- Verify with 10 varied prompts (students, bank, retail, hospital, etc.).

### S6 & S7 — Documents and Relational tabs in classic studio (retired /v2)
- Combined Slice: Both Documents and Relational features fully integrated into the classic studio workspace.
- Documents tab: Invoices and bank statements generated from the studio's data. Visual cards; PDF/ZIP/CSV/JSON export; reconciliation invariants hold.
- Relational tab: Multi-table relational view with table switcher, relationship map, integrity badges (zero orphan FKs, unique PKs, reconciliation), candidate FK configuration, and paged previews.
- Retired /v2: Deleted `pages/v2.tsx` and unused v2 components.
- Verification: Pytest passes (159 passed, 1 skipped), frontend tsc passes with 0 errors.

## Status log
S0 SKIPPED | S1 DONE | S2 DONE | S3 DONE | S4 DONE | S5 DONE | S6+S7 DONE

