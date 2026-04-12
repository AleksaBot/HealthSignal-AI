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
- **Data layer:** SQLite + SQLAlchemy
- **Auth model:** Token-based flow for protected app routes

## Local setup

### 1) Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Backend: `http://localhost:8000`

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
- Use start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- A starter `render.yaml` is included at the repository root.

### Required environment variables

Backend:
- `DATABASE_URL` (defaults to `sqlite:///./healthsignal.db` for local use)
- `SECRET_KEY` (set a strong random value in production)
- `JWT_ALGORITHM` (defaults to `HS256`)
- `FRONTEND_ORIGIN` or `ALLOWED_ORIGINS` for CORS (set to your deployed Vercel URL on Render; multiple origins can be comma-separated and local `localhost:3000` origins stay allowed for development)

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
