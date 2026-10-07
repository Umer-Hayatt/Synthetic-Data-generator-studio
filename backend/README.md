# Backend

Python 3.12 recommended. From `backend/`:

Local configuration loads from the repository-root `.env`, regardless of the
server's working directory. Existing process environment variables take precedence.
Production can use environment variables alone; no `.env` file is required.

```powershell
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt
.venv/Scripts/python -m uvicorn app.main:app --reload
.venv/Scripts/python -m pytest
```

`requirements-lock.txt` records the exact verified runtime/test environment;
install it instead of `requirements-dev.txt` to reproduce that environment.

Interactive API documentation: `/docs`; machine-readable contract: `/openapi.json`.
`GET /health` returns `{"status":"ok"}`.
Set `CORS_ORIGINS` to a comma-separated list of allowed frontend origins.
The default permits localhost and 127.0.0.1 on port 3000.

Upload with `POST /api/v1/ingest` (multipart field `file`). CSV uses UTF-8;
XLSX reads the first worksheet; JSON accepts record arrays or column arrays.
The response includes `row_count`, `columns`, `schema`, `spec`, and at most 20
preview records. `POST /api/v1/spec` validates and returns a client-held spec.
Validation errors use HTTP 422; invalid uploads use HTTP 400.

Limits are configured through `MAX_UPLOAD_BYTES` (15 MiB), `MAX_ROWS` (50,000),
`MAX_COLUMNS` (200), and `MAX_XLSX_EXPANDED_BYTES` (100 MiB).

The generator consumes DatasetSpec only. Uploaded data is summarized into
101 quantiles per numeric/date column, category frequencies, and a rank-based
Gaussian correlation matrix. Dependencies involving unordered categories are
approximate and depend on category ordering. Generic free text is generated
with Faker; real free-text examples are not replayed. Identity fields use Faker
or sequential IDs. Hard numeric bounds take precedence over outliers and noise.
Uniqueness constraints that cannot be satisfied fail explicitly.

Privacy controls are masking, SHA-256 hashing, and configurable Gaussian noise.
Mask/hash outputs are strings even for numeric input columns. These controls
do not provide formal differential privacy or guarantee resistance to
re-identification. Statistical metadata and categorical labels may be sensitive;
keep them in the same trusted client context as the input.

Generation/preview/export contract:

- `POST /api/v1/generate`: `{"spec": <DatasetSpec>, "preview_limit": 20}`.
  Returns `dataset_id`, `row_count`, `columns`, `preview`, `expires_in_seconds`.
- `GET /api/v1/preview?dataset_id=...&offset=0&limit=20`: returns `rows`,
  `row_count`, `columns`, `offset`, and `limit` (maximum 1,000).
- `GET /api/v1/export/csv?dataset_id=...` or `/export/json`: streamed download.
  Export accepts generated tokens only. JSON is a record array; nulls are JSON null.

Ingest also returns a reference `dataset_id`. Keep reference and generated IDs
separate. Tokens are opaque bearer capabilities; avoid logging/sharing them.
They expire after `CACHE_TTL_SECONDS` (default 900) and disappear on restart.
Missing/expired/wrong-kind tokens return 404. Re-upload/regenerate to recover.
Run one backend worker: scratch space is process-local, with no database.
`CACHE_MAX_BYTES` defaults to 128 MiB; exhausted capacity returns 400 without
evicting unexpired datasets. Expired entries are swept every 30 seconds.
`MAX_CELLS` defaults to 1,000,000 for uploaded/generated tables.

Evaluation contract:

- `POST /api/v1/evaluate/quality` takes
  `{"reference_id":"<ingest token>","generated_id":"<generation token>"}`.
  Returns per-column KS/Wasserstein or TVD/Jensen-Shannon metrics, histogram or
  category chart data, missing rates, Pearson matrices, and score components.
  `overall_score` is 100 times the mean of available distribution, missingness,
  and correlation components; the full formula is in `score_definition`.
  Show `distribution_columns_evaluated` alongside the score. If no distribution
  can be evaluated, `overall_score` is null and `score_status` is `unavailable`.
  Histograms use 12 shared bins; category charts show up to 50 categories while
  metrics use all categories. This score measures fidelity, not privacy.

Limitations: single-table P0 only; categorical dependencies are approximate;
outlier/null rates are sampling probabilities, not exact counts; inferred hard
bounds can clip injected outliers (edit/remove bounds to permit extremes).
Generation reproducibility assumes the same dependency versions and spec.
Quality comparisons for dates currently use categorical labels. Statistical
inference is heuristic and semantic confidence is advisory. No P1/P2, external
AI, database, authentication, GPU, or neural synthesizer is required.

For local startup from `backend/`:

```powershell
.venv/Scripts/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

Frontend handoff: upload, retain the reference token and editable spec, validate
edits with `/spec`, generate, retain the generated token, then request preview,
quality, and export. Do not send full datasets back for these operations.
Treat 400 as an actionable input/capacity error, 404 as an expired/invalid token,
and 422 as structured request/spec validation errors. Consult `/docs` for request schemas.


## V2 backend additions (integration verification pending)

P0 synchronous endpoints retain their bounded behavior. New routes:
- POST `/api/v1/jobs/ingest?filename=data.csv`: raw file bytes (not multipart), disk staging and background profile. Supports CSV/JSON/JSONL/XLSX/Parquet.
- POST `/api/v1/jobs/generate`: `{spec, engine, accepted: true, batch_rows?, source_artifact?}`. Review required. Statistical mode streams JSONL; relational/documents use a bounded local cell budget. Source-fitted engines require a source artifact and have narrower limits.
- POST `/api/v1/jobs/compare`: `{source_artifact, target?, seed?}`. Sequential bounded engineering benchmark with reviewed recommendation; no automatic deep selection.
- GET `/api/v1/jobs/{id}`; POST `/api/v1/jobs/{id}/cancel` (cooperative).
- GET `/api/v1/artifacts/{id}?preview_rows=10`; GET `/api/v1/artifacts/{id}/download`.
- GET `/api/v1/engines`; POST `/api/v1/ai/spec` with `{prompt}`; POST `/api/v1/ai/suggestions` with `{spec, ambiguous_columns}`. AI proposals do not execute generation.

Version 1 retains P0 row limits; version 2 supports larger reviewed job counts. Unsupported free-text business rules must be translated into typed reconciliation rules, not silently executed. N:N is represented by junction tables. Documents reuse the same generated entities; Decimal arithmetic uses half-up cents.

Defaults are documented in root `.env.example`. Artifacts default to ignored `backend/generated/artifacts`, have opaque IDs, quotas and retention. Job metadata is in memory and is lost on restart; use one backend process. This local adapter is not a shared multi-tenant deployment. Storage/metadata/worker adapters and production access controls remain future integration work.

PyArrow handles CSV/Parquet batches; ijson handles record-array JSON; JSONL limits individual records. XLSX has an expanded-size cap and conversion guidance. Profiles use seeded reservoirs with exact row/null counts; distributions are sampled. Local relational execution is bounded in memory, not larger-than-memory. Parquet oversized row groups and CSV type drift require source normalization. Per-record allocation limits still need hardening before untrusted large-file production use.

Gemini uses official google-genai, one SDK attempt per router attempt, validated Pydantic results, invalid-key disabling and shared-pool 429 cooldown. Additional provider implementations are not included. Keys in one pool are not treated as extra quota. Live Gemini credentials/model were not verified in this run.

Optional `requirements-deep.txt` is separate from normal dependencies. Deep engines remain disabled unless explicitly installed and ENABLE_DEEP_SYNTHESIS=true. CPU training is isolated and time/row/cell/epoch bounded; do not run it concurrently with full tests/builds. No deep benchmarks have run.

Verification stopped on 2026-09-30 due OS memory exhaustion/OpenBLAS failure. Latest full backend result: 71 passed before final integration edits; later focused deep gate 1 passed/1 skipped and comparison 1 passed. Final regressions/pip check/frontend build/browser verification remain required. See PROJECT_STATE.md and TASKS.md.
