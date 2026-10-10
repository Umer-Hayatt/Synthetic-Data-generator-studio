# PROJECT_STATE.md

## Current Phase
REPAIR — one verified vertical slice at a time. Active plan: REPAIR_PLAN.md.

## Active Task
S10A2 frontend redesign complete and verified (2026-10-10); publish, then stop.
- CoreShift-inspired light landing; compact sidebar/table workspace with real
  schema, privacy, settings, conditional quality and document controls.
- Native scroll/entrance/workspace transitions, reduced-motion support,
  responsive Next Image hero, accessible mobile drawer and editor focus handling.
- Verified: 19 frontend lifecycle tests, TypeScript and production build;
  221 backend passed / 1 skipped. No backend code or contracts changed.
- Live prompt: 40 enrollments / 10 students / 5 courses; full CSV has 40 rows,
  final page ends at 40 and linked student lookup retains the source snapshot.
- Live reference sample: 200 generated rows and actual 94% quality; full desktop
  and mobile captures plus Schema/Privacy/Quality keyboard checks inspected.
- Bounded independent design review completed after focused accessibility,
  responsive-editor and image-delivery corrections. Product/design context saved.
- QA evidence remains local in qa/redesign/. S10B and S11-S12 stay planned.
- S0A cleanup and prior repairs were published at bbb002b on GitHub main.

## Last Completed Milestones
- S9E: fixed live university/retail/banking checks 60/70 -> 68/70; one retained
  AI instruction candidate, no passing check regressed. No confirmation repeat;
  owner redirected priority to UI. Not an AI-wide quality percentage.
- S9D: explicit enrollment count fixed; original browser request now 40/10/5.
- Full slice details and older verification records live in REPAIR_PLAN.md.

## Decisions
- Original generated snapshot is authoritative; preserve exact values and counts.
- AI owns relational discovery/build from current source, prompt and full-row
  dependency metadata, with validation, bounded correction and exact rejoin.
- Single-table outcomes need an AI explanation; provider errors remain retryable.
- Source identity, model/generation revisions and snapshot ownership guard stale
  responses. Input/model edits/regeneration invalidate downstream outputs.
- One classic studio. No implicit demo replacement; explicit entry demos remain.
- Statistical quality needs a reference. TSTR removed. Document suitability and
  same-snapshot rendering are S11-S12; no fresh generation to format documents.
- Local AI uses configured primary/verified alternate, low thinking, 120-second
  attempt and 180-second total budgets; evidenced model/shared quota cooldowns.

## Known Open Issues
- S10B: complete artifact PK/FK/cardinality/business-rule audit remains pending.
- AI amount ranges failed two fixed S9E cases; generic course titles may be
  sentences unless constrained. Structural fidelity does not prove realism.
- S0 deployment repair deferred (Render import/runtime); no deployment changed.
- Commerce & Invoices entry demo failed with "Derived value violates upper bound"
  during S10A browser checks. Banking artifact paging/link/export passed. Demo
  generation constraints need a later scoped repair; no fabricated demo output.
- Existing Python venv needs sandbox escalation; environment unchanged.
- Local backend: 127.0.0.1:8000. Production frontend: localhost:3000.
- During redesign checks, some local sample preview requests returned "Failed to
  fetch" while generated rows were retained; successful runs and quality retry
  were verified. Cause is unresolved; no speculative backend repair in S10A2.
- Local-only scratch files and QA evidence excluded; build cache/template untracked.

## Blockers
Higgsfield image generation requires Basic plan or higher; no job was submitted.
This blocks Higgsfield asset production only. Existing generated hero and native
frontend animations can proceed; no deployment or plan change is attempted.

No current local repair blocker. Owner explicitly authorized GitHub push on
2026-10-10; prior source/docs egress rejection no longer lacks owner authorization.
