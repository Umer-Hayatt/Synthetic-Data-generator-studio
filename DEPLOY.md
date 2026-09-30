# Deployment Guide

**Stack**: FastAPI backend on [Render](https://render.com) · Next.js frontend on [Vercel](https://vercel.com)

---

## Prerequisites

- A GitHub account with this repo pushed (any branch — `main` or `v2-integration`)
- A [Render](https://render.com) account (free tier works)
- A [Vercel](https://vercel.com) account (free tier works)
- At least one Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

---

## Step 1 — Push the branch to GitHub

```bash
git push origin v2-integration
```

> If you want to deploy `main`, merge first:
> ```bash
> git checkout main
> git merge v2-integration
> git push origin main
> ```

---

## Step 2 — Deploy the backend on Render

### 2a. Create a new Web Service

1. Go to [render.com/dashboard](https://dashboard.render.com) → **New** → **Web Service**
2. Connect your GitHub repo
3. Render auto-detects `render.yaml` → click **Apply**  
   *(If not detected: set Root Directory = `backend`, Runtime = Python, Build = `pip install -r requirements.txt -c requirements-lock.txt`, Start = `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1`)*

### 2b. Set secret environment variables

In **Render dashboard → your service → Environment**, add:

| Variable | Value |
|---|---|
| `GEMINI_API_KEYS` | your key (comma-separated if multiple) |
| `GEMINI_MODEL` | `models/gemini-2.5-flash` (or your preferred model) |
| `CORS_ORIGINS` | *(leave blank for now — fill in after Vercel deploy in Step 3d)* |

### 2c. Deploy & get the backend URL

Click **Deploy** and wait for the health check to pass.  
Your backend URL will look like: `https://synthetic-data-studio-api.onrender.com`

> **Note (free tier)**: Render free services spin down after 15 minutes of inactivity.  
> The first request after a cold start takes ~30 s. This is normal.

---

## Step 3 — Deploy the frontend on Vercel

### 3a. Import the project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo
3. Set **Root Directory** to `frontend`
4. Framework is auto-detected as **Next.js**

### 3b. Set environment variables

In **Vercel → Project Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://synthetic-data-studio-api.onrender.com` (your Render URL from Step 2c) |

> IMPORTANT: This must be an `https://` URL without a trailing path. No `/api` suffix.

### 3c. Deploy

Click **Deploy** and wait for the build to complete.  
Your frontend URL will look like: `https://synthetic-data-studio.vercel.app`

### 3d. Update CORS on the backend

Back in **Render → Environment**, set:

| Variable | Value |
|---|---|
| `CORS_ORIGINS` | `https://synthetic-data-studio.vercel.app` |

Then **Manual Deploy → Deploy latest commit** to pick up the new CORS setting.

---

## Step 4 — Verify

1. Open your Vercel URL, e.g. `https://synthetic-data-studio.vercel.app/v2`
2. The backend online indicator in the header should show **green / connected**
3. Try **Load example** → review spec → **Generate** → download CSV

---

## Environment variable reference

### Backend (set in Render)

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEYS` | Yes for AI | — | Comma-separated Gemini API keys |
| `GEMINI_MODEL` | No | `models/gemini-2.5-flash` | Gemini model name |
| `CORS_ORIGINS` | Yes | `http://localhost:3000` | Comma-separated allowed origins |
| `CACHE_TTL_SECONDS` | No | `900` | Artifact TTL in seconds |
| `CACHE_MAX_BYTES` | No | `134217728` | Max artifact store size (128 MiB) |
| `MAX_UPLOAD_BYTES` | No | `15728640` | Max ingest file size (15 MiB on Render free) |
| `MAX_ROWS` | No | `50000` | Max rows per generation job |
| `MAX_COLUMNS` | No | `200` | Max columns per table |
| `MAX_CELLS` | No | `1000000` | Max cells per generation job |

### Frontend (set in Vercel)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Backend HTTPS origin, e.g. `https://...onrender.com` |

---

## Custom domain (optional)

- **Vercel**: Project Settings → Domains → Add your domain
- **Backend CORS**: Add the custom domain to `CORS_ORIGINS` (comma-separated) and redeploy

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Backend header shows "offline" | Render free tier cold start — wait 30 s and refresh |
| Generation fails with CORS error | Check `CORS_ORIGINS` on Render matches your Vercel URL exactly |
| Build fails on Vercel | Ensure `NEXT_PUBLIC_API_BASE_URL` is set and is an HTTPS URL |
| AI draft returns error | Check `GEMINI_API_KEYS` is set and valid in Render |
| Upload fails with 413 | `MAX_UPLOAD_BYTES` limit — reduce file size or increase the limit |
