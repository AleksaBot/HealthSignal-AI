from pydantic import BaseModel, Field

from app.schemas.common import DisclaimerMixin


class SymptomAnalyzeRequest(BaseModel):
    symptoms: str = Field(min_length=3, description="Plain-English symptom narrative")


class NoteInterpretRequest(BaseModel):
    note_text: str = Field(min_length=5, description="Doctor note or visit summary")


class RiskInsightRequest(BaseModel):
    age: int
    systolic_bp: int
    diastolic_bp: int
    fasting_glucose: float
    hba1c: float
    ldl_cholesterol: float


class AnalysisResponse(DisclaimerMixin):
    extracted_signals: list[str]
    red_flags: list[str]
    likely_categories: list[str]
    risk_insights: dict[str, str]
    reasoning: str
