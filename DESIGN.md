# DESIGN.md — V2 product experience

Target design [PRODUCT-DECISION]; existing P0 UI remains usable during backend expansion.

- Entry: Upload CSV/JSON/JSONL/XLSX/Parquet, Describe with AI, Build Schema, or Sample.
- Review: editable tables/fields, semantic confidence, locale, row counts, PK/FK graph, cardinalities, target labels, business rules, edge cases and document outputs. AI proposals must be accepted before execution.
- Workspace: retain table preview/configuration/quality; add relational table navigator and document views backed by the same entities. Preview is bounded and paginated.
- Large operations: show job ID, stage, progress, cancellation and result artifacts. Queued/profiling/training/generating/validating/complete/failed/cancelled have explicit states. Progress estimates must be labelled.
- Upload guidance reports deployment limits and sampling coverage. Large XLSX failures explain CSV/Parquet conversion; no claim of unlimited uploads.
- AI availability explains fallback and retry delays without exposing credentials. Manual schemas and statistical generation remain available during outages.
- Engine selection: Statistical default, optional Deep only when available, AUTO recommendation with measured quality/utility/runtime/memory evidence.
- Quality dashboard prioritizes fidelity and export suitability for external TSTR. Internal TSTR is labelled development benchmarking with raw metrics and valid comparisons, not a claimed competition score.
- Invoice view exposes subtotal/tax/discount/total reconciliation. Statement view shows opening/running/closing balances and date filtering. Structured exports first, PDF later.
- Artifact expiry and cancellation explain what can still be downloaded. Downloads never require the full artifact in browser memory.
- Existing P0 API consumers retain their current workflow. V2 frontend wiring is a separately verified integration task.
