# HealthSignal AI (MVP Scaffold)

HealthSignal AI is a full-stack health intelligence platform for **educational decision support** and **risk insights**.

> ⚠️ **Medical disclaimer**: This app is not a diagnosis tool. It does not provide medical certainty and should not replace clinical judgment or emergency services.

## Product scope

Users can:
- Enter symptoms in plain English
- Paste doctor notes / visit summaries
- Enter structured health data

The system returns:
- Extracted clinical signals
- Red-flag alerts
- Likely diagnostic categories
- Stroke / diabetes / cardiovascular risk insights
- Explainable reasoning
- Saved report history

## Tech stack

- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS
- **Backend:** FastAPI + Python
- **Database:** SQLite (SQLAlchemy)

## Repository layout

```text
HealthSignal-AI/
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── schemas/
│   │   └── services/
│   └── requirements.txt
└── README.md
```

## Quick start

### 1) Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Backend will run at `http://localhost:8000`.

### 2) Frontend setup

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend will run at `http://localhost:3000`.

## Available starter pages

- `/` (landing)
- `/dashboard`
- `/auth`
- `/symptom-analyzer`
- `/note-interpreter`
- `/risk-form`
- `/history`

## Backend API starter routes

- `GET /api/health`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/analyze/symptoms`
- `POST /api/analyze/notes`
- `POST /api/analyze/risk`
- `GET /api/reports`
- `GET /api/reports/{id}`

## MVP notes

- Analysis outputs use transparent modular services (`symptom_analyzer`, `note_interpreter`, `risk_engine`) and editable red-flag rules.
- Database schema includes `users`, `reports`, and `session_tokens` models with report-to-user linkage.
- This scaffold is designed for recruiter-quality readability and extension.
