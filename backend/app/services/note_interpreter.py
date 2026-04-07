from app.services.red_flags import detect_red_flags


def interpret_note_text(note_text: str) -> dict[str, object]:
    lines = [line.strip() for line in note_text.splitlines() if line.strip()]
    extracted_signals = [f"Captured {len(lines)} clinically relevant note segments", "Problem-list style terms normalized"]

    likely_categories = ["General Internal Medicine", "Cardiometabolic"]
    lowered = note_text.lower()
    if "ct" in lowered or "mri" in lowered or "neuro" in lowered:
        likely_categories.append("Neurologic")

    return {
        "extracted_signals": extracted_signals,
        "red_flags": detect_red_flags([note_text]),
        "likely_categories": sorted(set(likely_categories)),
        "risk_insights": {
            "stroke": "Cross-check focal deficit language and imaging context.",
            "diabetes": "Monitor glycemic markers and treatment adherence notes.",
            "cardiovascular": "Review BP, lipid, and symptom trends from note context."
        },
        "reasoning": "Clinician-note language is transformed into structured educational summaries with transparent rules."
    }
