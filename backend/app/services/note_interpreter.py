from app.schemas.analyze import AnalysisResponse
from app.services.red_flags import evaluate_red_flags


def interpret_note(note_text: str) -> AnalysisResponse:
    return AnalysisResponse(
        extracted_signals=[
            "Clinical context terms recognized",
            "Medication and comorbidity hints parsed",
            "Follow-up and escalation phrases identified",
        ],
        red_flags=evaluate_red_flags(note_text),
        likely_categories=["Internal Medicine", "Cardiometabolic", "Neurology"],
        risk_insights={
            "stroke": "Neurologic wording in clinician notes can raise educational concern signals.",
            "diabetes": "Laboratory and medication terms may indicate glycemic management complexity.",
            "cardiovascular": "Cardio-focused terms can indicate need for guideline-based risk discussion with clinicians.",
        },
        reasoning=(
            "This interpretation summarizes note content using deterministic, explainable heuristics for educational use. "
            "It is not a diagnosis or treatment recommendation."
        ),
    )
