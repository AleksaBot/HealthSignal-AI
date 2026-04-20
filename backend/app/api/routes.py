import hashlib
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.medication import MedicationLogStatus
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
from app.schemas.auth import (
    AuthActionResponse,
    AuthLoginRequest,
    AuthSignupRequest,
    AuthTokenResponse,
    EmailVerificationConfirmRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordConfirmRequest,
)
from app.schemas.health_profile import (
    HealthProfileRead,
    HealthProfileUpdateRequest,
    HealthRiskInsightsResponse,
    MedicationAdherenceUpdateRequest,
)
from app.schemas.symptom_intelligence import SymptomInput, SymptomIntakeUpdateRequest, SymptomIntakeUpdateResult

from app.schemas.report import ReportCreate, ReportRead, ReportSaveRequest
from app.schemas.user import UserEmailUpdateRequest, UserNameUpdateRequest, UserPasswordUpdateRequest, UserRead
from app.services.health_profile_service import (
    get_health_profile_for_user,
    update_health_profile_for_user,
    upsert_medication_adherence_for_today,
)
from app.services.health_risk_insights import build_health_risk_insights
from app.services.note_interpreter import answer_note_follow_up, interpret_note
from app.services.note_file_parser import FileParsingError, extract_text_from_upload
from app.services.report_service import (
    create_report as create_report_entry,
    create_report_for_analysis,
    create_report_from_saved_analysis,
)
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

EMAIL_VERIFICATION_TOKEN_TTL_HOURS = 24
PASSWORD_RESET_TOKEN_TTL_MINUTES = 30


def utc_now() -> datetime:
    return datetime.utcnow()


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def build_frontend_link(path: str, token: str) -> str:
    base = settings.app_public_base_url.strip().rstrip("/")
    if not base:
        return ""
    return f"{base}{path}?token={token}"


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

    verification_token = secrets.token_urlsafe(32)
    verification_expires_at = utc_now() + timedelta(hours=EMAIL_VERIFICATION_TOKEN_TTL_HOURS)

    user = User(
        first_name=payload.first_name,
        email=payload.email.lower(),
        hashed_password=hashed_password,
        email_verified=False,
        email_verification_token_hash=hash_token(verification_token),
        email_verification_sent_at=utc_now(),
        email_verification_expires_at=verification_expires_at,
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


@router.post("/auth/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    normalized_email = payload.email.lower()
    user = db.query(User).filter(User.email == normalized_email).first()
    token = secrets.token_urlsafe(32)
    dev_reset_link: str | None = None

    if user:
        user.password_reset_token_hash = hash_token(token)
        user.password_reset_sent_at = utc_now()
        user.password_reset_expires_at = utc_now() + timedelta(minutes=PASSWORD_RESET_TOKEN_TTL_MINUTES)
        db.add(user)
        db.commit()
        if settings.enable_dev_auth_link_preview:
            dev_reset_link = build_frontend_link("/auth/reset-password", token)
    elif settings.enable_dev_auth_link_preview:
        # Keep dev UX usable without leaking account existence through response shape.
        dev_reset_link = build_frontend_link("/auth/reset-password", token)

    return ForgotPasswordResponse(
        message="If an account exists for that email, a password reset link has been sent.",
        dev_reset_link=dev_reset_link,
    )


@router.post("/auth/reset-password", response_model=AuthActionResponse)
def reset_password(payload: ResetPasswordConfirmRequest, db: Session = Depends(get_db)):
    token_hash = hash_token(payload.token)
    user = db.query(User).filter(User.password_reset_token_hash == token_hash).first()
    now = utc_now()
    if not user or not user.password_reset_expires_at or user.password_reset_expires_at < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset link is invalid or expired")

    try:
        hashed_password = hash_password(payload.new_password)
    except PasswordValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    user.hashed_password = hashed_password
    user.password_reset_token_hash = None
    user.password_reset_sent_at = None
    user.password_reset_expires_at = None
    db.add(user)
    db.commit()

    return AuthActionResponse(message="Password updated successfully. Please sign in again.")


@router.post("/auth/verify-email", response_model=AuthActionResponse)
def verify_email(payload: EmailVerificationConfirmRequest, db: Session = Depends(get_db)):
    token_hash = hash_token(payload.token)
    user = db.query(User).filter(User.email_verification_token_hash == token_hash).first()
    now = utc_now()
    if not user or not user.email_verification_expires_at or user.email_verification_expires_at < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification link is invalid or expired")

    user.email_verified = True
    user.email_verification_token_hash = None
    user.email_verification_sent_at = None
    user.email_verification_expires_at = None
    db.add(user)
    db.commit()

    return AuthActionResponse(message="Email verified successfully. You can continue using your account.")


def _resend_verification(payload: ForgotPasswordRequest, db: Session) -> AuthActionResponse:
    normalized_email = payload.email.lower()
    user = db.query(User).filter(User.email == normalized_email).first()
    token = secrets.token_urlsafe(32)
    dev_verification_link: str | None = None

    if user and not user.email_verified:
        user.email_verification_token_hash = hash_token(token)
        user.email_verification_sent_at = utc_now()
        user.email_verification_expires_at = utc_now() + timedelta(hours=EMAIL_VERIFICATION_TOKEN_TTL_HOURS)
        db.add(user)
        db.commit()
        if settings.enable_dev_auth_link_preview:
            link = build_frontend_link("/auth/verify-email", token)
            dev_verification_link = link or None
    elif settings.enable_dev_auth_link_preview:
        link = build_frontend_link("/auth/verify-email", token)
        dev_verification_link = link or None

    return AuthActionResponse(
        message="If your account needs verification, a confirmation link has been sent.",
        dev_verification_link=dev_verification_link,
    )


@router.post("/auth/verification/resend", response_model=AuthActionResponse)
def resend_verification(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    return _resend_verification(payload, db)


@router.post("/auth/resend-verification", response_model=AuthActionResponse)
def resend_verification_legacy(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    return _resend_verification(payload, db)


@router.put("/auth/me/name", response_model=UserRead)
def update_current_user_name(
    payload: UserNameUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.first_name = payload.first_name
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/auth/me/email", response_model=UserRead)
def update_current_user_email(
    payload: UserEmailUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        validate_password_for_bcrypt(payload.current_password)
        password_is_valid = verify_password(payload.current_password, current_user.hashed_password)
    except PasswordValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not password_is_valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")

    normalized_email = payload.new_email.lower()
    existing_user = db.query(User).filter(User.email == normalized_email, User.id != current_user.id).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")

    current_user.email = normalized_email
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/auth/me/password", status_code=status.HTTP_204_NO_CONTENT)
def update_current_user_password(
    payload: UserPasswordUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        validate_password_for_bcrypt(payload.current_password)
        current_password_is_valid = verify_password(payload.current_password, current_user.hashed_password)
    except PasswordValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not current_password_is_valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")

    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password",
        )

    try:
        hashed_password = hash_password(payload.new_password)
    except PasswordValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    current_user.hashed_password = hashed_password
    db.add(current_user)
    db.commit()




@router.get("/profile/health", response_model=HealthProfileRead)
def get_health_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_health_profile_for_user(current_user, db)


@router.put("/profile/health", response_model=HealthProfileRead)
def update_health_profile(
    payload: HealthProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_health_profile_for_user(db=db, user=current_user, payload=payload)


@router.post("/profile/health/insights", response_model=HealthRiskInsightsResponse)
def generate_health_profile_insights(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = get_health_profile_for_user(current_user, db)
    if not profile.age or not profile.height_cm or not profile.weight_kg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Complete age, height, and weight in your Health Profile before generating insights.",
        )
    return build_health_risk_insights(profile)


@router.put("/profile/health/medications/today", response_model=HealthProfileRead)
def update_todays_medication_status(
    payload: MedicationAdherenceUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return upsert_medication_adherence_for_today(
            db=db,
            user=current_user,
            medication_external_id=payload.medication_id,
            status=MedicationLogStatus(payload.status),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/analyze/symptoms", response_model=AnalysisResponse)
def analyze_symptoms(
    payload: SymptomAnalyzeRequest,
    current_user: User = Depends(get_current_user),
):
    del current_user
    return analyze_symptoms_text(payload.symptoms)


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
    current_user: User = Depends(get_current_user),
):
    del current_user
    return interpret_note(payload.note_text)


@router.post("/analyze/note-file", response_model=NoteFileAnalysisResponse)
def analyze_note_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    del current_user
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
def create_report(
    payload: ReportCreate | ReportSaveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if isinstance(payload, ReportSaveRequest):
        return create_report_from_saved_analysis(db=db, user_id=current_user.id, payload=payload)

    report = create_report_entry(
        db=db,
        user_id=current_user.id,
        report_type=payload.report_type,
        input_payload=payload.input_payload,
        output_summary=payload.output_summary,
    )
    return report


@router.post("/reports/save", response_model=ReportRead, status_code=status.HTTP_201_CREATED)
def save_completed_report(
    payload: ReportSaveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_report_from_saved_analysis(db=db, user_id=current_user.id, payload=payload)


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
