# PROJECT_STATE.md

## Current Phase
REPAIR — one verified vertical slice at a time. Active plan: REPAIR_PLAN.md.

## Active Task
No active implementation. The owner's two requested slices S10A4 and S10A5 are
DONE. Stop here. S10B and S11-S12 remain PLANNED, outside this request.
S10A3 pending refinements were included in S10A4; DNA and modal editors were
superseded by the latest owner instructions.

## Latest Verification (2026-10-10)
- S10A4: Data, Schema, Privacy and reference-backed Quality are main workspace
  views. Active sidebar uses aria-current; right panel contains settings only.
  Removed modal editors/focus hook and duplicate settings navigation. Raw field
  keys, edits, snapshot invalidation, paging, exports and documents are preserved.
- Built-in imagegen supplied synthetic record tiles assembling into linked grids.
  Final hero and exact prompt are frontend/public/media/synthetic-data.*.
- S10A5: Relationships sidebar provides clickable table nodes, actual counts,
  observed cardinality and full-row key/link evidence. Selecting a node opens
  that exact table in Data; no generation or source replacement occurs.
- Additive /relationships/inspect checks complete bounded frames/artifacts,
  typed keys, nulls, duplicate keys, orphans and configured cardinality bounds.
  Manifests reject mixed artifacts. Total cells/memory are bounded; over-limit
  outputs show an explicit error without making partial integrity claims.
- AI model discovery/retry and exact reconstruction use the original snapshot.
  Unknown relationships are not fabricated. Stale inspection/AI results cannot
  restore maps after edits or source replacement.
- Final: 24 frontend tests, TypeScript and production build passed; backend
  229 passed / 1 skipped (existing Starlette deprecation warning).
- Live Banking: 10 Accounts / 50 Transactions, unique keys, zero broken/missing
  links, 1:N observed and 3–9 transactions per account. Full exported CSV
  independently confirmed counts. Node navigation, both 25-row pages and complete
  exports retained. Desktop1440/mobile390 map/editors checked; no page overflow.
  Main tabs reset scroll. Right settings stack after main content below 900px.
- S10A4 was verified/committed before beginning S10A5. No new live AI-provider
  accuracy claim is made; existing discovery is regression-tested and provider
  failures remain retryable. Deterministic live artifact inspection passed.

## Git and Local Runtime
- Branch main, origin https://github.com/Umer-Hayatt/Synthetic-Data-generator-studio.git.
- S10A4 published at e21b13b. Owner explicitly approved pushing both verified
  slices to this origin/main in chat after the initial automatic-review rejection.
  Git log/status are authoritative for final publication state.
- Frontend production http://localhost:3000 uses updated backend 127.0.0.1:8001.
  Port8001 avoids disturbing the pre-existing server on port8000. No deployment
  or environment file was changed; API origin override is process-local only.
- Commands: frontend npm test, npx tsc --noEmit, npm run build; backend .venv pytest.
  Existing Python venv requires sandbox escalation; builds fetch existing fonts.

## Remaining Planned Work
- S10B business-rule/reconciliation and larger-artifact audit coverage, plus
  S11-S12 document suitability/same-snapshot work remain planned. Bounded
  complete-table PK/FK/cardinality inspection is now covered by S10A5.
- Commerce entry demo previously failed a derived upper bound; unrelated to these
  UI fixes. Existing AI amount ranges/course title realism issues remain.
- AI quota may block discovery. Preserve generated data and offer retry.
- Deployment repair stays deferred. Prior intermittent sample-preview fetch
  failures were not repaired in these slices; friendly retry retains the snapshot.
- Historical S9E 68/70 is a fixed live case result, not AI-wide accuracy.

## Blockers
No blocker for these completed slices. Higgsfield remains account-plan gated;
built-in imagegen produced the replacement hero. Prior Impeccable detector was
unavailable; source and live browser checks were used. No unrelated work started.
