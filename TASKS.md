# TASKS.md — Implementation Task Plan

> **SUPERSEDED:** The active plan is `REPAIR_PLAN.md`. The V2 work order and all TODO/BLOCKED items below are historical. Do not execute them.

Task Statuses: `TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`

## Active repair follow-up milestones (details in REPAIR_PLAN.md)
- [DONE] S10A4 — Main-screen Schema/Privacy/Quality, settings-only right panel and replacement hero; includes pending S10A3 refinements.
- [DONE] S10A5 — Verified Relationships sidebar workspace and clickable map of actual generated tables.
  Complete bounded frame/artifact key/link/count/cardinality inspection; 229 backend / 1 skipped,
  24 frontend tests, TypeScript/build and live desktop/mobile banking checks passed.
- [SUPERSEDED] S10A3 — Data Mine identity, readable labels, restrained accent and scroll reveals.
  Existing refinements were carried into S10A4. The owner's latest request
  replaced DNA and modal editors; S10B and S11-S12 remain planned.
- [DONE] S10A2 — Owner-requested landing, sidebar and motion redesign.
  Verified 19 frontend tests, types/build, 221 backend / 1 skipped; live prompt,
  sample, desktop/mobile and independent design review. Higgsfield asset plan-blocked.
- [DONE] S0A — Owner-requested repository cleanup, verified locally (2026-10-10).
  Untracked local template/build cache and ignored scratch/evidence files.
  Verified 221 backend / 1 skipped, 17 frontend tests, type/build and secret scan.
  Published cleanup and prior repairs to GitHub main at bbb002b.
- [DONE] S8 — One active input and consistent output lifecycle (2026-10-08).
  Source/prompt identity, revisions, snapshot ownership, stale-response guards and
  tab preview invalidation; normal actions no longer substitute demos.
  Verified: backend 159 passed / 1 skipped, 10 React lifecycle tests, frontend
  type check/production build, live banking -> seed edit -> tabular sample flow.
- [DONE] S9 — Hybrid analysis and lossless normalization of generated data (2026-10-09).
  AI metadata proposals, full-row dependency checks, reviewed mappings, exact
  rejoin, prompt/upload dependency preservation, full table pagination/exports.
  Verified: backend 176 passed / 1 skipped, 13 React tests, type check/build and
  live AI enrollment plus full commerce upload/rejoin/export flow.
- [DONE] S9A — AI-owned relationship building (owner change, 2026-10-09).
  Automatic AI model selection, bounded correction and exact reconstruction.
  Fixed provider deadline/overload failures with low thinking and verified model
  failover. Verified: 195 backend / 1 skipped, 15 React tests, type check/build;
  live commerce normalized/rejoined/exported, students explained as one table.
- [DONE] S9B — Reject empty AI drafts before model failover (2026-10-09).
  Require real tables, columns, names and types at the AI validation boundary.
  Verified: 205 backend / 1 skipped, 15 React tests, type check/build; original
  live prompt -> 120 LineItems, 20 Orders, 8 Customers, 12 Products, 4 Categories,
  four nested links, zero orphans and exact full export/rejoin, no AI fallback.
- [DONE] S9C — Model-specific quota failover (2026-10-09).
  Primary daily quota no longer blocks a healthy alternate; provider retry
  durations and cached rate-limit status retained, shared limits preserved.
  Verified: 213 backend / 1 skipped, 15 React tests, type check/build; live
  5,000-student upload and actual AI prompt -> AI results with exact full exports.
- [DONE] S9D — Preserve explicit main counts in qualified AI prompts (2026-10-10).
  A request for 40 university enrollments previously selected 10 related students.
  Generation-count precedence and qualified enrollment fallback now preserve 40/10/5.
  Verified: 218 backend / 1 skipped, 15 React tests, type check/build, live AI
  browser counts, complete JSON/CSV exports and exact rejoin with zero orphans.
- [DONE] S9E — Bounded live AI output experiments (2026-10-10).
  Fixed university/retail/banking checks improved 60/70 -> 68/70 with no check
  regressions; one candidate retained, all full-data gates passed. Backend 218/1
  and retained-version browser verification; frontend unchanged from S9D.
  Amount-range failures remain. Owner then prioritized a simpler data workspace.
- [DONE] S10A — Unified data inspection and adjacent quality/privacy (2026-10-10).
  Frozen six-task navigation score 10 -> 5 in both layouts; beside-table layout
  retained by owner preference and confirmed. Complete pages/downloads, linked
  records, conditional options and truthful unavailable/stale metrics.
  Verified: 221 backend / 1 skipped, 17 React tests, type check/production build.
- [DONE] S10A1 — Owner-requested inspection refinement (2026-10-10).
  Reference-only quality, visible plain-language links and a shorter sticky-header
  table. Frozen seven-task benchmark 6 -> 5; irrelevant quality items 2 -> 0.
  Verified 17 React tests/type/build, live prompt paging/full export/exact parent
  lookup and retained reference quality. Mobile viewport check unverified.
- S10B complete artifact/business-rule audit and S11-S12 remain PLANNED in
  REPAIR_PLAN.md. Historical tasks remain superseded.

---

## Phase 0: Foundation & Setup

### [DONE] SETUP-01: Repository Foundation
- **Goal**: Initialize Git, define `.gitignore`, create project docs (`AGENTS.md`, `REQUIREMENTS.md`, `ARCHITECTURE.md`, `DESIGN.md`, `TASKS.md`, `PROJECT_STATE.md`, `README.md`, `.env.example`), and set up `backend/` and `frontend/` directories.
- **Dependencies**: None.
- **Acceptance Criteria**: All foundation files exist and reflect HackDataV2 requirements.
- **Verification**: `git status` shows clean tracking of foundation files.

---

## Phase 1: Backend Core (P0)

### [DONE] BE-01: FastAPI Backend Skeleton & Health Endpoint
- **Goal**: Initialize FastAPI application, CORS middleware, API router structure, and `/health` endpoint.
- **Relevant Area**: `backend/app/main.py`, `backend/app/api/health.py`, `backend/requirements.txt`
- **Dependencies**: SETUP-01
- **Acceptance Criteria**: `GET /health` returns `{ "status": "ok" }`. Proper CORS configured for frontend.
- **Verification**: Run `pytest` or curl `/health`.

### [DONE] BE-02: Multi-format Ingestion Adapters (CSV / XLSX / JSON)
- **Goal**: Implement file upload parser supporting CSV, XLSX, and JSON into in-memory pandas DataFrames.
- **Relevant Area**: `backend/app/adapters/ingestion.py`, `backend/app/api/ingest.py`
- **Dependencies**: BE-01
- **Acceptance Criteria**: Correctly parses valid CSV, XLSX, and JSON tables. Rejects invalid files with HTTP 400.
- **Verification**: Unit tests with sample CSV, Excel sheet, and JSON record array.

### [DONE] BE-03: Automated Schema & Type Inference
- **Goal**: Extract primitive dtypes, semantic types (email, id, currency, date), null rates, and summary stats.
- **Relevant Area**: `backend/app/core/inference.py`
- **Dependencies**: BE-02
- **Acceptance Criteria**: Inferred column metadata matches test dataset structures accurately.
- **Verification**: Run inference against standard benchmark tabular datasets.

### [DONE] BE-04: Canonical DatasetSpec Models & Validation
- **Goal**: Define Pydantic models for the canonical `DatasetSpec`, column constraints, and privacy rules.
- **Relevant Area**: `backend/app/models/spec.py`
- **Dependencies**: BE-03
- **Acceptance Criteria**: Strongly typed models validate valid specs and reject malformed schemas.
- **Verification**: Unit tests testing valid/invalid spec payloads.

### [DONE] BE-05: Tabular Synthetic Generation Engine
- **Goal**: Build CPU-safe synthesis engine combining distribution fitting, Faker semantics, random seed reproducibility, and column privacy controls (masking, hashing, configurable noise injection).
- **Relevant Area**: `backend/app/engines/tabular.py`
- **Dependencies**: BE-04
- **Acceptance Criteria**: Generates synthetic rows matching target count and distributions. Identical seeds produce identical outputs.
- **Verification**: Statistical similarity tests and deterministic reproducibility assertions.

### [DONE] BE-06: Preview & Export API
- **Goal**: Endpoints to preview first $N$ rows and export full synthetic datasets as CSV and JSON.
- **Relevant Area**: `backend/app/api/generate.py`, `backend/app/api/export.py`
- **Dependencies**: BE-05
- **Acceptance Criteria**: `GET /api/v1/preview` returns paginated rows; `GET /api/v1/export/{format}` returns downloadable stream.
- **Verification**: API tests verifying returned content types and row counts.

### [DONE] BE-07: Statistical Quality Evaluation Module
- **Goal**: Compute statistical fidelity metrics (Kolmogorov-Smirnov, Wasserstein, Total Variation Distance, Correlation differences, overall quality score).
- **Relevant Area**: `backend/app/eval/quality.py`, `backend/app/api/evaluate.py`
- **Dependencies**: BE-05
- **Acceptance Criteria**: Returns composite fidelity score (0-100%) and per-column similarity metrics formatted for UI charts.
- **Verification**: Unit tests on known synthetic vs real distributions.

### [REMOVED] BE-08: ML Utility Evaluation Engine
- **Status**: Removed in Slice S1 (per REPAIR_PLAN.md). Statistical quality evaluation preserved.


---


## Phase 2: Frontend Implementation (P0)

### [DONE] FE-01: Next.js Frontend Shell & Layout
- **Goal**: Initialize Next.js project with TypeScript, modern styling, and base layout shell.
- **Relevant Area**: `frontend/`
- **Dependencies**: SETUP-01
- **Acceptance Criteria**: Modern, responsive layout shell running locally with client navigation.
- **Verification**: `npm run build` succeeds without lint or type errors.

### [DONE] FE-02: Source Ingestion & Sample Dataset UI
- **Goal**: Build file dropzone (CSV/XLSX/JSON) and one-click demo dataset loaders.
- **Relevant Area**: `frontend/components/ingestion/`
- **Dependencies**: FE-01, BE-02
- **Acceptance Criteria**: Users can drop files or click sample datasets to trigger intake.
- **Verification**: Interactive UI test verifying file upload callbacks.

### [DONE] FE-03: Schema & Configuration Inspector
- **Goal**: UI panel displaying inferred schema, editable row count, random seed, null/outlier knobs, and privacy controls.
- **Relevant Area**: `frontend/components/configuration/`
- **Dependencies**: FE-01, BE-04
- **Acceptance Criteria**: Reactive controls allow updating generation parameters and column privacy settings.
- **Verification**: Component tests verifying configuration state updates.

### [DONE] FE-04: Generated Data Preview Canvas
- **Goal**: Interactive virtualized table displaying synthetic data rows with semantic chips and quick stats.
- **Relevant Area**: `frontend/components/preview/`
- **Dependencies**: FE-01, BE-06
- **Acceptance Criteria**: Smooth rendering of sample rows with column sorting and filtering.
- **Verification**: Visual rendering check on 1,000 preview rows.

### [DONE] FE-05: Statistical Quality Dashboard
- **Goal**: Visual dashboard rendering real vs synthetic distribution histograms, correlation heatmaps, and quality scores.
- **Relevant Area**: `frontend/components/quality/`
- **Dependencies**: FE-01, BE-07
- **Acceptance Criteria**: Charts visually present column fidelity and composite score clearly.
- **Verification**: Render dashboard with mock and live quality payloads.

### [REMOVED] FE-06: ML Utility Dashboard
- **Status**: Removed in Slice S1 (per REPAIR_PLAN.md).


### [DONE] FE-07: Export & Error State Management
- **Goal**: Export trigger (CSV/JSON), loading skeletons, and error boundary toasts.
- **Relevant Area**: `frontend/components/common/`
- **Dependencies**: FE-01
- **Acceptance Criteria**: Downloads trigger cleanly; network/backend errors display informative fallbacks.
- **Verification**: Error injection testing (server offline, invalid payload).

---

## Phase 3: Integration, Deployment & QA (P0)

### [DONE] INT-01: End-to-End Frontend & Backend Integration
- **Goal**: Wire all frontend services to live backend endpoints with reactive state management.
- **Relevant Area**: `frontend/services/api.ts`
- **Dependencies**: BE-01 through BE-07, FE-01 through FE-07
- **Acceptance Criteria**: Complete flow: Upload $\to$ Configure $\to$ Generate $\to$ Preview $\to$ Quality $\to$ Export works seamlessly.
- **Verification**: End-to-end browser execution test.


### [BLOCKED] DEP-01: Deployment Configuration
- **Goal**: Production build configurations and free-tier-compatible deployment using platform-native configuration where possible (Docker/containerization is optional).
- **Relevant Area**: `backend/` platform config/Procfile, `frontend/next.config.js` (optional Dockerfile)
- **Dependencies**: INT-01
- **Acceptance Criteria**: Both backend and frontend build and run successfully in production mode.
- **Verification**: Production build execution test and local runtime check.
- **Current result**: 46 backend tests, dependency check, frontend production build/type check, local production routes, health, and configured CORS passed. Render/Vercel configuration is prepared. Public deployment and live QA are blocked on authenticated hosting access; see `DEPLOYMENT.md`.

### [TODO] QA-01: Final P0 Verification against Judging Criteria
- **Goal**: End-to-end verification of all P0 requirements and official judging criteria.
- **Relevant Area**: Whole repository
- **Dependencies**: DEP-01
- **Acceptance Criteria**: All P0 user journeys pass without unhandled errors.
- **Verification**: Automated test suite and manual verification checklist.

---

## Phase 4: Relational Data & AI Capabilities (P1)
> *Note: Relational generation is an official hackathon challenge feature area. Scheduled in Phase 4 to protect the P0 tabular baseline, required coverage, sequenced by the V2 work order below.*

### [TODO] AI-01: Natural Language Prompt to DatasetSpec
- **Goal**: Gemini AI adapter translating free-form prompts into validated `DatasetSpec`.
- **Relevant Area**: `backend/app/adapters/ai_prompt.py`
- **Dependencies**: BE-04
- **Acceptance Criteria**: Converts natural language requests into compliant schema specs; falls back cleanly if AI offline.
- **Verification**: Unit tests with diverse prompts (university, banking, retail).

### [TODO] AI-02: AI Semantic & Business Rule Assistant
- **Goal**: AI suggestions for edge cases, null patterns, and realistic free text synthesis.
- **Relevant Area**: `backend/app/core/ai_assistant.py`
- **Dependencies**: AI-01
- **Acceptance Criteria**: Generates contextual edge-case recommendations.
- **Verification**: Evaluated against test schemas.

### [TODO] REL-01: Relational DatasetSpec Support
- **Goal**: Expand canonical schema models to support multi-table DAGs, PK/FK links, and cardinalities.
- **Relevant Area**: `backend/app/models/spec.py`
- **Dependencies**: BE-04
- **Acceptance Criteria**: Models validate parent-child dependencies and cross-table rules.
- **Verification**: Spec validation test on Customers $\to$ Orders $\to$ Order Items.

### [TODO] REL-02: Relational Synthesis & Integrity Validation
- **Goal**: DAG-based multi-table synthesizer enforcing referential integrity and cross-table reconciliation.
- **Relevant Area**: `backend/app/engines/relational.py`
- **Dependencies**: REL-01
- **Acceptance Criteria**: Generated child records reference valid parent PKs; order totals equal line-item sums.
- **Verification**: Zero orphan FKs in generated relational output.

### [TODO] REL-03: Relational Workspace UI
- **Goal**: Frontend multi-table navigation and relationship inspection view.
- **Relevant Area**: `frontend/components/relational/`
- **Dependencies**: REL-02, FE-01
- **Acceptance Criteria**: Users can toggle between tables and view relationship links.
- **Verification**: Visual interaction testing with multi-table datasets.

---

## Phase 5: Document Generation & Extensions (P2)
> *Note: Document generation is an official hackathon challenge feature area. Required coverage after relational features.*

### [TODO] DOC-01: Synthetic Invoice Generator
- **Goal**: Reconciled invoice generation engine with regional line items, tax rules, and totals.
- **Relevant Area**: `backend/app/engines/documents/invoice.py`
- **Dependencies**: REL-02
- **Acceptance Criteria**: Strict mathematical balance on all generated invoices.
- **Verification**: Unit tests verifying line items sum exactly to invoice total.

### [TODO] DOC-02: Synthetic Bank Statement Generator & Query Engine
- **Goal**: Sequential transaction histories with chronological balances and query-style filtering.
- **Relevant Area**: `backend/app/engines/documents/bank_statement.py`
- **Dependencies**: REL-02
- **Acceptance Criteria**: Chronological running balance invariant holds across 100% of transactions.
- **Verification**: Balance verification test ($Balance_t = Balance_{t-1} + Credit_t - Debit_t$).

### [TODO] IO-01: Extended Formats (SQL Schema / Parquet)
- **Goal**: Ingestion and export for SQL dumps and Parquet formats.
- **Relevant Area**: `backend/app/adapters/`
- **Dependencies**: BE-02, BE-06
- **Acceptance Criteria**: Correct serialization/deserialization of SQL/Parquet data.
- **Verification**: Format roundtrip tests.

## Environment Prerequisites (preflight only)

### [DONE] ENV-01: Repository-root Local Environment Loading
- Load optional root .env from backend configuration independently of working directory; preserve production environment precedence.
- Install official google-genai SDK and record dependency versions; no V2 features or deep-model stack.
- Verification: pip check passes; 46 existing P0 tests and three environment-loading tests pass.
- Gemini API preflight remains blocked: root .env was not detected; no request sent.

## V2 work order (authoritative active sequence)
Older incomplete AI/REL/DOC tasks map to the modules below; do not execute competing plans. Each module must preserve P0 tests, update state and record evidence before DONE.

### [DONE] V2-DOC: Approve target and migration plan
- Update requirements/architecture/design/tasks/state before application edits. User-approved direction supersedes older product assumptions only.
### [DONE] V2-FOUNDATION: Scalable ingestion, artifacts and jobs
- Audit P0; add bounded disk staging/batch profiling for CSV, JSONL, Parquet and practical JSON/XLSX paths; configurable limits, safe storage/cleanup.
- ArtifactStore/JobStore/JobExecutor local implementations and asynchronous ingestion API; generation API follows engine integration in V2-QUALITY; bounded queue, cancellation, failure cleanup and retrieval tests.
### [DONE] V2-AI: Provider router
- Depends on foundation. Gemini, validated structured output, safe error taxonomy, retries/Retry-After, quota-pool cooldown, credential failover, concurrency, outage tests; mock tests do not depend on live credentials.
### [DONE] V2-INTELLIGENCE: Reviewable dataset intelligence
- Depends on AI. Prompt-to-spec, ambiguity assistance and edge-case proposals; malformed responses rejected; explicit review boundary.
### [DONE] V2-QUALITY: Engine interface and measured quality
- Depends on foundation. Wrap statistical engine, benchmark target/mixed dependencies and memorization, improve only measured weaknesses.
### [DONE] V2-RELATIONAL: Relational execution
- Depends on canonical schema/engine interface. DAG/PK/FK/cardinality/reconciliation and seeded five-table demo; zero-orphan tests. Does not depend on deep models.
### [DONE] V2-DOCUMENTS: Structured document execution
- Depends on relational. Invoices/statements from same entities, decimal invariants/date filtering, artifact outputs and tests.
### [DONE] V2-DEEP: Optional deep adapter
- After relational/documents. Evaluate SDV CTGAN/TVAE compatibility; capability-gated bounded CPU training, no unconditional heavy install. Test if installed; report unavailable honestly.
### [DONE] V2-COMPARE: Comparison/AUTO
- Depends on quality and optional deep adapter. Shared splits, quality/runtime/memory with evidence-based recommendation; unavailable engines explicit.
### [BLOCKED] V2-INTEGRATION: Client-grade workflow completion
- Wire review, jobs, relational/documents, artifacts and engine comparison into existing frontend; build/type checks and end-to-end verification. Production storage/workers/deployment remain explicit gaps until verified.
Foundation verification: 57 backend tests passed (46 P0, 3 environment, 8 foundation). Existing P0 paths unchanged; bounded raw upload/job/profile/download workflow verified. Arrow type drift and oversized Parquet row groups are rejected with guidance rather than unbounded coercion.

AI router verification: six focused tests pass; invalid credentials disabled, 429 cools shared pool, independent-provider failover supported through interface, timeout/network/5xx retries bounded, malformed output rejected. Live Gemini still unverified.

Quality/engine milestone: focused engine/foundation tests pass. Statistical wrapper and batched generation jobs added. P0 default is unchanged; no universal superiority claim.


Relational verification: two focused tests pass; shuffled five-table specification resolves DAG, zero orphans, unique keys, seeded reproducibility, bounded cardinalities and decimal line-total reconciliation. Relational execution is bounded by MAX_CELLS (not yet out-of-core).

Documents verification: full backend suite 71 passed. Invoice Decimal subtotals/tax/discount/total and same-entity mappings verified; chronological statements and filtered opening/running/closing balance continuity verified. PDF not implemented.

Deep adapter: optional SDV CTGAN/TVAE subprocess adapter implemented, no heavy installation. Capability gate test passed; opt-in training test skipped. Actual training/compatibility/performance remain unverified until a separately approved serial benchmark environment is configured.

Comparison verification: sequential fixture test passes; identical seeded split and training-only fits, runtime and explicitly non-peak DataFrame memory estimate, optional engine unavailability. AUTO is a reviewed recommendation, never silent deep selection.

Integration blocker (2026-09-30): OpenBLAS allocation failure during a verification subprocess; OS reported 786620 KiB free physical memory and only 119028 KiB free committed/virtual memory. Stop further tests/builds/training until resources recover. No user applications were terminated.
- Draft /v2 review/job/artifact/comparison UI and entry link added; not type-checked, built or browser-verified.
- Latest full backend pass: 71 tests before final deep/comparison/source-job/preview changes. Subsequent focused deep gate: 1 pass/1 skip; comparison: 1 pass.
- Resume: inspect latest source-job and artifact ownership/cancellation changes, validate demo JSON, add API tests for generation/comparison/preview and configured limits, run full backend suite and pip check, then frontend tsc/build and browser flows. Deep training stays disabled.
- Review remaining robustness: long-record JSON memory bounds, local job restart semantics, executor shutdown, bounded AI whole-request deadlines, conditional-engine ID uniqueness, output-artifact validation and frontend polling/retry behavior.
- Do not mark the entire V2 expansion complete or production-ready. Earlier module DONE denotes its tested milestone, not final integration certification.
