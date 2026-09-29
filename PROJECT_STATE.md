# PROJECT_STATE.md

## Current Phase
PREPARATION

## Completed Tasks
- `SETUP-01`: Repository foundation established (documentation, architecture, requirements, tasks, Git initialized).

## Active Task
None (Awaiting user confirmation of foundation & planning before starting `BE-01`).

## Next Task
`BE-01`: FastAPI backend skeleton + health endpoint.

## Blockers
None.

## Key Architectural Decisions
1. **Canonical `DatasetSpec`**: Central intermediate schema representation for all data types (Tabular, Relational, Documents) and input adapters.
2. **CPU-Safe Lightweight Synthesis**: P0 uses standard distribution fitting and Faker algorithms; no GPU or PyTorch requirement for MVP.
3. **Strict TSTR Implementation**: Real train/test split with zero leakage; identical ML pipelines trained on real vs synthetic data and evaluated on untouched test set.
4. **Decoupled AI Layer**: Natural language parsing and edge-case injection are strictly non-blocking; core platform operates fully if AI is offline.
5. **Stateless Ephemeral Backend**: No persistent database or user authentication required for hackathon MVP.
