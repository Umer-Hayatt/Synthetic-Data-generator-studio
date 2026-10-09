# PROJECT_STATE.md

## Current Phase
REPAIR — fixing the product one vertical slice at a time. Plan: `REPAIR_PLAN.md`.

## Active Task
S9B DONE: empty AI drafts are rejected before accepting a schema response.
- Owner-requested fix before S10: required tables/columns, names and types are
  validated inside the provider/router boundary so alternate-model routing runs.
- S9A-S9B are complete locally; S9B push awaits explicit owner approval.
  S10 and document suitability/rendering (S11-S12) remain pending.
- AI owns discovering, selecting and applying the model from generated snapshot
  metadata, prompt intent and full-row dependency counts. No manual map is required.
- Validation rejects conflicting/missing fields and cycles, provides AI correction
  feedback, then checks exact reconstruction before atomic publication.
- Valid single-table data gets an AI explanation. Provider failure is retryable,
  never a successful no-relation verdict or a fabricated model.
- Current input identity, revision, original prompt and snapshot ownership remain
  guarded against stale responses. New input/model edits/regeneration clear outputs.
- Original generated rows remain authoritative. Relations never independently
  regenerate values or silently load a fixed demo. Explicit entry demos remain.
- Normalized tables support full exports and actual pagination; detailed links
  and data checks are collapsed. Document repairs remain pending.
- Local AI: gemini-3.8-flash with verified gemini-3.5-flash failover, low thinking,
  120-second attempt limit and 180-second total budget (including retries/queue).
  SDK 504 is classified as timeout; overload/timeouts prefer the alternate model.
  Shared quota cooldown and strict local output validation remain enforced.
- Verification: 205 backend passed / 1 skipped; 15 real React lifecycle tests;
  frontend type check and production build passed. Original five-entity prompt
  -> real AI draft without fallback -> 120 LineItems, 20 Orders, 8 Customers,
  12 Products, 4 Categories. Four nested FKs, unique keys, zero orphans and exact
  reconstruction of all 120 exported source rows; all table previews verified.
- S9A browser baseline: commerce exact rejoin/export/pagination/narrow layout;
  students explained as one table without mapping.
- Local services running: backend 127.0.0.1:8000; frontend localhost:3000.
- Proof artifacts are local in qa/debug/ (synthetic data; not committed).

## Last Completed Milestone
S9B complete (2026-10-09): permissive draft fields accepted empty AI tables and
bypassed model failover. Required provider fields now reject those responses.
The original five-entity prompt passes live generation and automatic AI discovery
with requested counts, four nested links and exact full-row reconstruction.

## Baseline
- Backend: 205 passed, 1 skipped, 0 failures.
- Frontend: 15 React lifecycle tests, type check and production build pass.
- Repo: https://github.com/Umer-Hayatt/Synthetic-Data-generator-studio (main).

## Decisions
- Work in vertical slices; finish, verify and commit one before starting the next.
- Owner's 2026-10-09 decision supersedes the earlier manual relational review flow.
- TSTR is removed; measured statistical quality evaluation remains.
- Classic studio is the single workspace. AI prompting never requires a file.
- Honor requested main-entity counts and retain transaction grain.
- Support current single-table uploads/prompts first. Documents: invoices and
  statements, same snapshot values, required missing fields reviewed (S11-S12).

## Known open issues
- S0 deploy repair remains deferred: missing app.models.relational_rules on Render
  and Python 3.14.3 rather than 3.12.10. No deployment changes in S9A.
- Unrelated untracked scratch files and qa/ remain outside this slice.
- In-app browser automation cannot start due to sandbox setup errors; bundled
  headless Chrome verified the actual browser/API/data flow.

## Blockers
Live AI prompt, generation and nested relationship building passed. Automatic
approval review rejected pushing S9B to origin/main because it requires explicit
authorization for sending source/docs to that remote. Local commit is complete;
await owner approval to push. No workaround attempted.
