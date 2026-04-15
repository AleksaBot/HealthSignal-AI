from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

QuestionIntent = Literal[
    "medication",
    "symptoms",
    "warning_signs",
    "seriousness",
    "next_steps",
    "tests",
    "referrals",
    "definitions",
    "general",
]


class ExtractedNoteIntelligence(BaseModel):
    symptoms: list[str] = Field(default_factory=list)
    medications: list[str] = Field(default_factory=list)
    tests_ordered: list[str] = Field(default_factory=list)
    referrals: list[str] = Field(default_factory=list)
    follow_up_actions: list[str] = Field(default_factory=list)
    warning_signs: list[str] = Field(default_factory=list)
    diagnoses_or_conditions: list[str] = Field(default_factory=list)
    duration_or_timing: list[str] = Field(default_factory=list)


class AnswerPlan(BaseModel):
    intent: QuestionIntent
    can_answer_from_note: bool
    facts: list[str] = Field(default_factory=list)
    response_focus: str
    missing_message: str | None = None
