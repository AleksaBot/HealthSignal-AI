from datetime import datetime

from app.schemas.health_profile import HealthProfileRead, HealthRiskInsightsResponse, RiskInsightSection


def _bmi(profile: HealthProfileRead) -> float | None:
    if not profile.height_cm or not profile.weight_kg:
        return None
    return profile.weight_kg / ((profile.height_cm / 100) ** 2)


def _bp_elevated(profile: HealthProfileRead) -> bool:
    return bool(profile.systolic_bp and profile.diastolic_bp and (profile.systolic_bp >= 130 or profile.diastolic_bp >= 85))


def _cholesterol_elevated(profile: HealthProfileRead) -> bool:
    return bool(profile.total_cholesterol and profile.total_cholesterol >= 200)


def build_health_risk_insights(profile: HealthProfileRead) -> HealthRiskInsightsResponse:
    bmi_value = _bmi(profile)

    cardiovascular_factors: list[str] = []
    metabolic_factors: list[str] = []
    lifestyle_factors: list[str] = []
    positives: list[str] = []
    priorities: list[str] = []
    next_steps: list[str] = []

    if profile.smoking_vaping_status in {"daily", "occasional"}:
        cardiovascular_factors.append("Smoking or vaping can raise long-term heart and blood vessel strain.")
        lifestyle_factors.append("Smoking/vaping is present.")
        priorities.append("Create a gradual smoking/vaping reduction plan.")

    if profile.activity_level in {"low", None}:
        cardiovascular_factors.append("Lower activity can reduce cardiovascular resilience over time.")
        metabolic_factors.append("Lower movement can make weight and blood-sugar trends harder to manage.")
        lifestyle_factors.append("Activity level is currently limited.")
        priorities.append("Build a consistent activity routine (for example, brisk walking most days).")
    elif profile.activity_level in {"active", "very_active"}:
        positives.append("You report regular activity, which supports heart and metabolic health.")

    if bmi_value is not None and bmi_value >= 30:
        cardiovascular_factors.append("Higher body-weight trend may add strain to heart health.")
        metabolic_factors.append("Weight trend may increase metabolic risk over time.")
        priorities.append("Focus on sustainable weight-friendly routines around movement and nutrition.")
    elif bmi_value is not None and bmi_value <= 27 and profile.activity_level in {"active", "very_active"}:
        positives.append("Weight and activity pattern suggest a supportive baseline.")

    if profile.sleep_average_hours is not None and profile.sleep_average_hours < 6.5:
        lifestyle_factors.append("Average sleep is below the usual recovery target.")
        priorities.append("Improve sleep consistency and total sleep time.")

    if profile.stress_level in {"high", "very_high"}:
        lifestyle_factors.append("Stress load appears elevated.")
        priorities.append("Add daily stress reset habits (breathing, walks, routines, social support).")

    if profile.sleep_average_hours is not None and profile.sleep_average_hours >= 7 and profile.stress_level in {"low", "moderate"}:
        positives.append("Sleep and stress profile supports better recovery.")

    if profile.family_history:
        cardiovascular_factors.append("Family history suggests a stronger prevention focus.")
        metabolic_factors.append("Family history is relevant for long-term prevention planning.")
        priorities.append("Keep regular preventive check-ins because of family history.")

    if _bp_elevated(profile):
        cardiovascular_factors.append("Blood pressure reading is above the ideal range.")
        priorities.append("Recheck blood pressure and discuss trends with your clinician.")

    if _cholesterol_elevated(profile):
        cardiovascular_factors.append("Known cholesterol level is above the preferred range.")
        priorities.append("Review heart-health nutrition and follow-up cholesterol testing.")

    if profile.alcohol_frequency in {"several_times_weekly", "daily"}:
        lifestyle_factors.append("Alcohol frequency may affect recovery and blood-pressure trends.")
        priorities.append("Consider reducing alcohol frequency to support recovery and heart health.")

    if profile.alcohol_frequency in {"never", "monthly"}:
        positives.append("Alcohol use appears limited, which can support cardiometabolic health.")

    if not positives:
        positives.append("You have taken an important step by completing your profile and reviewing your health patterns.")

    if not priorities:
        priorities.append("Maintain your current routines and continue periodic check-ins.")

    if not next_steps:
        next_steps.extend(
            [
                "Pick one priority to work on for the next 2-4 weeks.",
                "Track progress weekly (activity, sleep, stress, or smoking changes).",
                "Use your next primary-care visit to review your profile and prevention goals.",
            ]
        )

    cardiovascular_level = "caution" if len(cardiovascular_factors) >= 3 else "watch" if cardiovascular_factors else "positive"
    metabolic_level = "caution" if len(metabolic_factors) >= 2 else "watch" if metabolic_factors else "positive"

    overall_snapshot = (
        "Your profile shows a strong prevention opportunity. Focus on a few consistent habits to improve long-term risk trends."
        if priorities
        else "Your profile currently reflects supportive habits. Keep your routines steady and reassess periodically."
    )

    return HealthRiskInsightsResponse(
        generated_at=datetime.utcnow(),
        profile_snapshot=profile,
        overall_health_snapshot=overall_snapshot,
        cardiovascular_caution=RiskInsightSection(
            level=cardiovascular_level,
            summary=(
                "Your cardiovascular profile has some caution flags that are worth addressing early."
                if cardiovascular_level == "caution"
                else "Your cardiovascular profile has a few areas to keep an eye on."
                if cardiovascular_level == "watch"
                else "Your cardiovascular profile currently looks supportive."
            ),
            factors=cardiovascular_factors,
        ),
        metabolic_weight_caution=RiskInsightSection(
            level=metabolic_level,
            summary=(
                "Your metabolic/weight profile shows caution signs that benefit from consistent lifestyle changes."
                if metabolic_level == "caution"
                else "Your metabolic/weight profile has moderate watch-points."
                if metabolic_level == "watch"
                else "Your metabolic/weight profile currently looks supportive."
            ),
            factors=metabolic_factors,
        ),
        lifestyle_risk_factors=lifestyle_factors,
        positive_habits=positives,
        top_priorities_for_improvement=list(dict.fromkeys(priorities))[:4],
        suggested_next_steps=next_steps,
    )
