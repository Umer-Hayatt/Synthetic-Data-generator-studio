# ARCHITECTURE.md — V2 architecture

All inputs normalize into Canonical DatasetSpec. P0 synchronous contracts remain supported.
This is the approved target; TASKS.md and PROJECT_STATE.md distinguish implemented work.

Inputs → Ingestion → AI Understanding / Profiling → DatasetSpec → GenerationPlan → Engine Registry → Validation → Artifacts.

## Execution and storage [PRODUCT-DECISION]
- Preserve existing CSV/XLSX/JSON adapters and bounded synchronous endpoints.
- Large sources use disk staging, bounded batches and representative reservoir profiles. CSV, JSONL and Parquet are streaming priorities; JSON records use incremental parsing. Column-array JSON retains the bounded P0 path. XLSX is read-only, capped by expanded archive size with conversion guidance.
- Use PyArrow batch readers/Parquet first; introduce Polars/DuckDB only for measured benefit. A sample profile is explicitly approximate, never represented as a full-source fit.
- ArtifactStore owns opaque IDs, safe paths, atomic writes, metadata, quotas and expiry. LocalArtifactStore first; S3 adapters later.
- JobStore owns state/progress/stage/error/result artifact IDs. LocalJobExecutor has bounded queue/concurrency and cooperative cancellation; no unbounded worker creation. InMemoryJobStore is local-only, loses jobs on restart. Future Postgres and Redis/Celery/RQ adapters must not change synthesis.
- States: queued, profiling, training, generating, validating, complete, failed, cancelled. Terminal states are immutable. Partial outputs are removed on failure/cancellation. Expired artifacts/jobs are cleaned periodically; active inputs are protected.
- Limits are environment-specific: upload bytes, disk budget, batch rows, sample rows, generation rows/cells, worker/queue capacity, XLSX expansion and retention. Local resources are finite; no infinite-size claim.

## AI [PRODUCT-DECISION]
AIProvider exposes generate_structured, health, capabilities. AIRouter chooses configured providers and authorized credentials, applies concurrency caps, bounded retries, exponential backoff/jitter, Retry-After and cooldown/circuit breaking. Gemini uses official google-genai; SDK retries are disabled to avoid nested retry multiplication.
401/403 disable credentials; malformed requests do not retry; 429 cools the quota pool, not just a key. Keys in one provider pool do not imply extra quota. Failover may use another authorized independent provider. Timeouts/network/5xx are transient. Never log credentials, raw provider errors or dataset rows.
All outputs pass Pydantic validation. Suggestions/specifications require user review before generation. Deterministic inference handles high-confidence cases; only ambiguous metadata reaches AI. LLMs generate specifications/text, never bulk tables or accounting arithmetic. Non-AI generation survives total AI outage.
Root .env is optional local configuration; process environment wins. Secrets never enter artifacts or source control.

## Engines and plans [PRODUCT-DECISION]
GenerationPlan references DatasetSpec, engine, source artifact, batch size and requested outputs. Synthesizer exposes fit, generate, capabilities, metadata.
- StatisticalSynthesizer wraps the working CPU implementation; improvements require measured fidelity/utility evidence.
- RelationalSynthesizer enforces validated DAG order, PK/FK integrity, cardinalities and typed reconciliation rules. N:N uses junction tables. Unsupported/cyclic rules fail validation; no expression eval.
- DocumentSynthesizer derives invoices/statements from generated relational entities using decimal arithmetic; structured outputs precede PDF.
- DeepSynthesizer optionally uses SDV CTGAN/TVAE with CPU, row/cell/time safeguards. No unconditional torch import or automatic heavy installation. Deep work follows relational/documents.
- Comparison uses same leakage-safe splits/seeds, quality, TSTR, runtime and measured/estimated memory with labels. AUTO recommends from evidence, never from model complexity alone.

## API compatibility
Keep /api/v1/ingest, /spec, /generate, /preview, /export and /evaluate payloads working.
Add /api/v1/jobs/ingest, /jobs/generate, /jobs/{id}, /jobs/{id}/cancel and /artifacts/{id}[/download]. Large uploads stream directly to staging; job results are artifact references, not huge JSON responses. AI review endpoints are separate from execution.

## Evaluation
External TSTR is the judging evaluation (organizer direction relayed by user). Internal leakage-safe TRTR/TSTR remains an engineering benchmark; never train on held-out real test data. Measure marginals, mixed dependencies, missingness, target relationships, minority/rare combinations and duplicate/memorization indicators. Diagnostics are not formal privacy guarantees.

## Deployment boundaries
Single local backend worker initially; bounded background executor and local disk. Durable remote storage, persistent metadata, distributed execution and access control are future production adapters, not prerequisites for local use. Preserve prepared deployment files. No billing, organizations, Kubernetes, vector databases or RAG.
