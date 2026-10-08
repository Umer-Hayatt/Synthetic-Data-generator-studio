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
S0 SKIPPED | S1 DONE | S2 DONE | S3 DONE | S4 DONE | S5 DONE | S6+S7 DONE | S8 DONE | S9 DONE | S10-S12 PLANNED

## Input-driven follow-up repair — planned, 2026-10-08

Owner request: Relational must derive its model from the active prompt or supplied
tabular data, rather than replacing it with a fixed demo. After relational is
working end to end, Documents must assess whether that same data supports a
document and render it without substituting or regenerating unrelated entities.
S1-S7 remain completed historical milestones. This extends this active plan;
it does not resume the superseded V2 work order. Product choices are recorded
below. Execute the following slices sequentially; S8-S9 are complete and S10 is next.

### Confirmed causes and baseline
- `backend/app/api/intelligence.py` truncates multi-table AI drafts to the first
  table; its fallback also returns one table. The original prompt is not retained
  as relational planning context in the client.
- `backend/app/api/ingest.py` profiles one frame; there is no input-derived entity
  decomposition or relationship proposal in the current upload workflow.
- `frontend/context/StudioContext.tsx` demo loaders replace the active spec with
  fixed fixtures. Upload/prompt transitions do not consistently clear all
  relational/document outputs.
- `frontend/components/documents/DocumentsWorkspace.tsx` generation actions call
  those demo loaders, even when the user already has an active dataset.
- Relational integrity badges are static. Preview pagination and table CSV export
  operate on a bounded sample rather than the whole artifact.
- 2026-10-08 verification: 39 relational tests pass; frontend
  `npx tsc --noEmit --incremental false` passes. Full browser generation was not
  verified: local origin configuration and frontend restart errors interrupted it.

### Owner decisions — answers 1, 2, 1, 1, 2, 1, 1
1. Propose entity splits and relationships for user review before applying them.
2. If no defensible relationships are found, ask targeted follow-up questions to
   discover missing entities. Keep the current table until the answers support a
   model; do not invent one or require every dataset to become multi-table.
3. Support invoices and bank statements first. Explain missing fields and
   unsuitable data; general reports/additional document kinds are outside scope.
4. Ask for required missing fields or user mappings before document generation.
   Do not silently add plausible values.
5. Normalize the already-generated synthetic tabular data. The full generated
   snapshot is authoritative for relational values, not the original upload or
   its small UI preview. Prompt/spec context may suggest meanings, but cannot
   prove a dependency contradicted by generated rows.
6. Repair the existing single-table upload and prompt flow first. Multiple CSVs
   and multiple workbook sheets are outside this follow-up's scope.
7. Requested counts apply to the named main entity (e.g. 1,000 orders), with
   related-table counts shown separately for review. Preserve transaction grain:
   1,000 line-item rows cannot silently be labeled 1,000 distinct orders.

Target flow: prompt/upload -> generated tabular snapshot -> relationship analysis
and clarification -> reviewed, lossless relational tables -> document eligibility
and required mappings -> documents from those same rows. If independent tabular
generation has already lost an intended dependency, report the conflict and ask
for clarification/a reviewed regeneration. Do not claim to recover unsupported
relationships or silently modify source values to make a proposed model pass.

### S8 — One active input and consistent output lifecycle — DONE
- Keep source identity/revision, source kind, original prompt where applicable,
  reference token, active spec, reviewed model and generated artifact revision
  connected in the studio. Keep raw uploaded rows in the backend.
- On new input or relevant model edits, invalidate dependent proposals, integrity
  results and artifacts; ignore late responses from superseded revisions.
- Keep demos as explicitly selected examples; normal Relational/Documents actions
  must never replace the active source with commerce/banking fixtures.
- Preserve current API contracts; introduce only the optional context needed for
  later planning and snapshot ownership. Preserve the working tabular workflow.
- Acceptance: input A -> generate -> input B -> switch tabs never displays or
  exports A as B; normal actions never silently load a demo.
- Implemented: source identity/kind/original prompt, model/generation revision,
  frame-vs-artifact snapshot ownership, guarded async responses and output
  invalidation on new input, model edits, regeneration and session reset.
- Relational/document views remount on revision changes; stale preview responses
  cannot restore prior records. Normal actions use the current spec and refuse
  missing relational/document mappings. Explicit entry-screen demos remain.
- Removed the obsolete separate minimal commerce fixture and its unused fixture
  module. Existing server endpoints/contracts are unchanged; S8 needed client
  ownership metadata rather than new backend context fields.
- Verification (2026-10-08): backend 159 passed / 1 skipped; 10 real React lifecycle
  tests passed; frontend type check and production build passed. Browser: explicit
  banking demo -> statements, seed edit -> old previews/exports cleared, New ->
  customer-churn sample -> Documents keeps the sample and disables unmapped
  generation. Backend logs confirm successful generation/manifest/preview calls.
- Relationship inference/normalization, document suitability and rendering from
  the same generated snapshot remain S9-S12 work; S8 does not claim those complete.

### S9 — Relational analysis and normalization of generated data — DONE
- Owner approved the hybrid approach: AI proposes entity meanings using schema
  metadata and prompt context; deterministic full-snapshot checks decide whether
  mappings are valid, and accepted splits must reconstruct every original row.
- Implemented generated frame/JSONL analysis, reviewed entity mappings and
  clarification, full-data conflicts/counts, atomic normalization, exact rejoin
  verification, duplicate-row preservation and explicit surrogate keys. The
  original generated snapshot remains authoritative and unchanged.
- Prompt entity intent and explicit main/related counts survive flattening.
  Flat generation preserves declared groups and evidenced upload dependencies;
  declared non-person attributes no longer use generic person-name heuristics.
- The review UI exposes source mappings, counts and evidence, leaves unassigned
  fields at the original grain, and asks about ambiguous/unique-row mappings.
  Unique-per-row splits require explicit selection. New normalized tables use
  real frame pagination and complete CSV/JSON exports. Older demo inspection
  cleanup and linked-record navigation remain S10.
- Removed unused commerce ratio constants and the fixed commerce prompt example.
  Restored the removed historical fixture under backend tests and moved its
  builder out of the untracked audit script; all existing regressions now run
  independently of frontend demos and local scratch tools.
- Live provider diagnosis: the old configured gemini-2.5-flash model returned
  404. Local configuration now uses gemini-3.8-flash. Simplified the provider
  relationship JSON schema while retaining canonical local validation; live
  analysis returned AI available, real suggestions and targeted questions.
- Verification (2026-10-09): backend 176 passed / 1 skipped; 13 React lifecycle
  tests passed; frontend type check and production build passed. Browser verified
  AI prompt -> 40 enrollments with 10 students and 5 courses -> reviewed mappings
  -> exact normalization, real pagination and entity previews. A 60-row synthetic
  commerce upload passed full JSON rejoin equality, final-page and full CSV checks.
  Conflicts beyond preview, null/expired/wrong-kind sources, no-relation input,
  AI unavailable/hallucinated output, duplicate rows, cross-batch consistency and
  superseded requests are covered. Final review/preview CSS verified in browser;
  proof screenshots are in local qa/. Provider outages remain visibly handled.
- Add a reviewable relationship proposal from the complete active generated
  tabular snapshot, resolved server-side by its token/artifact ID. Use a bounded
  candidate search and validate proposed dependencies against all supported rows
  before presenting them as established. Report size limits or ambiguity clearly.
- Identify candidate keys, repeated entities and functional dependencies (e.g.
  customer ID consistently determines customer attributes), not just *_id names.
  Detect conflicting values, null keys, accidental numeric overlaps and cases
  where decomposition would lose information. Explain evidence and provenance.
- Retain explicitly requested entities/links from prompts as planning context
  instead of discarding them when producing the tabular view. Preserve declared
  dependencies during tabular generation where supported; if actual generated
  rows conflict, ask for clarification and review any proposed regeneration.
  Offline behavior must stay input-specific and must not substitute a fixed domain.
- Show proposed tables, source-column mappings, PK/FK links, cardinalities,
  per-table counts, and unresolved decisions. Every source field must have a
  mapping or an explicit exclusion; introduce surrogate keys only transparently.
- Materialize normalized tables from the accepted generated snapshot, preserving
  its values and row multiplicity. Verify that joining them reconstructs the
  source rows at their original grain. Do not independently synthesize replacement
  rows merely because the user opens Relational. Any explicit regeneration makes
  a new tabular snapshot and invalidates downstream outputs.
- Do not treat every correlated pair as a foreign key. Keep statistical
  correlations separate from key links and deterministic business dependencies.
- Use existing typed reconciliation/reference/temporal rules where applicable;
  infer/propose them only with evidence or prompt intent. For example an item's
  sale price need not equal today's catalog price, and a payment need not be a
  full settlement. Do not silently impose those assumptions.
- Preserve consistent synthetic key values across references. Any required
  surrogate key must be reviewable and must not alter existing field values.
- With no defensible relation, ask focused questions about the entity, identifying
  fields or missing context. Keep the current table if uncertainty remains.
  Reject impossible cardinalities or unsupported composite-key/cyclic models
  clearly rather than altering the data.
- Acceptance: flattened commerce data produces its own reviewed entity model;
  university enrollment produces students/courses/enrollments when evidenced;
  unrelated names/ages prompts clarification without a fabricated commerce
  schema. Changing the input changes the model/output; normalizing twice keeps
  identical values; rejoining the normalized rows reproduces the tabular snapshot.
  Count checks distinguish main entities, line items and related entities.

### S10 — Compact relational inspection with truthful results — PLANNED
- Default: a short source/model summary, table selector and paged data preview.
  Put relationship details and schema editing behind explicit secondary views.
- Show actual connected column names and parent/child cardinality direction.
  Let users inspect linked records so the relationships are observable in data.
- Compute/report PK, FK, cardinality and configured business-rule checks over
  complete output artifacts. Separate ungenerated, stale, passed and failed states.
- Add real artifact pagination and total counts; export the whole selected table.
  Surface failed jobs, cancelled jobs, timeouts and preview failures truthfully.
- Acceptance: no static success claims, no sample mislabeled as total output,
  complete CSV export, and readable desktop/narrow-screen layout.

### S11 — Document suitability and reviewed field mapping — PLANNED
- Assess only supported document kinds against the active reviewed model and
  field semantics. Return eligible, needs mapping/fields, or unsuitable, with
  specific reasons and source table/column mappings.
- Invoice eligibility requires an identifiable invoice/order entity and its
  amounts or line-item relationship. Statement eligibility requires an account,
  ordered transactions, compatible amount direction and opening-balance context.
  A salary column alone is not invoice evidence; a date column alone is not
  bank-statement evidence. Do not fabricate tax, currency, balance or parties.
- Show only relevant options, allow mapping corrections and request missing
  inputs before generation. Backend validates the mapping;
  AI may suggest semantics but cannot override structural/accounting validation.
- Acceptance: commerce can propose invoices, suitable banking can propose
  statements, unrelated students/sensors cannot generate either by loading demos.

### S12 — Documents from the same generated entities — PLANNED
- Render documents from the accepted generation snapshot/artifact IDs. Do not
  call a fresh relational generator merely to format documents.
- Tie every document to its parent and child rows, source/model revision and
  reviewed mapping. Enforce Decimal reconciliation and chronological balances.
- Avoid double-counting uploaded tax/discount totals. Respect amount semantics,
  currency and reviewed missing-field policy; block contradictions clearly.
- Provide full artifact-based PDF/ZIP/CSV/JSON exports and correct document counts;
  clear stale local preview state on input or mapping changes.
- Acceptance: invoice lines match the visible order items and totals; statement
  transactions match the visible relational records; reopening/exporting keeps
  the same entities and values until the user explicitly regenerates.

### Required verification for each follow-up slice
- Backend tests for the changed boundaries, full backend suite, frontend type
  check/build where relevant, and one live browser flow before marking DONE.
- End-to-end examples: flattened commerce upload, university enrollment input,
  banking data, explicitly relational prompt, simple non-relational table,
  ambiguous/conflicting IDs, missing document fields, and AI-unavailable path.
- Assert snapshot fidelity (no unrelated demo replacement), all fields mapped,
  lossless normalization/rejoin including duplicate rows,
  requested counts honored, zero orphan keys, actual cardinalities, configured
  business rules, complete exports and document-to-table equality.
- Test source changes during pending jobs and switching tabs after regeneration.
- Update this plan, PROJECT_STATE.md, TASKS.md and CODEMAP.md as each slice's scope
  requires. Stop after the verified slice commit; S0 remains deferred.

