from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.report import Report
from app.models.user import User
from app.schemas.analyze import AnalysisResponse, NoteInterpretRequest, RiskInsightRequest, SymptomAnalyzeRequest
from app.schemas.auth import AuthLoginRequest, AuthSignupRequest, AuthTokenResponse

from app.schemas.report import ReportCreate, ReportRead
from app.schemas.user import UserRead
from app.services.note_interpreter import interpret_note
from app.services.report_service import create_report_for_analysis
from app.services.risk_engine import analyze_structured_risk
from app.services.security import create_access_token, get_current_user, hash_password, verify_password
from app.services.symptom_analyzer import analyze_symptoms_text

router = APIRouter(prefix="/api", tags=["healthsignal"])


@router.get("/health")
def health_check():
    return {"status": "ok", "app_name": settings.app_name}


@router.post("/auth/signup", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def auth_signup(payload: AuthSignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")

    user = User(email=payload.email.lower(), hashed_password=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/auth/login", response_model=AuthTokenResponse)
def auth_login(payload: AuthLoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    return AuthTokenResponse(access_token=create_access_token(str(user.id)))


@router.post("/analyze/symptoms", response_model=AnalysisResponse)
def analyze_symptoms(
    payload: SymptomAnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    analysis = analyze_symptoms_text(payload.symptoms)
    create_report_for_analysis(
        db=db,
        user_id=current_user.id,
        report_type="symptoms",
        input_payload=payload.model_dump(),
        analysis=analysis,
    )
    return analysis


@router.post("/analyze/notes", response_model=AnalysisResponse)
def analyze_notes(
    payload: NoteInterpretRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    analysis = interpret_note(payload.note_text)
    create_report_for_analysis(
        db=db,
        user_id=current_user.id,
        report_type="notes",
        input_payload=payload.model_dump(),
        analysis=analysis,
    )
    return analysis


@router.post("/analyze/risk", response_model=AnalysisResponse)
def analyze_risk(
    payload: RiskInsightRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    analysis = analyze_structured_risk(payload)
    create_report_for_analysis(
        db=db,
        user_id=current_user.id,
        report_type="risk-form",
        input_payload=payload.model_dump(),
        analysis=analysis,
    )
    return analysis


@router.post("/reports", response_model=ReportRead, status_code=status.HTTP_201_CREATED)
def create_report(payload: ReportCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = Report(
        user_id=current_user.id,
        report_type=payload.report_type,
        input_payload=payload.input_payload,
        output_summary=payload.output_summary,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.get("/reports", response_model=list[ReportRead])
def list_reports(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(Report)
        .filter(Report.user_id == current_user.id)
        .order_by(Report.created_at.desc())
        .all()
    )


@router.get("/reports/{report_id}", response_model=ReportRead)
def get_report(report_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = (
        db.query(Report)
        .filter(Report.id == report_id, Report.user_id == current_user.id)
        .first()
    )
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return report
