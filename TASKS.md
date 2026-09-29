# TASKS.md — Implementation Task Plan

Task Statuses: `TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`

---

## Phase 0: Foundation & Setup

### [DONE] SETUP-01: Repository Foundation
- **Goal**: Initialize Git, define `.gitignore`, create project docs (`AGENTS.md`, `REQUIREMENTS.md`, `ARCHITECTURE.md`, `DESIGN.md`, `TASKS.md`, `PROJECT_STATE.md`, `README.md`, `.env.example`), and set up `backend/` and `frontend/` directories.
- **Dependencies**: None.
- **Acceptance Criteria**: All foundation files exist and reflect HackDataV2 requirements.
- **Verification**: `git status` shows clean tracking of foundation files.

---

## Phase 1: Backend Core (P0)

### [TODO] BE-01: FastAPI Backend Skeleton & Health Endpoint
- **Goal**: Initialize FastAPI application, CORS middleware, API router structure, and `/health` endpoint.
- **Relevant Area**: `backend/app/main.py`, `backend/app/api/health.py`, `backend/requirements.txt`
- **Dependencies**: SETUP-01
- **Acceptance Criteria**: `GET /health` returns `{ "status": "ok" }`. Proper CORS configured for frontend.
- **Verification**: Run `pytest` or curl `/health`.

### [TODO] BE-02: Multi-format Ingestion Adapters (CSV / XLSX / JSON)
- **Goal**: Implement file upload parser supporting CSV, XLSX, and JSON into in-memory pandas DataFrames.
- **Relevant Area**: `backend/app/adapters/ingestion.py`, `backend/app/api/ingest.py`
- **Dependencies**: BE-01
- **Acceptance Criteria**: Correctly parses valid CSV, XLSX, and JSON tables. Rejects invalid files with HTTP 400.
- **Verification**: Unit tests with sample CSV, Excel sheet, and JSON record array.

### [TODO] BE-03: Automated Schema & Type Inference
- **Goal**: Extract primitive dtypes, semantic types (email, id, currency, date), null rates, and summary stats.
- **Relevant Area**: `backend/app/core/inference.py`
- **Dependencies**: BE-02
- **Acceptance Criteria**: Inferred column metadata matches test dataset structures accurately.
- **Verification**: Run inference against standard benchmark tabular datasets.

### [TODO] BE-04: Canonical DatasetSpec Models & Validation
- **Goal**: Define Pydantic models for the canonical `DatasetSpec`, column constraints, and privacy rules.
- **Relevant Area**: `backend/app/models/spec.py`
- **Dependencies**: BE-03
- **Acceptance Criteria**: Strongly typed models validate valid specs and reject malformed schemas.
- **Verification**: Unit tests testing valid/invalid spec payloads.

### [TODO] BE-05: Tabular Synthetic Generation Engine
- **Goal**: Build CPU-safe synthesis engine combining distribution fitting, Faker semantics, random seed reproducibility, and column privacy controls (masking, hashing, noise).
- **Relevant Area**: `backend/app/engines/tabular.py`
- **Dependencies**: BE-04
- **Acceptance Criteria**: Generates synthetic rows matching target count and distributions. Identical seeds produce identical outputs.
- **Verification**: Statistical similarity tests and deterministic reproducibility assertions.

### [TODO] BE-06: Preview & Export API
- **Goal**: Endpoints to preview first $N$ rows and export full synthetic datasets as CSV and JSON.
- **Relevant Area**: `backend/app/api/generate.py`, `backend/app/api/export.py`
- **Dependencies**: BE-05
- **Acceptance Criteria**: `GET /api/v1/preview` returns paginated rows; `GET /api/v1/export/{format}` returns downloadable stream.
- **Verification**: API tests verifying returned content types and row counts.

### [TODO] BE-07: Statistical Quality Evaluation Module
- **Goal**: Compute statistical fidelity metrics (Kolmogorov-Smirnov, Wasserstein, Total Variation Distance, Correlation differences, overall quality score).
- **Relevant Area**: `backend/app/eval/quality.py`, `backend/app/api/evaluate.py`
- **Dependencies**: BE-05
- **Acceptance Criteria**: Returns composite fidelity score (0-100%) and per-column similarity metrics formatted for UI charts.
- **Verification**: Unit tests on known synthetic vs real distributions.

### [TODO] BE-08: TSTR ML Utility Evaluation Engine
- **Goal**: Implement Train on Synthetic, Test on Real pipeline comparing TRTR vs TSTR for classification/regression with retention score and leakage prevention.
- **Relevant Area**: `backend/app/eval/tstr.py`
- **Dependencies**: BE-05, BE-07
- **Acceptance Criteria**: Computes Accuracy/F1/ROC-AUC or MAE/RMSE/R²; gracefully reports when no supervised target exists.
- **Verification**: Evaluation test with churn (classification) and pricing (regression) benchmark data.

---

## Phase 2: Frontend Implementation (P0)

### [TODO] FE-01: Next.js Frontend Shell & Layout
- **Goal**: Initialize Next.js project with TypeScript, modern styling, and base layout shell.
- **Relevant Area**: `frontend/`
- **Dependencies**: SETUP-01
- **Acceptance Criteria**: Modern, responsive layout shell running locally with client navigation.
- **Verification**: `npm run build` succeeds without lint or type errors.

### [TODO] FE-02: Source Ingestion & Sample Dataset UI
- **Goal**: Build file dropzone (CSV/XLSX/JSON) and one-click demo dataset loaders.
- **Relevant Area**: `frontend/components/ingestion/`
- **Dependencies**: FE-01, BE-02
- **Acceptance Criteria**: Users can drop files or click sample datasets to trigger intake.
- **Verification**: Interactive UI test verifying file upload callbacks.

### [TODO] FE-03: Schema & Configuration Inspector
- **Goal**: UI panel displaying inferred schema, editable row count, random seed, null/outlier knobs, and privacy controls.
- **Relevant Area**: `frontend/components/configuration/`
- **Dependencies**: FE-01, BE-04
- **Acceptance Criteria**: Reactive controls allow updating generation parameters and column privacy settings.
- **Verification**: Component tests verifying configuration state updates.

### [TODO] FE-04: Generated Data Preview Canvas
- **Goal**: Interactive virtualized table displaying synthetic data rows with semantic chips and quick stats.
- **Relevant Area**: `frontend/components/preview/`
- **Dependencies**: FE-01, BE-06
- **Acceptance Criteria**: Smooth rendering of sample rows with column sorting and filtering.
- **Verification**: Visual rendering check on 1,000 preview rows.

### [TODO] FE-05: Statistical Quality Dashboard
- **Goal**: Visual dashboard rendering real vs synthetic distribution histograms, correlation heatmaps, and quality scores.
- **Relevant Area**: `frontend/components/quality/`
- **Dependencies**: FE-01, BE-07
- **Acceptance Criteria**: Charts visually present column fidelity and composite score clearly.
- **Verification**: Render dashboard with mock and live quality payloads.

### [TODO] FE-06: TSTR ML Utility Dashboard
- **Goal**: Dedicated card/dashboard showing side-by-side TRTR vs TSTR metrics, retention gauge, and target selector.
- **Relevant Area**: `frontend/components/tstr/`
- **Dependencies**: FE-01, BE-08
- **Acceptance Criteria**: Clearly conveys utility retention; handles no-target datasets gracefully.
- **Verification**: Render comparison cards for classification and regression states.

### [TODO] FE-07: Export & Error State Management
- **Goal**: Export trigger (CSV/JSON), loading skeletons, and error boundary toasts.
- **Relevant Area**: `frontend/components/common/`
- **Dependencies**: FE-01
- **Acceptance Criteria**: Downloads trigger cleanly; network/backend errors display informative fallbacks.
- **Verification**: Error injection testing (server offline, invalid payload).

---

## Phase 3: Integration, Deployment & QA (P0)

### [TODO] INT-01: End-to-End Frontend & Backend Integration
- **Goal**: Wire all frontend services to live backend endpoints with reactive state management.
- **Relevant Area**: `frontend/services/api.ts`
- **Dependencies**: BE-01 through BE-08, FE-01 through FE-07
- **Acceptance Criteria**: Complete flow: Upload $\to$ Configure $\to$ Generate $\to$ Preview $\to$ Quality $\to$ TSTR $\to$ Export works seamlessly.
- **Verification**: End-to-end browser execution test.

### [TODO] DEP-01: Deployment Configuration
- **Goal**: Production build configs, Dockerfile or Procfile for cloud hosting (e.g. Render / Hugging Face / Vercel).
- **Relevant Area**: `backend/Dockerfile`, `frontend/next.config.js`
- **Dependencies**: INT-01
- **Acceptance Criteria**: Both backend and frontend build successfully in production mode.
- **Verification**: Local container run and production build check.

### [TODO] QA-01: Final P0 Verification against Judging Criteria
- **Goal**: End-to-end verification of all P0 requirements and official judging criteria.
- **Relevant Area**: Whole repository
- **Dependencies**: DEP-01
- **Acceptance Criteria**: All P0 user journeys pass without unhandled errors.
- **Verification**: Automated test suite and manual verification checklist.

---

## Phase 4: Extended Capabilities (P1)

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
