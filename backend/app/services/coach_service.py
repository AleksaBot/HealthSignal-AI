from __future__ import annotations

from app.schemas.daily_checkin import DailyCheckInRead
from app.schemas.health_profile import HealthProfileRead
from app.services.ai_provider import get_ai_provider


def _profile_signals(profile: HealthProfileRead) -> tuple[list[str], list[str]]:
    drags: list[str] = []
    positives: list[str] = []

    if (profile.sleep_average_hours or 0) < 7:
        drags.append("sleep consistency")
    else:
        positives.append("sleep rhythm")

    if profile.activity_level in ("low", None):
        drags.append("weekly movement")
    elif profile.activity_level in ("active", "very_active"):
        positives.append("activity momentum")

    if profile.stress_level in ("high", "very_high"):
        drags.append("stress load")
    elif profile.stress_level == "low":
        positives.append("stress recovery")

    if profile.medications:
        positives.append("medication awareness")

    if not profile.age or not profile.height_cm or not profile.weight_kg:
        drags.append("baseline completeness")

    return drags[:3], positives[:3]


def _build_checkin_summary(checkins: list[DailyCheckInRead]) -> str:
    if not checkins:
        return "No daily check-ins available yet."

    latest = checkins[0]
    summaries = [
        f"Latest check-in ({latest.date.isoformat()}): sleep={latest.sleep_hours or 'n/a'}h, energy={latest.energy_level or 'n/a'}/10, stress={latest.stress_level or 'n/a'}, exercised={latest.exercised_today if latest.exercised_today is not None else 'n/a'}."
    ]
    sleep_values = [item.sleep_hours for item in checkins if item.sleep_hours is not None]
    energy_values = [item.energy_level for item in checkins if item.energy_level is not None]
    if sleep_values:
        summaries.append(f"Recent avg sleep: {sum(sleep_values) / len(sleep_values):.1f}h.")
    if energy_values:
        summaries.append(f"Recent avg energy: {sum(energy_values) / len(energy_values):.1f}/10.")
    high_stress_count = sum(1 for item in checkins if item.stress_level == "high")
    summaries.append(f"High-stress check-ins in recent window: {high_stress_count}.")
    return " ".join(summaries)


def answer_with_context(
    *,
    question: str,
    momentum_score: int,
    momentum_label: str,
    trend_direction: str,
    weekly_focus: str,
    profile: HealthProfileRead,
    watchlist: list[str],
    medication_summary: str,
    recent_trend_summary: str,
    recent_checkins: list[DailyCheckInRead],
    history: list[dict[str, str]] | None = None,
) -> str:
    drags, positives = _profile_signals(profile)

    system_prompt = (
        "You are HealthSignal AI Coach. "
        "Provide concise, practical, supportive, educational guidance. "
        "Never diagnose, never replace emergency care, and avoid fear language. "
        "When data is missing, acknowledge it and suggest one action. "
        "Keep response under 140 words and include 2-3 actionable steps when possible."
    )

    conversation = "\n".join([f"{entry.get('role', 'user')}: {entry.get('content', '')}" for entry in (history or [])[-6:]])

    user_prompt = (
        f"User question: {question}\n"
        f"Momentum: {momentum_score}/100 ({momentum_label}), trend={trend_direction}.\n"
        f"Weekly focus: {weekly_focus}.\n"
        f"Top profile drags: {', '.join(drags) if drags else 'none identified'}.\n"
        f"Top strengths: {', '.join(positives) if positives else 'none identified'}.\n"
        f"Watchlist: {', '.join(watchlist) if watchlist else 'none'}.\n"
        f"Medication context: {medication_summary}.\n"
        f"Trend summary: {recent_trend_summary}.\n"
        f"Check-in context: {_build_checkin_summary(recent_checkins)}\n"
        f"Recent conversation:\n{conversation if conversation else 'No prior chat in this session.'}\n"
        "Include a one-line educational disclaimer at the end."
    )

    ai_answer = get_ai_provider().generate_text(system_prompt=system_prompt, user_prompt=user_prompt)
    if ai_answer:
        return ai_answer

    # safe fallback when AI provider is unavailable
    primary_drag = drags[0] if drags else weekly_focus
    strength = positives[0] if positives else "your current routine"
    return (
        f"Your momentum score is {momentum_score}/100 ({momentum_label}) with a {trend_direction.lower()} trend. "
        f"Prioritize {primary_drag} this week, keep {strength} steady, and use one daily check-in to track sleep/energy/stress changes. "
        "Educational support only, not medical diagnosis or emergency care."
    )
