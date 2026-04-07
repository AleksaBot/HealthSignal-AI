from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.report import Report
from app.models.session import SessionToken
from app.models.user import User
from app.schemas.analyze import AnalysisResponse, NoteInterpretRequest, RiskInsightRequest, SymptomAnalyzeRequest
from app.schemas.auth import AuthResponse, LoginRequest, SignupRequest
from app.schemas.report import ReportRead
from app.services.note_interpreter import interpret_note_text
from app.services.report_service import save_analysis_report
from app.services.risk_engine import evaluate_risk
from app.services.security import generate_session_token, hash_password, session_expiry, verify_password
from app.services.symptom_analyzer import analyze_symptoms_text

router = APIRouter(prefix="/api", tags=["healthsignal"])

DISCLAIMER = (
    "Educational decision support only. Not medical diagnosis. Consult a licensed clinician for medical decisions."
)


@router.get("/health")
def health_check():
    return {"status": "ok", "app_name": "HealthSignal AI API"}


@router.post("/auth/signup", response_model=AuthResponse)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(email=payload.email, hashed_password=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    token = generate_session_token()
    db.add(SessionToken(user_id=user.id, token=token, expires_at=session_expiry()))
    db.commit()

    return AuthResponse(token=token, user_id=user.id, email=user.email)


@router.post("/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = generate_session_token()
    db.add(SessionToken(user_id=user.id, token=token, expires_at=session_expiry()))
    db.commit()

    return AuthResponse(token=token, user_id=user.id, email=user.email)


@router.post("/analyze/symptoms", response_model=AnalysisResponse)
def analyze_symptoms(
    payload: SymptomAnalyzeRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    result = analyze_symptoms_text(payload.symptoms)
    report = save_analysis_report(
        db,
        user.id,
        "symptom-analyzer",
        payload.model_dump(),
        {**result, "disclaimer": DISCLAIMER}
    )
    return AnalysisResponse(**result, disclaimer=DISCLAIMER, report_id=report.id)


@router.post("/analyze/notes", response_model=AnalysisResponse)
def analyze_notes(payload: NoteInterpretRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = interpret_note_text(payload.note_text)
    report = save_analysis_report(db, user.id, "note-interpreter", payload.model_dump(), {**result, "disclaimer": DISCLAIMER})
    return AnalysisResponse(**result, disclaimer=DISCLAIMER, report_id=report.id)


@router.post("/analyze/risk", response_model=AnalysisResponse)
def analyze_risk(payload: RiskInsightRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = evaluate_risk(payload)
    report = save_analysis_report(db, user.id, "risk-form", payload.model_dump(), {**result, "disclaimer": DISCLAIMER})
    return AnalysisResponse(**result, disclaimer=DISCLAIMER, report_id=report.id)


@router.get("/reports", response_model=list[ReportRead])
def list_reports(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Report).filter(Report.user_id == user.id).order_by(Report.created_at.desc()).all()


@router.get("/reports/{report_id}", response_model=ReportRead)
def get_report(report_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id, Report.user_id == user.id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return report
