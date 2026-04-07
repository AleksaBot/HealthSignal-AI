from pydantic import BaseModel, Field

from app.schemas.common import DisclaimerMixin


class SymptomAnalyzeRequest(BaseModel):
    symptoms: str = Field(min_length=3, description="Plain-English symptom narrative")


class NoteInterpretRequest(BaseModel):
    note_text: str = Field(min_length=5, description="Doctor note or visit summary")


class RiskInsightRequest(BaseModel):
    age: int = Field(ge=1, le=120)
    systolic_bp: int = Field(ge=60, le=280)
    diastolic_bp: int = Field(ge=40, le=180)
    fasting_glucose: float = Field(ge=40, le=500)
    hba1c: float = Field(ge=3, le=20)
    ldl_cholesterol: float = Field(ge=10, le=400)


class AnalysisResponse(DisclaimerMixin):
    extracted_signals: list[str]
    red_flags: list[str]
    likely_categories: list[str]
    risk_insights: dict[str, str]
    reasoning: str
    report_id: int
