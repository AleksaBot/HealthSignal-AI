from app.schemas.analyze import AnalysisResponse, RiskInsightRequest


def analyze_structured_risk(payload: RiskInsightRequest) -> AnalysisResponse:
    risk_markers = [
        f"Age={payload.age}",
        f"Blood pressure={payload.systolic_bp}/{payload.diastolic_bp} mmHg",
        f"Fasting glucose={payload.fasting_glucose} mg/dL",
        f"HbA1c={payload.hba1c}%",
        f"LDL={payload.ldl_cholesterol} mg/dL",
    ]

    cardiovascular_note = "Higher educational concern" if payload.systolic_bp >= 140 or payload.ldl_cholesterol >= 160 else "Lower educational concern"
    diabetes_note = "Higher educational concern" if payload.hba1c >= 6.5 or payload.fasting_glucose >= 126 else "Lower educational concern"
    stroke_note = "Higher educational concern" if payload.age >= 55 and payload.systolic_bp >= 140 else "Lower educational concern"

    return AnalysisResponse(
        extracted_signals=risk_markers,
        red_flags=["Structured input reviewed for elevated biomarker patterns. Urgent symptoms still require emergency care."],
        likely_categories=["Cardiometabolic Risk", "Vascular Risk", "Preventive Care"],
        risk_insights={
            "stroke": f"{stroke_note} based on age and blood-pressure pattern.",
            "diabetes": f"{diabetes_note} based on HbA1c and fasting glucose pattern.",
            "cardiovascular": f"{cardiovascular_note} based on blood pressure and LDL pattern.",
        },
        reasoning=(
            "Risk insights are educational heuristics from structured fields and are non-diagnostic. "
            "Confirm interpretation with a licensed clinician."
        ),
    )
