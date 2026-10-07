# Synthetic Data Generator Studio

Synthetic Data Generator Studio is a full-stack application for creating realistic synthetic datasets from uploaded data, validating data generation specs, evaluating output quality, and exporting results for downstream use.

The project combines a Python FastAPI backend with a Next.js frontend and is designed for data teams that need safe, controllable synthetic data generation without exposing raw source data.

## What this project includes

- Upload and profile CSV, JSON, JSONL, XLSX, and Parquet-style data sources
- Build and validate dataset generation specs
- Generate synthetic datasets with configurable rules and privacy controls
- Evaluate fidelity using statistical quality metrics
- Export generated data as CSV or JSON
- Deploy the API and frontend separately with Render + Vercel-friendly configs

## Repository structure

```text
.
├── backend/                  # FastAPI application and Python services
│   ├── app/                 # API app code
│   ├── tests/               # backend test suite
│   ├── requirements*.txt    # Python dependencies and lock files
│   ├── README.md            # backend-specific setup and API notes
│   └── pytest.ini           # pytest configuration
├── frontend/                # Next.js frontend application
│   ├── components/         # reusable UI components
│   ├── context/             # app context/state
│   ├── pages/               # Next.js pages
│   ├── services/            # frontend API integration helpers
│   ├── styles/              # styling assets
│   ├── package.json         # frontend scripts and dependencies
│   └── vercel.json          # Vercel deployment config
├── DEPLOY.md                # deployment guidance
├── PROJECT_STATE.md          # project status and verification notes
├── render.yaml              # Render deployment service definition
├── .gitignore               # repository ignore rules
└── README.md                # this file
```

## Tech stack

### Backend
- Python 3.12+
- FastAPI
- Pydantic
- Uvicorn
- Pandas / NumPy / SciPy
- scikit-learn
- Faker
- PyArrow / OpenPyXL / Python multipart
- Google GenAI (for provider-backed AI flows)

### Frontend
- Next.js 14
- React 18
- TypeScript
- Lucide React

## Getting started

### Prerequisites

- Python 3.12+
- Node.js 18+
- npm
- A terminal or shell environment

### Backend setup

From the repository root:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
python -m pip install -r requirements-dev.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The backend exposes API docs at `/docs` and `/openapi.json` when running.

### Frontend setup

From the repository root:

```bash
cd frontend
npm install
npm run dev
```

Then open:

- http://localhost:3000

## Core workflow

1. Upload a source dataset to the backend
2. Inspect the generated schema and summary metadata
3. Edit or validate a dataset specification
4. Generate a synthetic dataset
5. Run quality evaluations
6. Preview and export the final results


This project is intended to keep the raw source data in the trusted backend context while returning only schema, tokens, and generated outputs to the client.

## Environment and deployment notes

This repository includes deployment configuration for hosted environments:

- `render.yaml` configures a Python web service for the backend
- `frontend/vercel.json` is used for the Next.js frontend deployment setup
- `DEPLOY.md` contains additional deployment guidance

For production, set required environment variables such as:

- `CORS_ORIGINS`
- `GEMINI_API_KEYS`
- `GEMINI_MODEL`
- cache and upload limits related to generation and artifact handling

The backend README contains additional API and runtime details, including health checks, validation behavior, and token workflows.

## Important project notes

- The backend README in `backend/README.md` is the most detailed source for API contracts and local usage.
- The repository is structured around a Python API service plus a separate web frontend.
- The project includes support for both standard generation flows and V2-style job/artifact workflows, depending on the stage currently in use.

## Documentation references

- `backend/README.md` — backend usage and API behaviors
- `DEPLOY.md` — production deployment instructions
- `PROJECT_STATE.md` — repo status and verification notes
- `INTEGRATION_PROGRESS.md` — feature and integration tracking

## License

This repository does not currently document a license file in the root listing. If you intend to publish or distribute it publicly, add an explicit license before release.

## Contributing

Contributions are welcome. For any changes, prefer updating the relevant backend/frontend documentation alongside code changes so the project remains easy to run and maintain.
