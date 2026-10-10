# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Product Purpose
Synthetic Data Studio creates structured synthetic datasets from a prompt,
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
Statistical quality requires a reference. Full artifact audit and same-snapshot
document suitability work remain planned in REPAIR_PLAN.md.

## Brand Commitments
Preserve the Synthetic Data Studio identity. Owner requested CoreShift landing
inspiration, a compact sidebar/table workspace, scroll and transitional animation,
and no generic AI design patterns. Higgsfield asset production is plan-blocked.

## Evidence on Hand
Existing app, tests and real sample-generation flows. User supplied the CoreShift
Dribbble reference and a compact Oneleet workspace screenshot. No testimonials,
customer claims, pricing or usage statistics have been supplied.

## Product Principles
- Preserve exact generated values and source ownership through all navigation.
- Display only evaluated results; distinguish unavailable, pending and failed.
- Give every navigation item a real action within existing functionality.
- Keep complete data exports accessible from the selected table.

## Open Decisions
Primary audience beyond the existing dataset workflow is not confirmed. No new
pricing, authentication, history, persistence or integrations are in this slice.
