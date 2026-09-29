# Synthetic Data Platform (HackDataV2)

A general-purpose, schema-aware Synthetic Data Platform that generates realistic, privacy-safe tabular, relational, and business document data on demand.

---

## 1. What the Product Is

The platform solves data scarcity and compliance hurdles by producing high-fidelity synthetic structured data. Users can ingest sample files (CSV, XLSX, JSON), define schemas, or describe datasets in natural language. The system synthesizes realistic data preserving core distributions and relationships, validates statistical fidelity, and evaluates machine learning utility using **TSTR (Train on Synthetic, Test on Real)**.

---

## 2. High-Level Architecture

All inputs normalize into a central internal `DatasetSpec`. Modular synthesis engines consume this specification to generate data:
- **Tabular Engine (P0)**: Faithful statistical distributions, seed reproducibility, null/outlier injection, column privacy controls (masking, hashing, noise).
- **Relational Engine (P1)**: Multi-table DAG execution preserving primary/foreign key integrity and cross-table reconciliation.
- **Document Engine (P2)**: Financial document structures (invoices, bank statements) with mathematically reconciled balances.
- **Evaluation**: Side-by-side statistical similarity metrics and scikit-learn TSTR ML utility benchmarks.

---

## 3. Repository Structure

```
├── AGENTS.md            # Agent operational rules, lifecycle phases, and protocols
├── REQUIREMENTS.md      # Ground-truth requirements (Official PDF, Organizer, Product decisions)
├── ARCHITECTURE.md      # System architecture, Canonical DatasetSpec, and engines
├── DESIGN.md            # Screen layouts, workspace structure, and UI error states
├── TASKS.md             # Dependency-ordered task plan and acceptance criteria
├── PROJECT_STATE.md     # Current phase, active task, and architectural decisions
├── README.md            # Project overview and orientation
├── .env.example         # Environment variable template
├── backend/             # Python + FastAPI backend service (planned)
└── frontend/            # Next.js + React + TypeScript frontend (planned)
```

---

## 4. Key Documentation Links

- **Operational Rules**: [AGENTS.md](file:///e:/Synthetic%20Data%20Platform/AGENTS.md)
- **Requirements Specification**: [REQUIREMENTS.md](file:///e:/Synthetic%20Data%20Platform/REQUIREMENTS.md)
- **Architecture Design**: [ARCHITECTURE.md](file:///e:/Synthetic%20Data%20Platform/ARCHITECTURE.md)
- **UI / UX Design**: [DESIGN.md](file:///e:/Synthetic%20Data%20Platform/DESIGN.md)
- **Task Tracking**: [TASKS.md](file:///e:/Synthetic%20Data%20Platform/TASKS.md)
- **Current State**: [PROJECT_STATE.md](file:///e:/Synthetic%20Data%20Platform/PROJECT_STATE.md)
