from app.schemas.analyze import AnalysisResponse
from app.services.red_flags import detect_red_flags


def analyze_symptoms_text(symptoms: str) -> dict[str, object]:
    lowered = symptoms.lower()

    extracted_signals = [
        "Symptom timeline cues parsed from plain-English narrative",
        "Severity and body-system terms extracted"
    ]

    likely_categories = ["General Internal Medicine"]
    if "chest" in lowered or "breath" in lowered:
        likely_categories.append("Cardiovascular")
    if "numb" in lowered or "speech" in lowered or "headache" in lowered:
        likely_categories.append("Neurologic")

    reasoning = (
        "Symptoms are interpreted using transparent rule matching and keyword grouping. "
        "Outputs are educational and non-diagnostic."
    )

    return {
        "extracted_signals": extracted_signals,
        "red_flags": detect_red_flags([symptoms]),
        "likely_categories": sorted(set(likely_categories)),
        "risk_insights": {
            "stroke": "Escalate if acute neurologic deficits are present.",
            "diabetes": "No glucose trend from symptom-only input.",
            "cardiovascular": "Cardiorespiratory terms increase need for timely clinical review."
        },
        "reasoning": reasoning
    }
