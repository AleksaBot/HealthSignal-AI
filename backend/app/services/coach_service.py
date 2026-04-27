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
    context: dict | None = None,
    history: list[dict[str, str]] | None = None,
) -> str:
    drags, positives = _profile_signals(profile)

    weekly_summary = context.get("weeklySummary") if isinstance(context, dict) else None
    momentum_context = context.get("momentum") if isinstance(context, dict) else None
    streak_highlights = context.get("streakHighlights") if isinstance(context, dict) else None
    goals = context.get("goals") if isinstance(context, dict) else None
    coach_memory_summary = context.get("coachMemorySummary") if isinstance(context, dict) else None
    context_checkins = context.get("recentCheckIns") if isinstance(context, dict) else None

    response_contract = (
        "Format responses with this structure:\n"
        "1) One short opening sentence that acknowledges the user's question directly.\n"
        "2) 'What I'm seeing:' with 1-2 bullet points using concrete data points when available.\n"
        "3) 'Next steps:' with 2-3 practical, behavior-focused bullets.\n"
        "4) One short educational safety note line.\n"
        "Keep it concise and avoid long paragraphs."
    )
    system_prompt = (
        "You are HealthSignal AI Coach. "
        "Provide concise, direct, supportive, confident, educational coaching guidance. "
        "Use user context to identify the highest-leverage behavior change for the next 24-72 hours. "
        "Never diagnose, avoid fake certainty, and avoid generic advice not grounded in context. "
        "If the user asks a follow-up, use recent conversation context and avoid repeating the full prior explanation. "
        "Use coach session memory to handle follow-up questions, but do not over-reference it. "
        "When goals are available, align advice with the current coaching goals instead of creating unrelated new goals. "
        "If user describes emergency red flags (for example chest pain, severe shortness of breath, stroke-like symptoms, fainting, suicidal thoughts), "
        "advise urgent/emergency care immediately and keep response short. "
        "For non-emergencies, do not over-alarm.\n"
        f"{response_contract}"
    )

    conversation = "\n".join([f"{entry.get('role', 'user')}: {entry.get('content', '')}" for entry in (history or [])[-6:]])

    user_prompt = (
        f"User question: {question}\n"
        f"Momentum: {momentum_score}/100 ({momentum_label}), trend={trend_direction}.\n"
        f"Client momentum context: {momentum_context or 'not available yet'}.\n"
        f"Weekly focus: {weekly_focus}.\n"
        f"Client weekly summary: {weekly_summary or 'not available yet'}.\n"
        f"Streak highlights: {streak_highlights or 'not available yet'}.\n"
        f"Current coaching goals: {goals or 'not available yet'}.\n"
        f"Coach session memory: {coach_memory_summary or 'not available yet'}.\n"
        f"Top profile drags: {', '.join(drags) if drags else 'none identified'}.\n"
        f"Top strengths: {', '.join(positives) if positives else 'none identified'}.\n"
        f"Watchlist: {', '.join(watchlist) if watchlist else 'none'}.\n"
        f"Medication context: {medication_summary}.\n"
        f"Trend summary: {recent_trend_summary}.\n"
        f"Check-in context: {_build_checkin_summary(recent_checkins)}\n"
        f"Client provided recent 3 check-ins: {context_checkins or 'not available yet'}.\n"
        f"Recent conversation:\n{conversation if conversation else 'No prior chat in this session.'}\n"
        "Behavior lever rule: identify the single most likely behavior lever before giving steps.\n"
        "Data grounding rule: cite 1-2 concrete data points from momentum, weekly summary, streaks, or check-ins when possible.\n"
        "If asked about tiredness/low energy, explicitly connect sleep trend + energy trend before advice.\n"
        "Use educational guidance only and include a one-line educational safety note at the end."
    )

    ai_answer = get_ai_provider().generate_text(system_prompt=system_prompt, user_prompt=user_prompt)
    if ai_answer:
        return ai_answer

    # safe fallback when AI provider is unavailable
    primary_drag = drags[0] if drags else weekly_focus
    strength = positives[0] if positives else "your current routine"
    latest_checkin_signal = (
        f"Latest check-in sleep {recent_checkins[0].sleep_hours or 'n/a'}h and energy {recent_checkins[0].energy_level or 'n/a'}/10."
        if recent_checkins
        else "No recent check-ins available yet."
    )
    return (
        f"Quick read: Your momentum score is {momentum_score}/100 ({momentum_label}), and {primary_drag} looks like your most useful lever right now.\n\n"
        "What I'm seeing:\n"
        f"- Trend direction is {trend_direction.lower()} and weekly focus is {weekly_focus}.\n"
        f"- {latest_checkin_signal}\n\n"
        "Next steps:\n"
        f"- Protect one specific daily action around {primary_drag} for the next 3 days.\n"
        f"- Keep {strength} steady while tracking one signal in your next check-in.\n"
        "- Bring your current coaching goal into your next coach question so advice stays aligned.\n\n"
        "Educational note: This is educational guidance, not a diagnosis; seek medical care for severe, sudden, or worsening symptoms."
    )
