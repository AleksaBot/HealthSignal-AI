# HealthSignal AI

HealthSignal AI is a full-stack clinical decision-support MVP built to transform everyday patient inputs into structured, explainable health insights. It is designed as a **portfolio-ready demonstration** of modern product thinking across UX, API design, and healthcare-safe communication.

> ⚠️ **Medical disclaimer:** This application is for educational support only. It is not a diagnostic system and must not replace clinical judgment, licensed care, or emergency services.

## Project overview

The platform helps users and clinicians-in-training quickly organize and interpret health information from three input modes:
- free-text symptom descriptions,
- clinical note text (or uploaded files), and
- structured risk-factor data.

The system then returns readable summaries with red-flag detection, likely condition categories, and interpretable risk guidance.

## Key features

- **Symptom Analyzer:** Converts plain-language symptom input into structured clinical signals.
- **Note Interpreter:** Accepts pasted notes and file uploads (PDF/image) for automated extraction + interpretation.
- **Risk Screener:** Produces stroke/diabetes/cardiovascular-oriented risk insights from structured inputs.
- **Report History:** Saves and reviews prior analyses with timestamps and detail payloads.
- **Explainable output style:** Keeps reasoning transparent and non-diagnostic for MVP safety.

## Tech stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS
- **Backend:** FastAPI, Python
- **Data layer:** SQLAlchemy ORM + Alembic migrations (PostgreSQL-ready via `DATABASE_URL`; SQLite-friendly for local dev)
- **Auth model:** Token-based flow for protected app routes

## Local setup

### 1) Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Backend: `http://localhost:8000`


#### Database configuration (`DATABASE_URL`)

The backend uses `DATABASE_URL` for both runtime DB connections and migrations:

- Local SQLite (default): `sqlite:///./healthsignal.db`
- Local PostgreSQL example: `postgresql+psycopg://postgres:postgres@localhost:5432/healthsignal`
- Managed PostgreSQL (Render/Neon/Supabase/etc): provider connection string using the `postgresql+psycopg://...` format

Example `.env` (backend):

```bash
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/healthsignal
SECRET_KEY=replace-me-with-a-long-random-secret
JWT_ALGORITHM=HS256
CORS_ORIGINS=http://localhost:3000,https://your-frontend.vercel.app,https://*.vercel.app
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
```

#### Migrations (Alembic)

Run from `backend/`:

```bash
# Apply all migrations
alembic upgrade head

# Create a new migration after schema changes
alembic revision -m "describe_change"

# (optional) auto-generate from SQLAlchemy models
alembic revision --autogenerate -m "describe_change"

# Roll back one migration
alembic downgrade -1
```

Schema changes are now migration-driven and include:
- `users`
- `reports`
- persistent medication records (`medications`)
- medication adherence logs (`medication_logs`)
- health profile JSON persistence fields on `users`

Medication Tracker V2 migration compatibility:
- Existing profile JSON medication data remains readable.
- On profile read/update, legacy medication entries are synchronized into relational medication tables to avoid data loss while moving toward a single durable source of truth.

#### Optional: train local ML intent-classifier artifact

The intent-classifier artifact is intentionally **not committed** to git.  
If you want to run ML intent comparison locally, generate it with:

```bash
cd backend
python scripts/train_intent_classifier.py --output data/intent_classifier.joblib
```

The app will fall back to rule-based intent classification if this file is missing.

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:3000`

## OCR and file upload support

The note upload endpoint supports:
- **text-based PDFs** (native extractable text), and
- **image files** (`png`, `jpg`, `jpeg`) via OCR.

For image OCR, **Tesseract OCR must be installed on your system** (e.g., `brew install tesseract` on macOS or `apt-get install tesseract-ocr` on Debian/Ubuntu). If unavailable, the API returns a safe, user-readable error.

## Deployment

### Frontend (Vercel)

- Deploy the `frontend/` project on Vercel.
- Set `NEXT_PUBLIC_API_URL` to your deployed backend base URL (for example, `https://your-backend.onrender.com`).

### Backend (Render)

- Deploy the `backend/` directory as a Python web service on Render.
- Use build command: `pip install -r requirements.txt`
- Use start command: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- A starter `render.yaml` is included at the repository root.
- Ensure `DATABASE_URL` points to a persistent managed PostgreSQL instance (not ephemeral local/temporary SQLite storage).

### Required environment variables

Backend:
- `DATABASE_URL` (recommended: PostgreSQL for persistent deployments; defaults to `sqlite:///./healthsignal.db` for local use)
- `SECRET_KEY` (set a strong random value in production)
- `JWT_ALGORITHM` (defaults to `HS256`)
- `CORS_ORIGINS` (recommended; comma-separated list of explicit origins and optional wildcards like `https://*.vercel.app` for preview deploys; localhost origins remain allowed by default). `ALLOWED_ORIGINS` and `FRONTEND_ORIGIN` are still supported as legacy aliases.
- `OPENAI_API_KEY` (optional for provider-backed note follow-up behavior)
- `OPENAI_MODEL` (defaults to `gpt-4o-mini`)
- `OPENAI_BASE_URL` (defaults to `https://api.openai.com/v1`)

Frontend:
- `NEXT_PUBLIC_API_URL` (the backend API base URL)

### OCR requirement in production

Image OCR for note parsing depends on system-level **Tesseract OCR**. Ensure the deployment environment includes Tesseract (`tesseract-ocr`) or image-based note parsing will fail.

## MVP limitations (current scope)

- Outputs are heuristic and educational, not clinically validated predictions.
- No EHR integrations or live hospital data connections.
- Minimal user/account profile model intended for MVP demonstration only.
- UI and analytics are intentionally lightweight to prioritize clarity and foundation quality.

## Screenshot guide (README assets)

Add screenshots to a future `docs/screenshots/` folder and wire them below when available.

- **Landing page** → `docs/screenshots/landing-page.png`
- **Login / Signup** → `docs/screenshots/auth-page.png`
- **Symptom Analyzer** → `docs/screenshots/symptom-analyzer.png`
- **Note Interpreter** → `docs/screenshots/note-interpreter.png`
- **Risk Screener** → `docs/screenshots/risk-screener.png`
- **Report History** → `docs/screenshots/report-history.png`

> Tip: keep screenshots consistent (desktop viewport, neutral test data, and no personal health information).
