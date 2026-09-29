# PROJECT_STATE.md

## Current Phase
INTEGRATION & QA — Backend P0 and Frontend P0 (FE-01 through FE-07, INT-01) are complete and verified end-to-end.

## Completed Tasks
- `SETUP-01`: Repository foundation and architecture documentation.
- `BE-01` through `BE-08`: FastAPI foundation, bounded ingestion, schema inference,
  canonical DatasetSpec, seeded tabular synthesis, preview/export, statistical
  quality, and leakage-safe classification/regression TSTR.
- `FE-01` through `FE-07`: Next.js frontend shell, 3-column studio workspace, multi-format
  drag-and-drop ingestion, interactive sample datasets, schema inspector with column-level
  privacy controls, high-density data preview table, statistical quality evaluation dashboard
  with distribution overlays, and TSTR ML utility dashboard with metric-appropriate comparisons.
- `INT-01`: Full end-to-end integration between Next.js frontend and FastAPI backend.
- Verification: **46 backend tests passed**, Next.js production build (`npm run build`)
  succeeds cleanly, and end-to-end visual/functional browser testing verified.

## Active Task
`DEP-01`: Deployment configuration and production build verification.

## Next Task
`QA-01`: Final P0 verification against hackathon judging criteria.

## Blockers
None.

## Frontend Handoff
- See `backend/README.md` and `/docs` for endpoint contracts and startup commands.
- Retain separate reference and generated tokens; scratch data expires after
  15 minutes by default and is lost on restart. Use a single backend worker.
- TSTR performs a fresh real-train/test split and does not consume the full-data
  generation spec. Unavailable targets/metrics have explicit payload states.
- Quality scores can be null when no distribution comparison is possible;
  display score coverage and inspectable components.
- `frontend/` was not modified.

## Key Architectural Decisions
1. Canonical `DatasetSpec` remains the generation engine's only input.
2. P0 uses NumPy/SciPy Gaussian copula fitting and Faker; no SDV, GPU, or PyTorch.
3. TSTR fits synthesis and preprocessing only on training data; raw TRTR/TSTR
   metrics and metric-appropriate comparisons include R-squared without retention.
4. Mask/hash/noise are pragmatic privacy controls, not formal differential privacy.
5. Bounded in-memory token storage follows the documented ephemeral-session
   architecture; no database or authentication was introduced.
6. P0 is single-table; categorical dependencies are approximate, semantic inference
   is heuristic, and null/outlier rates are probabilities subject to hard bounds.
7. Relational generation, AI integration, and document engines remain deferred.
