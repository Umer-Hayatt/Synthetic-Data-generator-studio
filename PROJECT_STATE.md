# PROJECT_STATE.md

## Current Phase
REPAIR — one verified vertical slice at a time. Active plan: REPAIR_PLAN.md.

## Active Task
S0A repository cleanup DONE locally; GitHub sync authorized (2026-10-10).
- Owner authorized remote push and paused the frontend redesign until sync.
- Untrack environment template/build cache while preserving local copies; exclude
  QA evidence, historical audit tools, sample upload and stale context from Git.
- Application behavior is unchanged; deployment repair remains deferred.
- Verified: 221 backend passed / 1 skipped, 17 frontend tests, type check and
  production build; secret-pattern scan of 173 tracked/unpushed text blobs clear.
- Ignore coverage and retained local files verified. Normal fast-forward push
  publishes the six completed repair commits plus this cleanup commit.

S10A1 DONE locally (2026-10-10); S10B is the next planned slice.
- Prompt-only output hides reference quality and its details control; uploads
  retain actual scores. Privacy and data checks remain beside the data.
- Plain-language links above the selected table; technical model details are
  secondary. Compact scrollable rows, sticky headers and field/key labels.
- Frozen seven-task benchmark: baseline 6 actions, candidates and confirmation
  5; irrelevant quality items 2 -> 0. Shorter candidate retained with simpler
  copy. Scripted actions do not establish human comprehension or data quality.
- Verified: 17 React tests, type check and production build; live prompt 40/10/5,
  last page ends at 40, full CSV has 40 rows, student 3 matches one parent;
  reference-backed sample retains real 85% and working quality details.
- Mobile verification incomplete: browser viewport override had no effect
  (actual 1280x720). Do not present the desktop capture as mobile evidence.
- Logs/proof: qa/autoresearch/2026-10-10-inspection/. No backend changes;
  prior S10A verification was 221 backend passed / 1 skipped.
- Stop after the verified S10A1 commit. S10B and S11-S12 remain planned.

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
- Local-only scratch files and QA evidence excluded; build cache/template untracked.

## Blockers
No current local repair blocker. Owner explicitly authorized GitHub push on
2026-10-10; prior source/docs egress rejection no longer lacks owner authorization.
