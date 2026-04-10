from pydantic import BaseModel, Field

from app.schemas.common import DisclaimerMixin


class SymptomAnalyzeRequest(BaseModel):
    symptoms: str = Field(min_length=3, description="Plain-English symptom narrative")


class NoteInterpretRequest(BaseModel):
    note_text: str = Field(min_length=5, description="Doctor note or visit summary")


class RiskInsightRequest(BaseModel):
    age: int = Field(ge=0, le=120)
    systolic_bp: int = Field(ge=70, le=260)
    diastolic_bp: int = Field(ge=40, le=160)
    fasting_glucose: float = Field(ge=40, le=600)
    hba1c: float = Field(ge=3.0, le=20.0)
    ldl_cholesterol: float = Field(ge=20, le=400)


class AnalysisResponse(DisclaimerMixin):
    extracted_signals: list[str]
    red_flags: list[str]
    likely_categories: list[str]
    risk_insights: dict[str, str]
    reasoning: str


class NoteFileAnalysisResponse(AnalysisResponse):
    extracted_text: str
