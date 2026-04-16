from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

SymptomRiskLevel = Literal["low", "moderate", "high", "emergency"]


class SymptomInput(BaseModel):
    symptom_text: str = Field(min_length=3)


class ExtractedSymptomIntelligence(BaseModel):
    primary_symptoms: list[str] = Field(default_factory=list)
    duration: str | None = None
    severity: str | None = None
    location_body_area: str | None = None
    associated_symptoms: list[str] = Field(default_factory=list)
    red_flags: list[str] = Field(default_factory=list)


class SymptomRiskAssessment(BaseModel):
    risk_level: SymptomRiskLevel
    rationale: list[str] = Field(default_factory=list)


class FollowUpQuestion(BaseModel):
    prompt_text: str
    question_category: str
    priority: int = Field(ge=1, le=100)
    symptom_focus: str | None = None


class SymptomIntakeAnswer(BaseModel):
    prompt_text: str
    answer_text: str = Field(min_length=1)
    question_category: str | None = None


class SymptomAnswerPlan(BaseModel):
    categories: list[str] = Field(default_factory=list)
    triage_recommendation: str
    summary_points: list[str] = Field(default_factory=list)
    follow_up_questions: list[FollowUpQuestion] = Field(default_factory=list)


class SymptomIntakeSession(BaseModel):
    input: SymptomInput
    extracted: ExtractedSymptomIntelligence
    risk_assessment: SymptomRiskAssessment
    categories: list[str] = Field(default_factory=list)
    follow_up_questions: list[FollowUpQuestion] = Field(default_factory=list)
    asked_questions: list[str] = Field(default_factory=list)
    answers: list[SymptomIntakeAnswer] = Field(default_factory=list)
    current_depth: int = 0
    max_depth: int = 3
    is_complete: bool = False
    completion_reason: str | None = None


class SymptomIntakeUpdateRequest(BaseModel):
    session: SymptomIntakeSession
    new_answers: list[SymptomIntakeAnswer] = Field(default_factory=list)


class SymptomIntakeUpdateResult(BaseModel):
    session: SymptomIntakeSession
    answer_plan: SymptomAnswerPlan
