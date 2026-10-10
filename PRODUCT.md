# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Product Purpose
Data Mine creates structured synthetic datasets from a prompt,
uploaded reference file, or explicitly selected example dataset. Users inspect
generated tables, relationships and reference-backed quality, then export data.

## Operating Context
Existing Next.js 14 Pages Router frontend and React context connect to FastAPI.
There is one active source and generated snapshot. Changing input or generation
settings invalidates dependent output. Dataset history/accounts are not implemented.

## Capabilities and Constraints
CSV/XLSX/JSON upload; AI prompt generation; explicit sample datasets; schema and
privacy editors; row count/seed settings; complete paging and CSV/JSON exports;
AI-built links and exact parent inspection; existing mapped document workflows.
Relationships displays a clickable map of actual generated tables, checked counts,
key links and observed cardinalities. Bounded complete-table inspection reports
duplicate/missing keys, orphan rows and configured cardinality failures. AI proposes
flat-data models; deterministic dependency and exact reconstruction checks apply.
Statistical quality requires a reference. Additional business-rule/large-artifact
audits and same-snapshot document suitability remain planned in REPAIR_PLAN.md.

## Brand Commitments
Use the Data Mine identity with the owner's geometric logo reference, its arrow
removed and its color softened to blue-gray. Preserve the CoreShift landing
inspiration, compact sidebar/table workspace and Manrope typography. The owner
requested muted slate-blue accents, selective headline emphasis, consistent
Title Case interface labels, sentence-case helper prose and quick scroll reveals.
The hero shows translucent synthetic records assembling into linked table grids.
Data, Schema, Privacy and reference-backed Quality open in the main workspace;
the right panel contains generation settings only.
Avoid generic AI design patterns. Higgsfield asset production is plan-blocked;
the current identity and hero assets were generated with built-in imagegen.

## Evidence on Hand
Existing app, tests and real sample-generation flows. User supplied the CoreShift
Dribbble reference, a compact Oneleet workspace screenshot, updated interface
screenshots, a geometric logo reference and a synthetic DNA image reference.
Exact current asset prompts are retained alongside the PNGs. The owner's latest
screenshots request inline editors, settings-only controls and a relationship map.
No testimonials, customer claims, pricing or usage statistics have
been supplied. Implementation and verification status lives in PROJECT_STATE.md
and REPAIR_PLAN.md; this product context does not assert final review approval.

## Product Principles
- Preserve exact generated values and source ownership through all navigation.
- Display only evaluated results; distinguish unavailable, pending and failed.
- Give every navigation item a real action within existing functionality.
- Keep complete data exports accessible from the selected table.
- Human-readable field and type labels change presentation only; preserve raw
  schema keys, values, select values, lookup parameters and export headers.

## Open Decisions
Primary audience beyond the existing dataset workflow is not confirmed. No new
pricing, authentication, history, persistence or integrations are in this slice.
