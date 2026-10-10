# PROJECT_STATE.md

## Current Phase
REPAIR — fixing the product one vertical slice at a time. Plan: `REPAIR_PLAN.md`.

## Active Task
S9D DONE: explicit AI generation count now precedes related entity counts.
- Browser/parser repro requested 40 university enrollments with 10 students and
  5 courses but generated 10 rows. Generation-count precedence and the qualified
  enrollment fallback now preserve 40/10/5, including offline drafts.
- Verified: 218 backend / 1 skipped; 15 React tests; type check/build. Live AI
  browser counts, full JSON exact rejoin, CSV completeness and final page passed.
  All keys unique, zero orphans. Proof: qa/debug/S9D_RESULTS.md (local only).
- S9A-S9D are complete locally; remote push awaits explicit owner approval.
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
  Shared/project and evidenced model cooldowns and strict output validation remain.
- Verification: 213 backend passed / 1 skipped; 15 real React lifecycle tests;
  frontend type check/build passed. Live 5,000-student upload and actual AI prompt
  both returned AI available/single_table, exact full export equality and zero
  orphans. Requests took 6.6s/10.8s; prompt used no fallback. Proof in
  qa/debug/STUDENT_QUOTA_RESULTS.md. Restarted backend; old snapshots need regeneration.
- S9B browser baseline: original five-entity prompt
  -> real AI draft without fallback -> 120 LineItems, 20 Orders, 8 Customers,
  12 Products, 4 Categories. Four nested FKs, unique keys, zero orphans and exact
  reconstruction of all 120 exported source rows; all table previews verified.
- S9A browser baseline: commerce exact rejoin/export/pagination/narrow layout;
  students explained as one table without mapping.
- Local services running: backend 127.0.0.1:8000; production frontend localhost:3000.
  Existing Python interpreter requires sandbox escalation; environment unchanged.
- Proof artifacts are local in qa/debug/ (synthetic data; not committed).

## Last Completed Milestone
S9D complete (2026-10-10): qualified main-entity descriptions no longer select a
later related-entity count. The original 40-enrollment browser repro now passes
with 10 students and 5 courses and exact full-source preservation.

## Baseline
- Backend: 218 passed, 1 skipped, 0 failures.
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
- Live course_name values are generic sentences rather than plausible course
  titles. Structural integrity/fidelity checks do not establish semantic realism.
- S0 deploy repair remains deferred: missing app.models.relational_rules on Render
  and Python 3.14.3 rather than 3.12.10. No deployment changes in S9A.
- Unrelated untracked scratch files and qa/ remain outside this slice.
- In-app browser automation cannot start due to sandbox setup errors; bundled
  headless Chrome verified the actual browser/API/data flow.

## Blockers
Current enrollment AI flow passes; provider availability remains quota-dependent.
Automatic approval review previously rejected
pushing to origin/main because source/docs egress needs explicit authorization.
Local repairs are complete; await owner approval to push. No workaround attempted.
