# REQUIREMENTS.md — Synthetic Data Platform

This document is the compressed working specification for the Synthetic Data Platform (HackDataV2). All requirements are classified into four strict categories:
- **[OFFICIAL-PDF]**: Authoritative requirements directly from the hackathon slide deck (`Synthetic Data Platform — HackDataV2.pdf`).
- **[ORGANIZER-PROVIDED]**: Official constraints/rules provided by competition organizers.
- **[PRODUCT-DECISION]**: Architectural and scoping decisions made to guarantee MVP delivery.
- **[STRETCH]**: High-value extensions implemented only if time permits.

---

## 1. Hackathon Judging Criteria & Vision

| Judging Criterion | [OFFICIAL-PDF] Delivery Expectation |
| :--- | :--- |
| **System Design** | Modular engine where tabular, relational, and document generators share one schema-aware pipeline. |
| **Features** | Unified platform generating tabular data, relational structures, and business documents (invoices, bank statements). |
| **UI** | Single no-code workspace to configure, live-preview, and export across all supported data types. |
| **AI** | AI infers schemas, synthesizes realistic text/names, and injects meaningful edge cases. |
| **Problem Approach**| Solves data scarcity and privacy constraints without ever exposing or leaking sensitive real records. |

---

## 2. Core Functional Requirements

### 2.1 Tabular Generation (P0 Core)
- **REQ-TAB-01 [OFFICIAL-PDF] Faithful Statistical Distributions**: Preserve numeric distributions, categorical frequencies, and correlation structures from ingested samples.
- **REQ-TAB-02 [OFFICIAL-PDF] Generation Controls**: Configurable row count, random seed (reproducible output), and explicit null / outlier generation rates.
- **REQ-TAB-03 [OFFICIAL-PDF] Privacy Controls**: Column-level privacy options including masking, hashing, and differential noise injection.
- **REQ-TAB-04 [PRODUCT-DECISION] Input Formats**: Support CSV, XLSX, and JSON file uploads.
- **REQ-TAB-05 [PRODUCT-DECISION] Automated Schema Inference**: Detect primitive types, null percentages, numerical bounds, and semantic data categories without requiring manual tagging.
- **REQ-TAB-06 [PRODUCT-DECISION] Built-in Demo Datasets**: Include pre-packaged datasets (Customer Churn, Loan Default, E-commerce) for immediate one-click testing.
- **REQ-TAB-07 [PRODUCT-DECISION] Export Formats**: Instant download in standard CSV and JSON table formats.

### 2.2 Statistical Quality Evaluation (P0 Core)
- **REQ-EVAL-01 [OFFICIAL-PDF] Statistical Fidelity Validation**: Validate synthetic fidelity against real data.
- **REQ-EVAL-02 [PRODUCT-DECISION] Comprehensive Metrics Suite**:
  - Global Quality Score (composite fidelity score).
  - Per-column distribution similarity (Wasserstein distance for continuous; Total Variation Distance / Chi-Square for categorical).
  - Column-pair correlation similarity (Pearson / Spearman correlation matrices difference).
  - Missing-value rate similarity comparison.
  - Data output formatted for direct rendering into frontend interactive charts.

### 2.3 ML Utility: TSTR Evaluation (P0 Core)
- **REQ-TSTR-01 [ORGANIZER-PROVIDED] Train on Synthetic, Test on Real**:
  1. Real dataset split into **Real Train** and an untouched **Real Test** set.
  2. Synthesizer fits exclusively on **Real Train** (no leakage from Real Test).
  3. Synthesizer generates **Synthetic Train** matching Real Train size.
  4. Train reference baseline model on **Real Train** → evaluate on **Real Test** (TRTR).
  5. Train identical ML model architecture on **Synthetic Train** → evaluate on untouched **Real Test** (TSTR).
- **REQ-TSTR-02 [ORGANIZER-PROVIDED] Metric Reporting**:
  - Classification tasks: Report Accuracy, Macro F1, and ROC-AUC (when binary/probabilistic).
  - Regression tasks: Report MAE, RMSE, and R².
  - Retention Score: Report Relative Utility Retention: $\text{Retention} = \frac{\text{Metric}_{TSTR}}{\text{Metric}_{TRTR}} \times 100\%$.
- **REQ-TSTR-03 [PRODUCT-DECISION] Graceful Target Degradation**: Automatically detect supervised target column candidates. If no valid ML target is selected or present, disable TSTR gracefully with an informative message while keeping statistical metrics fully active.

### 2.4 Canonical DatasetSpec (P0 Foundation)
- **REQ-SPEC-01 [PRODUCT-DECISION] Universal Internal Representation**: All input modalities (CSV, XLSX, JSON, Manual Schema, Natural Language) normalize into a single canonical `DatasetSpec` containing field types, distributions, constraints, and relationships.
- **REQ-SPEC-02 [PRODUCT-DECISION] Decoupled Execution**: Generation engines consume only the canonical `DatasetSpec`, keeping domain logic decoupled from storage formats.

### 2.5 AI Layer & Assistance (P1)
- **REQ-AI-01 [OFFICIAL-PDF] Schema Understanding**: Infer column types, formats, semantic roles, and table relationships directly from small samples without manual column-by-column mapping.
- **REQ-AI-02 [OFFICIAL-PDF] Realistic Content Synthesis**: Synthesize natural names, addresses, and free-text fields instead of repetitive machine stubs.
- **REQ-AI-03 [OFFICIAL-PDF] Edge-Case Injection**: Propose realistic null patterns, outlier values, and rare combinations to challenge downstream test suites.
- **REQ-AI-04 [PRODUCT-DECISION] Natural Language to DatasetSpec**: Convert free-form prompts (e.g., *"5000 university students with GPA, semester, attendance, and fee status"*) into a valid canonical `DatasetSpec`.
- **REQ-AI-05 [PRODUCT-DECISION] Graceful AI Fallback**: If LLM API is unavailable, unconfigured, or times out, the platform continues to operate fully using deterministic heuristics and Faker libraries. No LLM output may execute arbitrary server code.

### 2.6 Relational Data Generation (P1)
- **REQ-REL-01 [OFFICIAL-PDF] Multi-Table Integrity**: Enforce Primary Key (PK) and Foreign Key (FK) referential integrity across all generated child tables (e.g., Customers $\to$ Orders $\to$ Order Items).
- **REQ-REL-02 [OFFICIAL-PDF] Configurable Cardinalities**: Support explicit 1:1, 1:N, and N:N relationship distribution definitions.
- **REQ-REL-03 [OFFICIAL-PDF] Cross-Table Consistency**: Enforce derived business constraints across parent-child records (e.g., `Order.total` strictly equals the sum of its associated `OrderItem.price * OrderItem.qty`).

### 2.7 Document Generation (P2)
- **REQ-DOC-01 [OFFICIAL-PDF] Invoice Generation**: Generate invoice records with realistic line items, regional tax rules, and reconciled subtotals/totals.
- **REQ-DOC-02 [OFFICIAL-PDF] Bank Statements & Queries**: Generate sequential transaction histories with realistic merchant labels, chronological debits/credits, and mathematically continuous running balances.
- **REQ-DOC-03 [OFFICIAL-PDF] Query-Style Statement Generation**: Support declarative filtering constraints (e.g., *"transactions for the last 90 days with ending balance > $500"*).
- **REQ-DOC-04 [OFFICIAL-PDF] Document Export**: Provide structured exports (JSON/CSV) alongside structured document representations.

---

## 3. Non-Functional & Runtime Requirements

- **REQ-NF-01 [PRODUCT-DECISION] Ephemeral Processing**: Stateless server architecture. Uploaded files and generated datasets reside in memory/temporary scratch space and are cleaned up; no persistent database or user accounts required for MVP.
- **REQ-NF-02 [PRODUCT-DECISION] CPU-Safe Execution**: Core tabular generation must run efficiently on standard multi-core CPUs without requiring GPUs or heavy PyTorch/CUDA dependencies.
- **REQ-NF-03 [PRODUCT-DECISION] Deterministic Reproducibility**: Given an identical `DatasetSpec` and integer seed, generation outputs must match.
- **REQ-NF-04 [PRODUCT-DECISION] Response Limits**: Upload limit enforced at 15MB / 50,000 rows for real-time responsiveness on shared/free-tier hosting.

---

## 4. Stretch Requirements [STRETCH]

- **REQ-STR-01**: Parquet and XML file format ingestion and export.
- **REQ-STR-02**: Relational SQL DDL schema import and SQL INSERT dump export.
- **REQ-STR-03**: PDF rendering engine for generated invoices and bank statements.
- **REQ-STR-04**: Differential Privacy ($\epsilon$-DP) formal privacy score estimation and re-identification risk metrics.
