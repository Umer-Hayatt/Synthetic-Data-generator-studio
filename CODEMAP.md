# CODEMAP.md — One-line guide to where code lives

Keep this updated whenever a slice adds, moves, or deletes files.

## backend/app

| Path | What it does |
|---|---|
| `main.py` | FastAPI app factory; mounts all routers |
| **api/** | HTTP route handlers |
| `api/ingest.py` | Classic studio **upload/demo**: parses CSV/JSON, stores dataset in job store |
| `api/generate.py` | Classic studio **generate**: dispatches tabular/relational/document job |
| `api/intelligence.py` | **AI generator**: validates non-empty provider drafts, preserves prompt entity counts and flattens specs for tabular generation |
| `api/relationships.py` | Automatic AI build plus compatible analysis/normalization; atomic lossless tables from the snapshot |
| `api/evaluate.py` | Classic studio **quality**: triggers statistical evaluation |
| `api/export.py` | Classic studio **export**: returns CSV/JSON of generated rows |
| `api/documents.py` | **Document engine** routes: invoices, bank statements |
| `api/jobs.py` | Job polling, full artifact row pagination/filtering and downloads |
| `api/spec.py` | Returns persisted spec for the active job |
| `api/health.py` | `/health` liveness probe |
| **core/** | Shared utilities |
| `core/jobs.py` | In-memory **job store** (create, update, fetch) |
| `core/ai.py` | Gemini structured calls, deadlines, evidenced model quota/shared cooldown, retry durations and configured failover |
| `core/inference.py` | Schema inference (column types, nullable flags) |
| `core/relationship_analysis.py` | AI-owned model planning/correction, aggregate full-row dependencies and exact rejoin verification |
| `core/tabular_entities.py` | Retain observed upload dependencies and generate consistent repeated entities |
| `core/profiling.py` | Column statistics profiling |
| `core/locales.py` | Locale registry + curated data (PK/US/GB/DE/FR/ES/IN) |
| `core/config.py` | Environment settings (API keys, limits) |
| `core/store.py` | Lightweight KV store for artifacts |
| `core/artifacts.py` | Artifact serialisation helpers |
| `core/validation.py` | Shared Pydantic validators |
| `core/inspection.py` | Validates exact scalar filters for frame and artifact table inspection |
| `core/body_limit.py` | Request body-size middleware |
| **engines/** | Data-synthesis back-ends |
| `engines/tabular.py` | **Classic studio** tabular synthesiser (column-by-column) |
| `engines/relational.py` | **Relational engine**: multi-table PK/FK-consistent synthesis |
| `engines/documents.py` | **Document engine**: invoice/bank-statement generation |
| `engines/registry.py` | Resolves which engine to call for a given spec |
| `engines/deep.py` | Deep-copy / structural helpers for engine output |
| **models/** | Pydantic schemas |
| `models/spec.py` | Central DataSpec, ColumnSpec, JobSpec models |
| `models/relational_rules.py` | FK, cardinality, and referential-integrity rule models |
| `models/relationship_analysis.py` | Typed AI plans, relationship analysis, entity mappings and acceptance requests |
| **eval/** | **Quality evaluation** |
| `eval/quality.py` | Statistical similarity score (fidelity %) & reference-free spec quality |
| `eval/comparison.py` | Column-level comparison metrics |
| `eval/diagnostics.py` | Diagnostic helpers (nulls, ranges, uniqueness) |
| **adapters/** | External-format adapters (CSV/JSON normalisation) |

## frontend

| Path | What it does |
|---|---|
| `pages/index.tsx` | **Classic studio** root page (single workspace: tabular, relational, documents) |
| `pages/_app.tsx` | Next.js app wrapper; global styles |
| **components/ingestion/** | File upload, demo dataset selector & AI prompt generator (classic studio step 1) |
| **components/configuration/** | Schema/privacy editors (classic studio step 2) |
| **components/preview/** | Generated-data table preview (classic studio step 3) |
| **components/quality/** | Measured quality detail modal and charts |
| **components/schema/** | SchemaModal and PrivacyModal editors |
| `components/preview/DataWorkspace.tsx` | Unified single/multiple table inspection, full paging/exports, AI model explanation and linked-record lookup |
| `components/layout/Workspace.tsx` | One Data workspace; Documents view only for mapped document specs |
| `components/layout/WorkspaceInsights.tsx` | Real quality/privacy/integrity summary beside data, editor access and collapsed generation settings |
| `components/layout/Workspace.module.css` | Responsive unified table and insights layout |
| **components/documents/** | Reconciled documents workspace (invoices, bank statements, visual cards, PDF/ZIP/CSV/JSON export) |
| **components/layout/** | Page shell, unified workspace and adjacent insights |
| **components/common/** | Shared UI primitives (buttons, badges, loaders) |
| `services/api.ts` | Typed fetch wrappers for all backend endpoints |
| `services/v2.ts` | Typed fetch wrappers for AI/relational/document job endpoints |
| `services/relationalDemo.ts` | Multi-table relational and reconciled document demo models |
| `services/samples.ts` | Sample column presets |
| `services/qualityLabels.ts` | Quality score threshold and label definitions |
| `services/features.ts` | Feature flags |
| `types/` | Shared TypeScript interfaces mirroring backend schemas |
| `context/` | React context providers (job state, locale, spec) |
| `context/StudioContext.tsx` | Active source identity, model/generation revision, snapshot ownership and stale-response guards |
| `tests/studio-lifecycle.test.cjs` | Real React lifecycle tests for source replacement, stale jobs/results and tab preview invalidation |
| `benchmarks/workspace.cjs` | Frozen six-task React navigation experiment with complete selected-table export guards |

## backend/tests

| Path | What it does |
|---|---|
| `test_relationship_analysis.py` | Hybrid proposals, full-data conflicts, lossless joins, source ownership, exports and prompt/upload dependencies |
| `test_intelligence.py` | Prompt schema validation/failover, usable draft repair, entity count preservation and explicit offline fallback |
| `test_ai.py` | Provider failover/deadlines, quota scope and retry parsing, shared-key cooldown and cached quota errors |
| `test_inspection.py` | Complete frame/artifact paging and scalar linked-record filters, full CSV export, expired/document artifacts |
| `relational_fixture.py` | Self-contained fixture builder for existing relational engine regressions |
| `fixtures/commerce.json` | Historical minimal commerce model used only by regression tests |

## backend/benchmarks

| Path | What it does |
|---|---|
| `ai_output.py` | Fixed three-domain live AI draft/generation output benchmark, complete exports and independent relational fidelity gates |
