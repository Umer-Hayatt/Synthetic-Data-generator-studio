# Current P0 deployment

Status: **prepared locally; not deployed**. No public URLs have been assigned or verified.
The stable pushed fallback is `a51edae5bd073e0b3f752c39eb6994f753baf4ce` on `main`:
https://github.com/Umer-Hayatt/Synthetic-Data-generator-studio

## Verified locally

- Backend: 46 tests passed, including real-test isolation, invalid input, and token expiry.
- `pip check`: no broken requirements. Runtime versions remain constrained by the existing `backend/requirements-lock.txt`.
- Frontend: Next.js 14.2.35 production build and `tsc --noEmit` passed. The sandboxed build initially encountered memory allocation failures; the normal host build passed.
- Uvicorn started with environment-provided port and `--workers 1`; `/health` returned `{"status":"ok"}`.
- CORS allowed `http://localhost:3000` and an explicitly configured HTTPS test origin; an unlisted origin was rejected. The actual Vercel origin must replace the test origin in hosting settings.
- Next.js production `/` returned 200 and an unknown route returned 404.
- No local filesystem paths were found in backend application code.

## Access blocker

Render credentials and Vercel CLI authentication are not configured. The connected
Vercel app returned no teams. Browser automation failed to initialize, so dashboard
sessions could not be inspected. Authenticate deployment tools locally or restore
connected hosting access; never put API credentials into repository files or chat.
Deployment configuration remains uncommitted until work resumes; the pushed fallback
is unchanged. Public deployment, HTTPS browser requests, and live QA remain unverified.

## Render backend

Import the repository as a Blueprint using root `render.yaml`, or create a Python
web service with the equivalent settings:

| Setting | Value |
| --- | --- |
| Plan | Free |
| Root directory | `backend` |
| Python | `3.12.10` |
| Build | `pip install -r requirements.txt -c requirements-lock.txt` |
| Start | `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1` |
| Health check | `/health` |
| Instances/workers | One instance, one worker |

Render supplies `PORT`; do not hardcode it. Set `CORS_ORIGINS` to
`http://localhost:3000,https://<actual-production-frontend-host>` without wildcard
origins or URL paths. The Blueprint prompts for this value. Keep limits unchanged:

| Environment variable | Value |
| --- | --- |
| `CACHE_TTL_SECONDS` | `900` |
| `CACHE_MAX_BYTES` | `134217728` |
| `MAX_UPLOAD_BYTES` | `15728640` |
| `MAX_ROWS` | `50000` |
| `MAX_COLUMNS` | `200` |
| `MAX_CELLS` | `1000000` |
| `OPENBLAS_NUM_THREADS`, `OMP_NUM_THREADS`, `MKL_NUM_THREADS` | `1` |

After publishing, verify `https://<backend-host>/health` before deploying the frontend.

## Vercel frontend

Import the same GitHub repository, set Root Directory to `frontend`, and use the
Next.js preset. `frontend/vercel.json` specifies `npm ci` and `npm run build`.
Set `NEXT_PUBLIC_API_BASE_URL` to the backend HTTPS origin **before building**.
The public environment variable is compiled into the browser bundle; changing it
requires rebuilding/redeploying. No API path suffix, credentials, or query string.
The former `NEXT_PUBLIC_API_URL` variable is no longer read.

Once the frontend production domain is assigned, set Render's exact CORS allowlist
to localhost plus that domain and verify the preflight from the actual frontend.
Preview deployment domains are not automatically allowed.

## Remaining live verification

- Public backend health and actual frontend-origin CORS preflight.
- Real sample/upload request, inferred schema, generation, synthetic preview,
  quality evaluation, selected-target TSTR, and CSV/JSON downloads with correct counts.
- Verify separate reference/generated tokens in requests; do not count the existing
  offline sample fixture as a successful backend integration test.
- Invalid upload, network failure/offline state, expired-token recovery, refresh,
  and navigation in the deployed browser.
- Record actual URLs and deployed commit, mark DEP-01/QA-01 complete only after their
  checks pass, and commit/push only the deployment/configuration fixes and state docs.

## Free-tier limitations

Render Free services spin down after 15 minutes without inbound traffic and can take
about a minute to wake. Free instance hours, bandwidth, and build minutes are limited.
See [Render Free documentation](https://render.com/docs/free).
The 900-second dataset TTL is separate from hosting idle timeout. Memory-only sessions
disappear on restart, redeploy, or instance shutdown. Tokens cannot be shared across
workers/instances, so do not increase worker count or add replicas. Keep reference and
generated tokens separate. Large datasets within input limits may still exceed available
free-tier memory during processing; do not increase limits without measurement.

Platform references: [Render FastAPI](https://render.com/docs/deploy-fastapi),
[Render Blueprint specification](https://render.com/docs/blueprint-spec).
