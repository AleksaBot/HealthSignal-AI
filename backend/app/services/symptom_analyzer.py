from __future__ import annotations

from app.schemas.analyze import AnalysisResponse
from app.schemas.symptom_intelligence import SymptomInput
from app.services.symptom_intelligence_pipeline import build_symptom_answer_plan


def analyze_symptoms_text(symptoms: str) -> AnalysisResponse:
    plan, intelligence = build_symptom_answer_plan(SymptomInput(symptom_text=symptoms))
    extracted = intelligence["extracted"]
    risk = intelligence["risk"]

    extracted_signals = [
        f"Primary symptoms: {', '.join(extracted.primary_symptoms) or 'none detected'}.",
        f"Duration: {extracted.duration or 'not clearly specified'}.",
        f"Severity: {extracted.severity or 'not clearly specified'}.",
        f"Body area: {extracted.location_body_area or 'not clearly specified'}.",
    ]

    return AnalysisResponse(
        extracted_signals=extracted_signals,
        red_flags=extracted.red_flags or ["No explicit red-flag term detected in this rule-based pass."],
        likely_categories=plan.categories,
        risk_insights={
            "overall_risk": risk.risk_level,
            "triage": plan.triage_recommendation,
            "rationale": " ".join(risk.rationale),
            "follow_up_questions": " | ".join(question.prompt_text for question in plan.follow_up_questions),
        },
        reasoning=(
            "Outputs are generated from deterministic extraction, rules-based risk classification, condition-category matching, "
            "and guided follow-up question generation. This educational pipeline is non-diagnostic and requires clinician confirmation."
        ),
    )
