# PROJECT_STATE.md

## Current Phase
REPAIR — one verified vertical slice at a time. Active plan: REPAIR_PLAN.md.

## Active Task
S10A4 main-screen workspace fixes DONE; commit/publication now, followed by
S10A5 verified Relationships workspace as the owner's second requested slice.
S10A3 pending refinements are included in S10A4; the new request supersedes DNA
and modal editors. S10B and S11-S12 stay outside this request.

## S10A4 Verification (2026-10-10)
- Data, Schema, Privacy and reference-backed Quality are main workspace views.
  Active sidebar selection uses aria-current. Right panel contains settings only.
- Removed modal editors/focus hook and duplicate settings navigation. Existing
  row/seed/generate controls, snapshot invalidation and raw field values retained.
- Built-in imagegen supplied synthetic record tiles assembling into linked grids.
  Hero and exact prompt are in frontend/public/media/synthetic-data.*.
- 21 frontend tests, TypeScript and production build passed; backend 221 passed /
  1 skipped (existing Starlette deprecation warning). Privacy edit invalidation
  is exercised through the real React editor.
- Live Banking & Statements generated 10 Accounts / 50 Transactions. Desktop
  and mobile inline Schema/Privacy, drawer navigation and zero dialogs confirmed.
  Mobile content width is exactly 390px with no document overflow; settings follow
  main content below 900px. Desktop settings stay on the right.

## Git and Local Runtime
- Branch main, origin https://github.com/Umer-Hayatt/Synthetic-Data-generator-studio.git.
- Owner previously authorized GitHub push; two ordered commits requested now.
- Frontend production http://localhost:3000; backend http://127.0.0.1:8000.
- Existing Python venv needs sandbox escalation; environment unchanged.
- Commands: frontend npm test, npx tsc --noEmit, npm run build; backend .venv pytest.
- Build requires access to existing Google Fonts. Local environment stays ignored.

## Decisions
- Original generated snapshot is authoritative; preserve exact values and counts.
- AI proposes relational models; deterministic full-data validation and exact
  reconstruction guard accepted results. Do not invent inferred relationships.
- Source identity/revisions guard stale results. Edits/regeneration invalidate output.
- One classic studio; explicit entry demos only. Statistical quality needs reference.
- User requests S10A5 clickable relationship map and accurate generated-data checks.

## Known Open Issues
- S10B full artifact/business-rule audit and S11-S12 document suitability remain planned.
- Commerce entry demo previously failed a derived upper bound; outside these UI fixes.
- Existing AI amount range failures and generic course title realism are unresolved.
- AI quota can block discovery; keep original generated data and offer retry.
- Deployment repair remains deferred. Intermittent sample-preview fetch failure
  was seen in previous runs; friendly errors preserve the generated snapshot.
- Historical S9E live benchmark 68/70 is a fixed case result, not AI-wide accuracy.

## Blockers
No blocker for the requested slices. Higgsfield asset production remains plan-gated;
built-in imagegen completed this requested hero. Impeccable detector was unavailable
in the prior refinement; source and live-browser verification were used.
