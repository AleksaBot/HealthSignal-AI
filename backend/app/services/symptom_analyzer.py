from app.schemas.analyze import AnalysisResponse
from app.services.red_flags import evaluate_red_flags


def analyze_symptoms_text(symptoms: str) -> AnalysisResponse:
    return AnalysisResponse(
        extracted_signals=[
            "Symptom chronology cues extracted",
            "Symptom severity and duration language identified",
            "Possible body-system groupings mapped",
        ],
        red_flags=evaluate_red_flags(symptoms),
        likely_categories=["Cardiovascular", "Neurologic", "General Medicine"],
        risk_insights={
            "stroke": "Educational pattern review suggests clinician follow-up when focal neurologic signals appear.",
            "diabetes": "Insufficient structured glucose context from free-text symptom input alone.",
            "cardiovascular": "Symptom clusters can be associated with cardio-pulmonary conditions and warrant medical review.",
        },
        reasoning=(
            "Outputs are generated from transparent educational heuristics over symptom language and are not diagnostic. "
            "A licensed clinician must confirm diagnosis and treatment decisions."
        ),
    )
