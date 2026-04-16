from __future__ import annotations

from app.schemas.symptom_intelligence import ExtractedSymptomIntelligence, SymptomRiskAssessment

EMERGENCY_SYMPTOM_SETS: list[set[str]] = [
    {"chest pain", "shortness of breath"},
    {"slurred speech", "weakness"},
]

HIGH_RISK_SYMPTOMS = {"confusion", "severe headache", "palpitations"}


def classify_symptom_risk(extracted: ExtractedSymptomIntelligence) -> SymptomRiskAssessment:
    symptoms = {item.lower() for item in extracted.primary_symptoms}
    rationale: list[str] = []

    if extracted.red_flags:
        rationale.append("Detected explicit red-flag phrase(s) in symptom narrative.")
        return SymptomRiskAssessment(risk_level="emergency", rationale=rationale)

    for symptom_set in EMERGENCY_SYMPTOM_SETS:
        if symptom_set.issubset(symptoms):
            rationale.append(f"Emergency pair detected: {', '.join(sorted(symptom_set))}.")
            return SymptomRiskAssessment(risk_level="emergency", rationale=rationale)

    if extracted.severity == "severe":
        rationale.append("Severity language indicates severe symptoms.")
        return SymptomRiskAssessment(risk_level="high", rationale=rationale)

    if symptoms.intersection(HIGH_RISK_SYMPTOMS):
        rationale.append("Contains higher-risk neurologic or cardiopulmonary symptom terms.")
        return SymptomRiskAssessment(risk_level="high", rationale=rationale)

    if len(extracted.primary_symptoms) >= 2:
        rationale.append("Multiple concurrent symptoms detected.")
        return SymptomRiskAssessment(risk_level="moderate", rationale=rationale)

    rationale.append("Limited symptom burden and no emergency pattern detected.")
    return SymptomRiskAssessment(risk_level="low", rationale=rationale)
