# PROJECT_STATE.md

## Current Phase
REPAIR — fixing the product one vertical slice at a time. Plan: `REPAIR_PLAN.md`.

## Active Task
S9A DONE: automatic AI relationship building and resilient provider requests.
- Next slice is S10 (compact relational inspection and linked-record navigation).
  Stop after committing S9A; document suitability/rendering remains S11-S12.
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
- Verification: 195 backend passed / 1 skipped; 15 real React lifecycle tests;
  frontend type check and production build passed. Live browser: 60 commerce rows
  -> 5 buyers + 10 products, exact full export/rejoin equality, pagination and
  narrow layout. Students -> explained single-table model, no mapping required.
- Local services running: backend 127.0.0.1:8000; frontend localhost:3000.
- Proof artifacts are local in qa/debug/ (synthetic data; not committed).

## Last Completed Milestone
S9A complete (2026-10-09): AI chooses the relational model automatically, validates
all rows and preserves source values/duplicates. Resolved the live verification
blocker with supported thinking settings, deadline budgets and model failover.

## Baseline
- Backend: 195 passed, 1 skipped, 0 failures.
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
None for S9A. The previous provider 503/504 blocker is resolved for the verified
flows; both live browser models returned AI available with validated results.
