from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.report import Report
from app.models.user import User
from app.schemas.analyze import (
    AnalysisResponse,
    NoteFileAnalysisResponse,
    NoteFollowUpRequest,
    NoteFollowUpResponse,
    NoteInterpretRequest,
    NoteInterpretationResponse,
    RiskInsightRequest,
    SymptomAnalyzeRequest,
)
from app.schemas.auth import AuthLoginRequest, AuthSignupRequest, AuthTokenResponse
from app.schemas.symptom_intelligence import SymptomInput, SymptomIntakeUpdateRequest, SymptomIntakeUpdateResult

from app.schemas.report import ReportCreate, ReportRead
from app.schemas.user import UserRead
from app.services.note_interpreter import answer_note_follow_up, interpret_note
from app.services.note_file_parser import FileParsingError, extract_text_from_upload
from app.services.report_service import create_report_for_analysis
from app.services.risk_engine import analyze_structured_risk
from app.services.security import (
    PasswordValidationError,
    create_access_token,
    get_current_user,
    hash_password,
    validate_password_for_bcrypt,
    verify_password,
)
from app.services.symptom_analyzer import analyze_symptoms_text
from app.services.symptom_intake_session import update_symptom_intake_session
from app.services.symptom_intelligence_pipeline import build_symptom_answer_plan

router = APIRouter(prefix="/api", tags=["healthsignal"])


@router.get("/health")
def health_check():
    return {"status": "ok", "app_name": settings.app_name}


@router.post("/auth/signup", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def auth_signup(payload: AuthSignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")

    try:
        hashed_password = hash_password(payload.password)
    except PasswordValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to process signup request",
        ) from exc

    user = User(
        first_name=payload.first_name,
        email=payload.email.lower(),
        hashed_password=hashed_password,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/auth/login", response_model=AuthTokenResponse)
def auth_login(payload: AuthLoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()

    try:
        validate_password_for_bcrypt(payload.password)
        password_is_valid = user is not None and verify_password(payload.password, user.hashed_password)
    except PasswordValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to process login request",
        ) from exc

    if not password_is_valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    return AuthTokenResponse(access_token=create_access_token(str(user.id)))


@router.get("/auth/me", response_model=UserRead)
def auth_me(current_user: User = Depends(get_current_user)):
    return current_user


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


@router.post("/analyze/symptoms/intake", response_model=SymptomIntakeUpdateResult)
def start_symptom_intake(payload: SymptomAnalyzeRequest, current_user: User = Depends(get_current_user)):
    del current_user
    answer_plan, intelligence = build_symptom_answer_plan(SymptomInput(symptom_text=payload.symptoms))
    return SymptomIntakeUpdateResult(session=intelligence["intake_session"], answer_plan=answer_plan)


@router.post("/analyze/symptoms/intake/update", response_model=SymptomIntakeUpdateResult)
def update_symptom_intake(payload: SymptomIntakeUpdateRequest, current_user: User = Depends(get_current_user)):
    del current_user
    return update_symptom_intake_session(payload)


@router.post("/analyze/notes", response_model=NoteInterpretationResponse)
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


@router.post("/analyze/note-file", response_model=NoteFileAnalysisResponse)
def analyze_note_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        extracted_text = extract_text_from_upload(file)
    except FileParsingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to parse the uploaded file at this time.",
        ) from None

    analysis = interpret_note(extracted_text)
    create_report_for_analysis(
        db=db,
        user_id=current_user.id,
        report_type="notes-file",
        input_payload={"filename": file.filename, "content_type": file.content_type},
        analysis=analysis,
    )
    parse_method = "pdf_text_extraction" if (file.content_type or "").lower() == "application/pdf" else "image_ocr"
    return NoteFileAnalysisResponse(extracted_text=extracted_text, file_parse_method=parse_method, **analysis.model_dump())


@router.post("/analyze/note-follow-up", response_model=NoteFollowUpResponse)
def analyze_note_follow_up(payload: NoteFollowUpRequest, current_user: User = Depends(get_current_user)):
    del current_user
    answer = answer_note_follow_up(payload.original_note_text, payload.interpreted_note, payload.question)
    return NoteFollowUpResponse(answer=answer)


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
