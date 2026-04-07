from app.schemas.analyze import RiskInsightRequest
from app.services.red_flags import detect_red_flags


def evaluate_risk(payload: RiskInsightRequest) -> dict[str, object]:
    extracted_signals = [
        f"Age: {payload.age}",
        f"Blood pressure: {payload.systolic_bp}/{payload.diastolic_bp}",
        f"Fasting glucose: {payload.fasting_glucose}",
        f"HbA1c: {payload.hba1c}",
        f"LDL: {payload.ldl_cholesterol}"
    ]

    stroke_level = "elevated" if payload.systolic_bp >= 140 else "baseline"
    diabetes_level = "elevated" if payload.hba1c >= 6.5 or payload.fasting_glucose >= 126 else "baseline"
    cardio_level = "elevated" if payload.ldl_cholesterol >= 130 or payload.systolic_bp >= 140 else "baseline"

    text_signals = [
        "chest pain shortness of breath" if payload.systolic_bp >= 160 else "",
        "slurred speech weakness" if payload.systolic_bp >= 180 else "",
        "severe headache confusion" if payload.diastolic_bp >= 110 else ""
    ]

    return {
        "extracted_signals": extracted_signals,
        "red_flags": detect_red_flags(text_signals),
        "likely_categories": ["Cardiometabolic", "Cardiovascular", "Endocrine"],
        "risk_insights": {
            "stroke": f"{stroke_level.capitalize()} blood-pressure-associated signal.",
            "diabetes": f"{diabetes_level.capitalize()} glycemic risk signal.",
            "cardiovascular": f"{cardio_level.capitalize()} cardiovascular risk factor signal."
        },
        "reasoning": "Structured values are evaluated against transparent threshold rules for educational risk insight."
    }
