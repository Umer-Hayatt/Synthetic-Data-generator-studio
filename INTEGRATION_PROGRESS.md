# INTEGRATION_PROGRESS.md
> Trust this file when resuming. Verify with `git status` and `git log --oneline -5`, then continue from "Next step".

## Branch
`v2-integration` (local only, do not push or merge to main without user approval)

## Feature Checklist
- [~] F1: Entry screen — Upload (V2 job), Describe with AI, Sample. Upload limits. IN PROGRESS.
- [ ] F2: AI review screen — prompt to spec, edit tables/fields/keys/targets/rules, explicit Accept gate
- [ ] F3: Generation job panel — stage/progress (estimate label)/Cancel/poll with bounded backoff
- [ ] F4: Relational view — table switcher, PK/FK, cardinalities, bounded paginated preview
- [ ] F5: Document view — invoice reconciliation, bank statement balances, date filter
- [ ] F6: Engine and comparison panel — capabilities, deep=unavailable, AUTO as suggestion with evidence
- [ ] F7: Artifact downloads — download buttons, expiry/cancelled messages

---

## Architecture Decision

**Approach**: The existing `/v2` page (pages/v2.tsx) is already a functional draft covering all 7 features in a single monolith. Integration will:
1. Break the monolith into focused sub-components under components/v2/ so each feature is independently checkpointed.
2. Keep P0 pages/index.tsx and all its components completely untouched.
3. Refactor services/v2.ts to add the missing bounded polling hook and upload-limit display.
4. All V2 components co-located in components/v2/ and styles/v2.module.css (extended).

**Backend endpoints confirmed from source**:
- POST /api/v1/jobs/ingest?filename=<name> (stream body) -> Job 202
- POST /api/v1/ai/spec {prompt} -> {status, spec?, reason?}
- POST /api/v1/ai/suggestions {spec, ambiguous_columns} -> suggestions
- POST /api/v1/jobs/generate {spec, engine, accepted, source_artifact?} -> Job 202
- POST /api/v1/jobs/compare {source_artifact, target?, seed} -> Job 202
- GET  /api/v1/jobs/{job_id} -> Job status
- POST /api/v1/jobs/{job_id}/cancel -> cancellation
- GET  /api/v1/artifacts/{artifact_id}?preview_rows=N -> Artifact+preview
- GET  /api/v1/artifacts/{artifact_id}/download -> stream
- GET  /api/v1/engines -> capabilities list
- POST /api/v1/spec -> validated DatasetSpec
- P0 endpoints unchanged

**Upload limit**: JOB_UPLOAD_BYTES=536870912 (512 MiB) shown as "512 MiB max".

---

## F1: Entry Screen [~] IN PROGRESS

### Files to create/change
- frontend/components/v2/UploadPanel.tsx
- frontend/components/v2/AIPromptPanel.tsx
- frontend/components/v2/SamplePanel.tsx
- frontend/services/v2.ts — add UPLOAD_LIMIT_BYTES constant and usePollJob hook
- frontend/pages/v2.tsx — refactored to use sub-components

### NOT verified
- tsc not yet run; browser not yet tested

---

## Next step
1. Add UPLOAD_LIMIT_BYTES and usePollJob bounded-backoff hook to services/v2.ts.
2. Create components/v2/UploadPanel.tsx with limit text.
3. Create components/v2/AIPromptPanel.tsx with AI unavailable state.
4. Create components/v2/SamplePanel.tsx.
5. Refactor pages/v2.tsx to use sub-components with all states (offline, loading, error, empty, AI-unavailable).
6. Run npx tsc --noEmit from frontend/. Fix errors. Checkpoint commit.

---

## Known issues / decisions
- Draft v2.tsx polls at fixed 1s — replaced by bounded exponential backoff in usePollJob.
- Draft does not show deployment upload limit — F1 will add this.
- POST /api/v1/jobs/generate with engine=auto returns 400 — enforced, AUTO is compare-only.
- POST /api/v1/spec is the spec validation endpoint (backend/app/api/spec.py).

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
