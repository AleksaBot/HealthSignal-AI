from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.report import Report
from app.schemas.analyze import AnalysisResponse, NoteInterpretRequest, RiskInsightRequest, SymptomAnalyzeRequest
from app.schemas.report import ReportCreate, ReportRead
from app.services.analysis import build_stub_analysis

router = APIRouter(prefix="/api", tags=["healthsignal"])


@router.get("/health")
def health_check():
    return {"status": "ok"}


@router.post("/analyze/symptoms", response_model=AnalysisResponse)
def analyze_symptoms(payload: SymptomAnalyzeRequest):
    return build_stub_analysis("symptoms", payload.symptoms)


@router.post("/analyze/notes", response_model=AnalysisResponse)
def analyze_notes(payload: NoteInterpretRequest):
    return build_stub_analysis("notes", payload.note_text)


@router.post("/analyze/risk", response_model=AnalysisResponse)
def analyze_risk(payload: RiskInsightRequest):
    structured_text = (
        f"age={payload.age}, sbp={payload.systolic_bp}, dbp={payload.diastolic_bp}, glucose={payload.fasting_glucose}, "
        f"hba1c={payload.hba1c}, ldl={payload.ldl_cholesterol}"
    )
    return build_stub_analysis("risk-form", structured_text)


@router.post("/reports", response_model=ReportRead)
def create_report(payload: ReportCreate, db: Session = Depends(get_db)):
    report = Report(**payload.model_dump())
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.get("/reports", response_model=list[ReportRead])
def list_reports(db: Session = Depends(get_db)):
    return db.query(Report).order_by(Report.created_at.desc()).all()
