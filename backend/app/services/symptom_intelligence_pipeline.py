from __future__ import annotations

from app.schemas.symptom_intelligence import (
    ExtractedSymptomIntelligence,
    SymptomAnswerPlan,
    SymptomInput,
    SymptomIntakeSession,
)
from app.services.symptom_condition_matcher import match_condition_categories
from app.services.symptom_extractor import extract_symptom_intelligence
from app.services.symptom_follow_up_engine import generate_follow_up_questions
from app.services.symptom_risk_classifier import classify_symptom_risk

TRIAGE_RECOMMENDATIONS = {
    "emergency": "Seek emergency care now or call emergency services.",
    "high": "Urgent same-day in-person medical evaluation is recommended.",
    "moderate": "Prompt outpatient clinician follow-up is recommended.",
    "low": "Monitor symptoms and arrange routine clinical follow-up if not improving.",
}


def _build_summary_points(extracted: ExtractedSymptomIntelligence) -> list[str]:
    summary_points: list[str] = []
    if extracted.primary_symptoms:
        summary_points.append(f"Primary symptoms: {', '.join(extracted.primary_symptoms[:4])}.")
    if extracted.duration:
        summary_points.append(f"Duration noted: {extracted.duration}.")
    if extracted.severity:
        summary_points.append(f"Severity: {extracted.severity}.")
    if extracted.red_flags:
        summary_points.append(f"Red flags: {', '.join(extracted.red_flags[:3])}.")
    return summary_points


def build_symptom_answer_plan_from_extracted(
    *,
    symptom_input: SymptomInput,
    extracted: ExtractedSymptomIntelligence,
    max_depth: int = 3,
) -> tuple[SymptomAnswerPlan, SymptomIntakeSession]:
    risk = classify_symptom_risk(extracted)
    categories = match_condition_categories(extracted)
    follow_up_questions = generate_follow_up_questions(extracted, risk_level=risk.risk_level)

    plan = SymptomAnswerPlan(
        categories=categories,
        triage_recommendation=TRIAGE_RECOMMENDATIONS[risk.risk_level],
        summary_points=_build_summary_points(extracted),
        follow_up_questions=follow_up_questions,
    )

    session = SymptomIntakeSession(
        input=symptom_input,
        extracted=extracted,
        risk_assessment=risk,
        categories=categories,
        follow_up_questions=follow_up_questions,
        asked_questions=[],
        max_depth=max_depth,
    )
    return plan, session


def build_symptom_answer_plan(symptom_input: SymptomInput) -> tuple[SymptomAnswerPlan, dict[str, object]]:
    extracted = extract_symptom_intelligence(symptom_input.symptom_text)
    plan, session = build_symptom_answer_plan_from_extracted(symptom_input=symptom_input, extracted=extracted)

    return plan, {
        "extracted": session.extracted,
        "risk": session.risk_assessment,
        "categories": session.categories,
        "intake_session": session,
    }
