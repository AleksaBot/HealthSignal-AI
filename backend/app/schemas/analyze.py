from pydantic import BaseModel, Field

from app.schemas.common import DisclaimerMixin


class SymptomAnalyzeRequest(BaseModel):
    symptoms: str = Field(min_length=3, description="Plain-English symptom narrative")


class NoteInterpretRequest(BaseModel):
    note_text: str = Field(min_length=5, description="Doctor note or visit summary")


class NoteFollowUpRequest(BaseModel):
    original_note_text: str = Field(min_length=5, description="Original uploaded or pasted note text")
    interpreted_note: str = Field(min_length=10, description="Serialized interpreted note context")
    question: str = Field(min_length=3, description="Patient follow-up question")


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


class TreatmentMention(BaseModel):
    item: str
    explanation: str


class MedicalTermExplanation(BaseModel):
    term: str
    plain_english: str


class NoteInterpretationResponse(DisclaimerMixin):
    plain_english_summary: str
    medicines_treatments: list[TreatmentMention]
    medical_terms_explained: list[MedicalTermExplanation]
    next_steps: list[str]
    follow_up_questions: list[str]


class NoteFileAnalysisResponse(NoteInterpretationResponse):
    extracted_text: str
    file_parse_method: str | None = None


class NoteFollowUpResponse(DisclaimerMixin):
    answer: str
