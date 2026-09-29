# PROJECT_STATE.md

## Current Phase
INTEGRATION — V2 backend milestones implemented; final integration blocked by local memory exhaustion.

## Active Task
V2-INTEGRATION FRONTEND WIRING COMPLETE (branch v2-integration, commit 36c4542).
All 7 features wired, tsc clean, browser-verified (offline state). Remaining: live backend end-to-end test (upload→ingest→review→generate→preview). See INTEGRATION_PROGRESS.md.

## Baseline
- P0 BE-01..08, FE-01..07 and INT-01 complete. Stable pushed fallback: a51edae5bd073e0b3f752c39eb6994f753baf4ce.
- Latest verified backend: 46 P0 + 3 environment tests passed; pip check passed. Python 3.12.10, google-genai 1.75.0.
- P0 synchronous APIs, canonical schema and leakage-safe TSTR remain protected. Prepared deployment/frontend changes are uncommitted and must be preserved.
- Root .env loading is optional and independent of cwd; production environment wins. No backend/.env is required.

## Decisions
- Target: Inputs → Ingestion → AI Understanding/Profiling → DatasetSpec → GenerationPlan → Engine Registry → Validation → Artifacts.
- Local disk artifacts and bounded jobs first; future S3/Postgres/worker adapters. Deployment-specific limits, no unlimited-scale claim.
- AI is first-class; deterministic generation remains available during outages. Relational/documents are required coverage, before optional deep synthesis.
- External TSTR is judging evaluation (organizer direction relayed by user); internal TSTR is engineering evidence. No formal privacy guarantees.
- Resource discipline: bounded workers and samples, no huge demonstration loads or concurrent deep training/tests/builds.

## Blockers / verification gaps
- 2026-09-30: OpenBLAS failed to allocate memory while importing the demo in a verification subprocess. OS check: ~768 MiB free physical memory, only ~116 MiB free committed memory. Stopped further tests/builds/training; did not terminate user applications. Free resources before resuming.
- 2026-09-30: Gemini live connectivity probe (via configured_router, one call): root .env exists, key_set=yes, model=models/gemini-2.5-flash. validation_passed=true, latency≈3812 ms, error_category=null. RESOLVED: GEMINI_MODEL corrected from non-existent gemini-2.0-flash to models/gemini-2.5-flash in root .env. Pydantic validation passed; AI router is live and functional.
- 2026-09-30: Paused rebase resolved onto faa8be3 (commit 4cc0a66) and cleanly pushed to origin/main. Frontend changes combined (including /v2 draft), backend preserved intact. `npx tsc --noEmit` passed with 0 errors. Backup branch backup-my-work retained. Root .env, .env.example, and frontend/.env.example verified ignored and uncommitted.
- Public deployment/live QA still await hosting access; prepared Render/Vercel configuration is not a deployed baseline.
- Browser automation previously failed initialization; recheck when frontend integration starts.

## Completed V2 modules
- V2-DOC: approved target, architecture, requirement provenance, work order and target UI documented.

- V2-FOUNDATION: disk artifacts, bounded single-worker jobs, raw streamed upload, batch CSV/JSON/JSONL/XLSX/Parquet readers, reservoir profiles and artifact retrieval. 57 backend tests pass. Async generation follows engine integration. Local jobs are not restart-durable; single backend process only.

- V2-AI: Gemini adapter + provider-neutral router implemented; six focused tests pass. Pool-wide 429 cooldown, invalid-key disabling/failover, retries and strict schema validation. No live API request; credentials unavailable in last preflight.

- V2-INTELLIGENCE: review-only prompt/spec and selective structural suggestions APIs; version-2 canonical schema carries relationships, targets, rules and documents. No row generation by AI; total outage returns manual/deterministic guidance.

- V2-QUALITY: registry, reviewed GenerationPlan, bounded statistical generation jobs and duplicate/exact-match diagnostics. Opt-in class-conditional fitting tested on nonlinear XOR; 18 focused tests pass. Full P0 behavior retained. Broader real-domain quality remains a gap.

- V2-RELATIONAL: DAG execution, 1:1/1:N and junction relationships, PK/FK validation and decimal reconciliation; two focused tests pass. Local execution uses bounded complete relational frames; not out-of-core.
- Quality evidence: seeded 1000-row XOR fixture: baseline macro-F1 0.52 vs conditional 1.00; zero exact matches/duplicates with continuous noise. This is engineering evidence only, not an external competition score or universal claim.

- V2-DOCUMENTS: structured invoice and bank-statement artifacts from same generated entities, Decimal arithmetic/date filtering; all 71 backend tests pass. PDF remains future work.

- V2-DEEP: optional CPU SDV adapter with isolated process timeout and row/cell/epoch limits. Disabled/uninstalled; one gate test passed, training test skipped. No measured deep-quality claims.

- V2-COMPARE: sequential comparison job and engine capability API. Evidence-based AUTO recommendation verified on XOR; deep engines explicitly unavailable. Memory field estimates DataFrame footprint only, not process peak.

## Latest verification boundary
- Full backend suite: 71 passed before final integration edits (includes all existing P0 tests).
- Later focused checks: deep gate 1 passed / 1 opt-in training skipped; comparison 1 passed. No deep installation/training occurred.
- Final source-fitted job wiring, artifact preview/ownership changes and frontend /v2 are not yet regression-verified. Frontend type check/build/browser checks and final pip check pending due memory blocker.
- git diff --check passes. All changes remain uncommitted; pre-existing deployment changes preserved. No claim of completed V2/client-grade readiness.
- Resume checklist and robustness review items are in TASKS.md. Root .env is optional local config; no secret values were printed.