# Backend

Python 3.12 recommended. From `backend/`:

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
- `POST /api/v1/evaluate/tstr` takes
  `{"reference_id":"<ingest token>","target":"churn","task":"classification","seed":42}`.
  `target` may be null; `task` is `auto`, `classification`, or `regression`.
  Returns `status: "ok"`, raw `trtr`/`tstr`, `comparison`, split row counts,
  target candidates, and model/split descriptions. Unsupported targets return
  HTTP 200 with `status: "unavailable"` and an actionable `reason`.
  Auto mode treats integral numeric targets with at most 20 values as classes;
  users can explicitly select regression. At least 20 observed targets are
  required. Missing-target rows are dropped and counted before splitting.
  Classification requires 2+ examples per class and enough test rows for all
  classes. ID-named features are excluded. Feature imputation and encoding are
  fitted separately on each training set; unknown test categories are allowed.

TSTR always performs a fresh 80/20 split and learns its synthesis spec from
REAL TRAIN only. It never uses the full-upload spec or a prior generated token.
Its synthetic row count equals REAL TRAIN. Both RandomForest pipelines have
the same parameters and evaluate the same REAL TEST. Classification reports
accuracy, macro F1, and ROC-AUC when valid; unavailable AUC is null with a reason.
Regression reports MAE, RMSE, and **R-squared (`r2`)**, following repository
requirements. Constant test targets yield null R-squared. Every comparison uses
`delta = TSTR - TRTR`; MAE/RMSE deltas indicate increased error when positive.
Only accuracy/F1/AUC may include `retention_ratio`, when the baseline is positive.
R-squared is allowed to be negative and has no retention ratio.

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
quality, TSTR, and export. Do not send full datasets back for these operations.
Treat 400 as an actionable input/capacity error, 404 as an expired/invalid token,
and 422 as structured request/spec validation errors. TSTR availability is a
payload state, not an HTTP error. Consult `/docs` for request schemas.

Verification: 46 tests passed on Python 3.12; `pip check` and module compilation
passed. The suite includes strict real-test isolation, binary/multiclass TSTR,
regression/negative R-squared, privacy controls, fidelity, malformed uploads,
request limits, token expiry, and preview/export integration. One non-failing
Starlette warning concerns its deprecated HTTPX test-client integration.

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
- `POST /api/v1/evaluate/tstr` takes
  `{"reference_id":"<ingest token>","target":"churn","task":"classification","seed":42}`.
  `target` may be null; `task` is `auto`, `classification`, or `regression`.
  Returns `status: "ok"`, raw `trtr`/`tstr`, `comparison`, split row counts,
  target candidates, and model/split descriptions. Unsupported targets return
  HTTP 200 with `status: "unavailable"` and an actionable `reason`.
  Auto mode treats integral numeric targets with at most 20 values as classes;
  users can explicitly select regression. At least 20 observed targets are
  required. Missing-target rows are dropped and counted before splitting.
  Classification requires 2+ examples per class and enough test rows for all
  classes. ID-named features are excluded. Feature imputation and encoding are
  fitted separately on each training set; unknown test categories are allowed.

TSTR always performs a fresh 80/20 split and learns its synthesis spec from
REAL TRAIN only. It never uses the full-upload spec or a prior generated token.
Its synthetic row count equals REAL TRAIN. Both RandomForest pipelines have
the same parameters and evaluate the same REAL TEST. Classification reports
accuracy, macro F1, and ROC-AUC when valid; unavailable AUC is null with a reason.
Regression reports MAE, RMSE, and **R-squared (`r2`)**, following repository
requirements. Constant test targets yield null R-squared. Every comparison uses
`delta = TSTR - TRTR`; MAE/RMSE deltas indicate increased error when positive.
Only accuracy/F1/AUC may include `retention_ratio`, when the baseline is positive.
R-squared is allowed to be negative and has no retention ratio.

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
quality, TSTR, and export. Do not send full datasets back for these operations.
Treat 400 as an actionable input/capacity error, 404 as an expired/invalid token,
and 422 as structured request/spec validation errors. TSTR availability is a
payload state, not an HTTP error. Consult `/docs` for request schemas.
