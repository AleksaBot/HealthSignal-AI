from __future__ import annotations

from app.schemas.symptom_intelligence import ExtractedSymptomIntelligence

CATEGORY_RULES: list[tuple[set[str], str]] = [
    ({"headache", "dizziness", "light sensitivity"}, "neurological/headache"),
    ({"chest pain", "shortness of breath"}, "cardiovascular/respiratory"),
    ({"abdominal pain", "nausea"}, "GI/abdominal"),
]

SINGLE_SYMPTOM_MAP = {
    "cough": "respiratory/infectious",
    "fever": "infectious/systemic",
    "palpitations": "cardiovascular/rhythm",
    "vomiting": "GI/abdominal",
}


def match_condition_categories(extracted: ExtractedSymptomIntelligence) -> list[str]:
    symptoms = {item.lower() for item in extracted.primary_symptoms}
    categories: list[str] = []

    for symptom_set, category in CATEGORY_RULES:
        if symptom_set.issubset(symptoms):
            categories.append(category)

    for symptom in symptoms:
        category = SINGLE_SYMPTOM_MAP.get(symptom)
        if category and category not in categories:
            categories.append(category)

    if not categories:
        categories.append("general/undifferentiated")

    return categories
