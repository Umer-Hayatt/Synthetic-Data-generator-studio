# PROJECT_STATE.md

## Current Phase
IMPLEMENTATION

## Completed Tasks
- `SETUP-01`: Repository foundation established (documentation, architecture, requirements, tasks, Git initialized).

## Active Task
`BE-01`: FastAPI backend skeleton + health endpoint.

## Next Task
`BE-02`: Multi-format ingestion adapters (CSV / XLSX / JSON).

## Blockers
None.

## Key Architectural Decisions
1. **Canonical `DatasetSpec`**: Central intermediate schema representation for all data types (Tabular, Relational, Documents) and input adapters.
2. **CPU-Safe Lightweight Synthesis**: P0 uses standard distribution fitting and Faker algorithms; no GPU or PyTorch requirement for MVP.
3. **Strict TSTR Implementation**: Real train/test split with zero leakage; returns raw TRTR and TSTR metrics alongside metric-appropriate deltas (no universal retention ratio across all metrics).
4. **Pragmatic Column Privacy**: Masking, hashing, and configurable noise injection; formal $\epsilon$-differential privacy remains an optional stretch feature.
5. **Decoupled AI Layer**: Natural language parsing and edge-case injection are strictly non-blocking; core platform operates fully if AI is offline.
6. **Stateless Ephemeral Backend & Platform-Native Deployment**: No persistent database or auth required; deployment targets platform-native free-tier configs (Docker optional).
7. **Phased Milestone Discipline**: Tabular + Quality + TSTR secured first in P0; Relational (P1) and Documents (P2) are official challenge areas targeted immediately following P0.
