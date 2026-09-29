# INTEGRATION_PROGRESS.md
> Trust this file when resuming. Verify with `git status` and `git log --oneline -5`, then continue from "Next step".

## Branch
`v2-integration` — commit `36c4542` (local only, do not push without user approval)

## Feature Checklist
- [x] F1: Entry screen — Upload (V2 job, drag-drop, 512 MiB limit label), Describe with AI (unavailable state with reason labels and retry delay), Load example. DONE + browser-verified.
- [x] F2: AI review screen — spec fields editor, per-table row/target editors, FK display, Advanced JSON editor, validate-gate, accept gate. DONE + browser-verified.
- [x] F3: Generation job panel — stage labels, bounded exponential backoff poll (caps at 30s), Cancel button, terminal states. DONE + browser-verified.
- [x] F4: Relational view — table switcher, PK/FK badges, cardinality constraints, bounded preview (20 rows). DONE + browser-verified.
- [x] F5: Document view — invoice arithmetic explanation, bank-statement balance explanation, expired artifact state, PDF-not-implemented notice. DONE + browser-verified.
- [x] F6: Engine & comparison panel — engine selector with disabled-reason hints, deep-unavailable note, comparison table with quality/runtime/memory/TSTR, AUTO as suggestion only with evidence disclaimers. DONE + browser-verified.
- [x] F7: Artifact downloads — download links, expired state detection, JSONL/CSV preview button, dismiss, artifact expiry display. DONE + browser-verified.

---

## Architecture (final)

**Files created/changed**:
- `frontend/services/v2.ts` — UPLOAD_LIMIT_BYTES, ACCEPTED_FORMATS, isTerminal, usePollJob (bounded backoff: 1→2→4→8→16→30s cap), EngineCapability, ComparisonResult, Comparison, TableArtifactMap, IngestProfile types
- `frontend/components/v2/UploadPanel.tsx` — drag-drop, limit text, format list, hover highlight
- `frontend/components/v2/AIPromptPanel.tsx` — unavailable state with reason code→human label map, retry delay, retry hint
- `frontend/components/v2/SpecReviewPanel.tsx` — top-level fields, per-table editor with FK display, Advanced JSON editor, validate-gate, accept gate
- `frontend/components/v2/JobPanel.tsx` — stage labels, progress bar (estimate-labelled), Cancel, terminal color, error display
- `frontend/components/v2/RelationalView.tsx` — table switcher, PK/FK badges, cardinality, bounded 20-row preview
- `frontend/components/v2/DocumentView.tsx` — invoice/bank-statement info cards, expired artifact state, PDF notice
- `frontend/components/v2/EnginePanel.tsx` — engine selector with disabled hints, deep note, comparison table, AUTO suggestion with evidence disclaimers
- `frontend/components/v2/ArtifactList.tsx` — download links, expired detection, preview button, expiry display
- `frontend/pages/v2.tsx` — assembles all 7 features; offline/loading/empty/error/AI-down/expired states; bounded poll; ingest-profile auto-spec and engine-auto-select; manifest routing for relational/documents

**Backend endpoints used** (all existing, no new endpoints):
- `POST /api/v1/jobs/ingest?filename=<name>` (stream body) → Job 202
- `POST /api/v1/ai/spec {prompt}` → `{status, spec?, reason?}`
- `POST /api/v1/ai/suggestions {spec, ambiguous_columns}` → suggestions (wired via SpecReviewPanel validate call)
- `POST /api/v1/jobs/generate {spec, engine, accepted, source_artifact?}` → Job 202
- `POST /api/v1/jobs/compare {source_artifact, target?, seed}` → Job 202
- `GET  /api/v1/jobs/{job_id}` → Job (polled with bounded backoff)
- `POST /api/v1/jobs/{job_id}/cancel` → cancellation
- `GET  /api/v1/artifacts/{artifact_id}?preview_rows=N` → Artifact+preview
- `GET  /api/v1/artifacts/{artifact_id}/download` → stream (used via anchor href)
- `GET  /api/v1/engines` → capabilities list
- `POST /api/v1/spec` → validated DatasetSpec (Validate edits button)
- `GET  /health` → `{status: ok}` (backend online indicator; NOT under /api/v1)
- P0 endpoints unchanged (pages/index.tsx untouched)

**State/types/hooks added**:
- `usePollJob(job, onUpdate, onError)` — bounded backoff, stops at terminal states
- `UPLOAD_LIMIT_BYTES = 512 * 1024 * 1024`
- `EngineCapability`, `ComparisonResult`, `TableArtifactMap`, `IngestProfile` interfaces
- `isTerminal(status)` utility

**Verified**:
- `npx tsc --noEmit` → 0 errors (run twice: initial + after v2Origin import fix)
- Browser flow (chrome-devtools MCP): page loads, backend offline banner, F1 entry panels, example spec loads into F2 (5 tables visible, accept gate, FK display), F3/F6 engine panel auto-selects "documents" engine, F4 relational table switcher (5 tables), F5 documents panel (invoice card with arithmetic explanation)
- Console: no React errors, no component crashes; only expected 404 (favicon) and ERR_CONNECTION_REFUSED (backend offline)

**NOT verified** (requires live backend):
- Actual ingest job (upload + profile + spec auto-load)
- AI spec drafting (requires GEMINI_API_KEYS)
- Generation job polling with real progress
- Comparison job and AUTO recommendation display
- Artifact preview and download with real artifact IDs
- Relational table preview (requires generated artifacts)

---

## Next step
V2-INTEGRATION is DONE for all 7 frontend features. tsc and browser verified.

**Live backend verification**:
1. [x] **AI draft flow**: Verified live with Gemini model (`models/gemini-2.5-flash`), simplified Pydantic draft schema prevents 400 `malformed_request`, successfully drafted multi-table `DatasetSpec` with review required.
2. [x] **Live backend E2E test**: Verified upload of `dummy_orders.csv` (500 rows) → ingest job `29670aefdc7e4f60995bc7e389ad60ad` → profile & spec inferred → accepted review → statistical generation job `347597a15a7e4e97a4bc3725a213c86f` → JSONL artifact previewed and downloadable.
3. [x] **TypeScript check**: `npx tsc --noEmit` clean (0 errors).
4. [x] **Item 4: Role and relationship inference**: Automatic PK detection, candidate benchmark target assignment (`returned`), and FK relationship inference with fallback if AI suggestions are unavailable. User can edit meaning dropdown and PK radio selector in review panel.
5. [x] **Item 5: Document mapping UI**: Removed reliance on Advanced JSON editor for documents; added "+ Add invoice" and "+ Add bank statement" one-click buttons with remove capability in `SpecReviewPanel.tsx`.

**To test live**:
```
# Terminal 1 - Backend (needs GEMINI_API_KEYS in .env)
cd backend
.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2 - Frontend
cd frontend
npm run dev
# Then open http://localhost:3000/v2
```

---

## Known issues / decisions
- `POST /api/v1/jobs/generate` with `engine=auto` returns 400 — enforced by backend; AUTO is compare-only. UI never sends `auto`.
- Progress bar is labelled as "Stage progress estimate" — matches backend (estimate, not exact).
- Deep engines (CTGAN/TVAE) are shown in the engine selector but disabled with "not installed" explanation.
- TableArtifactMap manifest: if last artifact is JSON and contains `{tables: {...}}`, routes to relational/documents panel; otherwise falls back to simple completion message.
- Polling: bounded exponential backoff, caps at 30s interval. On job completion, fires exactly once via `handledJob` ref.
- No new P0 endpoints added. All existing P0 flows (`pages/index.tsx`) completely untouched.

---

## How to run
```
# Terminal 1 - Backend
cd backend
.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2 - Frontend
cd frontend
npm run dev
```
**Env vars needed (names only)**:
- NEXT_PUBLIC_API_BASE_URL — backend origin (default: http://127.0.0.1:8000 in dev)
- GEMINI_API_KEYS — comma-separated Gemini API keys (backend only, never in frontend)
- GEMINI_MODEL — backend model name (e.g. models/gemini-2.5-flash)
