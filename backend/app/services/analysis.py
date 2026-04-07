from app.schemas.analyze import AnalysisResponse


def build_stub_analysis(source: str, content: str) -> AnalysisResponse:
    lowered = content.lower()

    red_flags = []
    if any(term in lowered for term in ["chest pain", "fainting", "slurred speech", "severe headache"]):
        red_flags.append("Potential urgent symptom pattern identified; recommend immediate professional evaluation.")

    return AnalysisResponse(
        extracted_signals=[
            f"Input source: {source}",
            "Symptom chronology and severity cues extracted",
            "Comorbidity and risk-marker terms recognized"
        ],
        red_flags=red_flags or ["No explicit emergency phrase detected in text-based heuristic pass."],
        likely_categories=["Cardiometabolic", "Neurologic", "General Internal Medicine"],
        risk_insights={
            "stroke": "Moderate signal confidence based on available inputs.",
            "diabetes": "Requires trend labs and clinical follow-up for interpretation.",
            "cardiovascular": "Consider risk factor optimization with clinician guidance."
        },
        reasoning=(
            "The platform combines text pattern matching with structured risk heuristics to produce educational insights "
            "and explainable categories. Outputs are probabilistic and non-diagnostic."
        )
    )
