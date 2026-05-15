from __future__ import annotations

from app.schemas.daily_checkin import DailyCheckInRead
from app.schemas.health_profile import HealthProfileRead
from app.services.ai_provider import get_ai_provider


def normalize_behavior_lever(value: str | None) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        return "consistency"

    bad_phrases = [
        "maintain your current routines",
        "continue periodic check-ins",
        "not available",
        "none",
    ]
    if any(phrase in cleaned.lower() for phrase in bad_phrases):
        return "consistency"
    if len(cleaned) > 40:
        return "consistency"
    return cleaned


def render_behavior_lever(lever: str) -> str:
    if lever == "consistency":
        return "your daily consistency"
    if lever == "sleep consistency":
        return "your sleep consistency"
    if lever == "movement":
        return "your movement routine"
    if lever == "stress":
        return "your stress levels"
    return lever


def classify_coach_question(question: str) -> str:
    q = question.lower()
    words = [word for word in q.replace("?", " ").replace("!", " ").replace(".", " ").split() if word]
    filler_words = {
        "my",
        "the",
        "a",
        "an",
        "and",
        "or",
        "to",
        "of",
        "for",
        "is",
        "it",
        "this",
        "that",
        "i",
        "me",
        "you",
        "we",
        "be",
        "honest",
        "current",
        "now",
        "what",
        "do",
        "think",
    }
    meaningful_words = [word for word in words if word not in filler_words]
    if any(k in q for k in ["doctor", "clinician", "appointment", "provider", "visit"]):
        return "clinician_prep"
    follow_up_markers = ["are you sure", "shouldn't", "what if", "if i miss", "make up", "miss a day", "why not"]
    asks_should_i_followup = "should i" in q and not any(k in q for k in ["what should i focus", "what should i do today", "what should i do tomorrow"])
    if any(k in q for k in follow_up_markers) or asks_should_i_followup:
        return "follow_up_clarification"
    vague_markers = ["what do you think", "be honest", "honest", "current", "what now"]
    if any(marker in q for marker in vague_markers):
        return "vague_reflection"
    clear_intent_markers = [
        "plan",
        "today",
        "tomorrow",
        "sleep",
        "energy",
        "stress",
        "doctor",
        "improve",
        "why",
        "low",
        "tired",
        "week",
        "schedule",
        "routine",
        "momentum",
        "better",
        "optimize",
    ]
    if len(meaningful_words) < 4 and not any(k in q for k in clear_intent_markers):
        return "vague_reflection"
    if any(k in q for k in ["tomorrow", "today", "next 24", "next day"]):
        return "next_action"
    if any(k in q for k in ["why", "low", "tired", "energy", "stress", "sleep"]):
        return "pattern_explanation"
    if any(k in q for k in ["improve", "better", "optimize", "momentum"]):
        return "improvement_strategy"
    plan_builder_markers = ["plan", "schedule", "make me", "build me", "next 7 days", "weekly plan"]
    if any(k in q for k in plan_builder_markers):
        return "plan_builder"
    return "general_coaching"


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


def _fallback_coach_answer(
    *,
    question_type: str,
    question: str,
    momentum_score: int,
    momentum_label: str,
    trend_direction: str,
    weekly_focus: str,
    drags: list[str],
    positives: list[str],
    recent_checkins: list[DailyCheckInRead],
) -> str:
    normalized_weekly_focus = normalize_behavior_lever(weekly_focus)
    display_weekly_focus = render_behavior_lever(normalized_weekly_focus)
    primary_drag = normalize_behavior_lever(drags[0] if drags else normalized_weekly_focus)
    strength = positives[0] if positives else "your current routine"
    latest_checkin_signal = (
        f"Latest check-in sleep {recent_checkins[0].sleep_hours or 'n/a'}h and energy {recent_checkins[0].energy_level or 'n/a'}/10."
        if recent_checkins
        else "No recent check-ins available yet."
    )


    if question_type == "follow_up_clarification":
        return (
            "Yes — in most habit plans, it is better not to overcorrect after one missed day.\n\n"
            "Why:\n"
            "- Trying to make up everything at once can turn one missed day into extra fatigue or inconsistency.\n"
            "- The better move is to restart at the next planned block.\n\n"
            "What to do instead:\n"
            "- Do the next scheduled action.\n"
            "- If you want to make it up, do a lighter version, not double volume.\n"
            "- Log the miss in your next check-in so the plan can adjust.\n\n"
            "Educational note: Coaching guidance only, not a diagnosis."
        )

    if question_type == "plan_builder":
        sleep_line = (
            "- Sleep: Keep a consistent wind-down time."
            if primary_drag == "consistency"
            else f"- Sleep: Set a consistent sleep window to improve {render_behavior_lever(primary_drag)}."
        )
        return (
            "This Week's Plan\n"
            f"{sleep_line}\n"
            "- Movement: Schedule 3 short movement sessions (20-30 min) on fixed days.\n"
            "- Check-in: Log sleep + energy daily so we can adjust the plan quickly.\n"
            f"- Recovery: Keep one lower-intensity day to protect {strength}.\n"
            "Measurable target: Complete at least 5 daily check-ins and 3 movement sessions this week.\n"
            "If you miss a day: Resume at the next planned block; do not try to 'make up' everything at once.\n"
            "Educational note: Coaching guidance only, not a diagnosis."
        )

    if question_type == "next_action":
        first_priority_line = (
            "- First priority: stick to one consistent action today."
            if primary_drag == "consistency"
            else f"- First priority: stabilize your {render_behavior_lever(primary_drag)} with one small action today."
        )
        return (
            "Next 24-48h Focus\n"
            f"{first_priority_line}\n"
            "- Tomorrow anchor: choose one fixed time for movement or a recovery walk.\n"
            f"- Feedback loop: use your next check-in to record sleep/energy and refine tomorrow's plan. {latest_checkin_signal}\n"
            "Educational note: Coaching guidance only, not a diagnosis."
        )

    if question_type == "pattern_explanation":
        return (
            "Likely Pattern Drivers\n"
            f"- Your trend is {trend_direction.lower()} while {primary_drag} remains a drag, which can suppress day-to-day energy.\n"
            f"- Recent signal: {latest_checkin_signal}\n"
            f"- Stable strength: {strength} can help buffer this pattern while you improve consistency.\n"
            "Educational note: This explains likely behavior patterns, not a medical diagnosis."
        )

    if question_type == "improvement_strategy":
        return (
            "Top Leverage Points (Ranked)\n"
            f"1) Stabilize {render_behavior_lever(primary_drag)}: make this your daily non-negotiable because it likely has the biggest downstream effect on your momentum score.\n"
            "2) Tighten your next-day plan: choose tomorrow's first action the night before to reduce friction.\n"
            f"3) Preserve {strength}: keep your strongest routine steady so momentum does not reset.\n"
            "Educational note: Educational coaching only, not medical advice."
        )

    if question_type == "clinician_prep":
        return (
            "Clinician Visit Prep\n"
            "Questions to bring:\n"
            "1) Which behavior change would have the highest impact given my recent sleep/energy/stress pattern?\n"
            "2) Which warning signs should make me seek care sooner rather than waiting for routine follow-up?\n"
            "3) What should I track daily so our next visit can be more specific?\n"
            "Track before visit: sleep hours, energy score, stress level, and any symptom timing patterns for 7 days.\n"
            "Educational note: This prepares a visit and does not replace clinical care."
        )

    if question_type == "vague_reflection":
        direction_phrase = (
            "you’re improving"
            if "up" in trend_direction.lower() or "improving" in trend_direction.lower()
            else "you’re mostly stable"
            if "stable" in trend_direction.lower()
            else "your momentum may be slipping"
        )
        progress_interpretation = (
            "but stability is not the same as progress"
            if "stable" in trend_direction.lower()
            else "and the next move is to protect what is working"
            if "up" in trend_direction.lower() or "improving" in trend_direction.lower()
            else "so the priority is to stop the slide before adding complexity"
        )
        primary_lever = render_behavior_lever(primary_drag)
        strength_lever = strength
        return (
            "Here’s my honest read:\n"
            f"- Right now {direction_phrase}, {progress_interpretation}.\n"
            f"- The thing most likely holding you back is {primary_lever}.\n"
            f"- Your useful base is {strength_lever}, so the goal is not to restart everything — it is to sharpen one lever.\n\n"
            "What actually matters:\n"
            "- Do not chase five improvements at once. Pick one behavior that you can repeat for 3 days.\n"
            "- A good plan should feel almost too easy at first; consistency beats intensity here.\n\n"
            "Best next move:\n"
            f"- For the next 3 days, make {primary_lever} the only thing you try to improve.\n"
            "- Track one signal daily: sleep, energy, stress, or check-in completion.\n\n"
            "Sharper questions you can ask next:\n"
            "- What should I focus on tomorrow?\n"
            "- Why is my energy low this week?\n"
            "- Make me a simple 3-day plan.\n\n"
            "Educational note: This is educational coaching, not a diagnosis."
        )

    consistency_line = (
        "- Protect one small repeatable habit."
        if primary_drag == "consistency"
        else f"- Protect one specific daily action around {render_behavior_lever(primary_drag)}."
    )

    return (
        f"Here’s the coaching read: your momentum score is {momentum_score}/100 ({momentum_label}), and {render_behavior_lever(primary_drag)} looks like your most useful lever right now.\n\n"
        "What I'm seeing:\n"
        f"- Trend direction is {trend_direction.lower()} and weekly focus is {display_weekly_focus}.\n"
        f"- {latest_checkin_signal}\n\n"
        "Next steps:\n"
        f"{consistency_line}\n"
        f"- Keep {strength} steady while tracking one signal in your next check-in.\n"
        "- Bring your current coaching goal into your next coach question so advice stays aligned.\n\n"
        "Educational note: This is educational guidance, not a diagnosis; seek medical care for severe, sudden, or worsening symptoms."
    )


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
    question_type = classify_coach_question(question)

    weekly_summary = context.get("weeklySummary") if isinstance(context, dict) else None
    momentum_context = context.get("momentum") if isinstance(context, dict) else None
    streak_highlights = context.get("streakHighlights") if isinstance(context, dict) else None
    goals = context.get("goals") if isinstance(context, dict) else None
    coach_memory_summary = context.get("coachMemorySummary") if isinstance(context, dict) else None
    context_checkins = context.get("recentCheckIns") if isinstance(context, dict) else None

    response_contract = (
        "You must first decide what the user is asking for, then choose the best answer format. "
        "Do not reuse the same structure if it does not fit the question.\n"
        "For plan_builder questions, produce an actual plan with time horizon and steps.\n"
        "For next_action questions, focus only on the next 24-48 hours.\n"
        "For pattern_explanation questions, explain likely drivers using available data.\n"
        "If the user asks why something is happening, explain likely drivers first. Do not return a plan unless the user explicitly asks for a plan.\n"
        "For improvement_strategy questions, give 2-3 leverage points ranked by impact.\n"
        "For clinician_prep questions, produce questions or notes to bring to a clinician.\n"
        "For follow_up_clarification questions, directly answer the user's concern first, then explain the reasoning. Do not restart with a profile summary.\n"
        "If the user asks whether they should make up a missed day, explain that they usually should not overcorrect; they should resume the next planned action or do a lighter recovery version.\n"
        "Decision rule: You must commit to ONE primary action. Do not give multiple equal options.\n"
        "For all answers except clinician_prep, you must clearly state ONE primary action the user should take next.\n"
        "Include one short 'why this matters' explanation connecting the action to the user's outcome.\n"
        "Do not default to 'maintain your routine' unless explicitly justified by data. Prefer a small improvement action instead.\n"
        "Vary phrasing and structure slightly across responses to avoid repetition.\n"
        "Do not reuse the same opening sentence from prior responses.\n"
        "Never answer only with a profile summary. Every response must include a concrete requested deliverable:\n"
        "- plan_builder: actual plan\n"
        "- next_action: exact next 1-2 actions\n"
        "- pattern_explanation: likely drivers and why\n"
        "- improvement_strategy: ranked leverage points\n"
        "- clinician_prep: questions/notes for clinician\n"
        "Compare the current question with recent conversation. If the user already received similar advice, do not repeat it. "
        "Give a new angle, more specific action, or a clearer plan.\n"
        "If recent conversation contains similar wording, change the structure and provide a more specific next layer instead of repeating.\n"
        "Do not copy the same opening sentence from prior answers.\n"
        "If the question type is plan_builder, include:\n"
        "- A short plan title\n"
        "- 3-5 practical steps\n"
        "- A simple weekly rhythm if the user asks for a week\n"
        "- One measurable target\n"
        "- One fallback option if the user misses a day\n"
        "Keep it concise and avoid long paragraphs."
    )
    system_prompt = (
        "You are HealthSignal AI Coach. "
        "Provide concise, direct, supportive, confident, educational coaching guidance. "
        "Use user context to identify the highest-leverage behavior change for the next 24-72 hours. "
        "Never diagnose, avoid fake certainty, and avoid generic advice not grounded in context. "
        "If the user asks a follow-up, use recent conversation context and avoid repeating the full prior explanation. "
        "Use persistent memory when relevant for follow-up questions, but do not over-reference it. "
        "When goals are available, align advice with the current coaching goals instead of creating unrelated new goals. "
        "If user describes emergency red flags (for example chest pain, severe shortness of breath, stroke-like symptoms, fainting, suicidal thoughts), "
        "advise urgent/emergency care immediately and keep response short. "
        "For non-emergencies, do not over-alarm.\n"
        f"{response_contract}"
    )

    conversation = "\n".join([f"{entry.get('role', 'user')}: {entry.get('content', '')}" for entry in (history or [])[-6:]])

    user_prompt = (
        f"User question: {question}\n"
        f"Question type: {question_type}\n"
        f"Momentum: {momentum_score}/100 ({momentum_label}), trend={trend_direction}.\n"
        f"Client momentum context: {momentum_context or 'not available yet'}.\n"
        f"Weekly focus: {weekly_focus}.\n"
        f"Client weekly summary: {weekly_summary or 'not available yet'}.\n"
        f"Streak highlights: {streak_highlights or 'not available yet'}.\n"
        f"Current coaching goals: {goals or 'not available yet'}.\n"
        f"Persistent memory summary: {coach_memory_summary or 'not available yet'}.\n"
        f"Top profile drags: {', '.join(drags) if drags else 'none identified'}.\n"
        f"Top strengths: {', '.join(positives) if positives else 'none identified'}.\n"
        f"Watchlist: {', '.join(watchlist) if watchlist else 'none'}.\n"
        f"Medication context: {medication_summary}.\n"
        f"Trend summary: {recent_trend_summary}.\n"
        f"Check-in context: {_build_checkin_summary(recent_checkins)}\n"
        f"Client provided recent 3 check-ins: {context_checkins or 'not available yet'}.\n"
        f"Recent conversation:\n{conversation if conversation else 'No prior chat in this session.'}\n"
        "Behavior lever rule: identify the single most likely behavior lever before giving steps.\n"
        "Do not use full sentences from weekly focus as behavior labels. Convert them into short behavior levers like sleep consistency, movement, stress regulation, medication consistency, or check-in consistency.\n"
        "Avoid abstract phrases like 'reduce friction' or 'optimize consistency'. Use simple, human coaching language instead.\n"
        "Data grounding rule: cite 1-2 concrete data points from momentum, weekly summary, streaks, or check-ins when possible.\n"
        "If asked about tiredness/low energy, explicitly connect sleep trend + energy trend before advice.\n"
        "Use persistent memory only when relevant. Do not claim to remember details not present in memory or current context.\n"
        "Answer must directly satisfy the user's request, not only summarize their profile.\n"
        "For vague_reflection questions, do not summarize the profile. Give a direct interpretation of what the situation means, what matters most, and one next move.\n"
        "Decision rule: answer must directly satisfy the user's request, not summarize their profile.\n"
        "Use educational guidance only and include a one-line educational safety note at the end."
    )

    ai_answer = get_ai_provider().generate_text(system_prompt=system_prompt, user_prompt=user_prompt)
    if ai_answer:
        return ai_answer

    # safe fallback when AI provider is unavailable
    return _fallback_coach_answer(
        question_type=question_type,
        question=question,
        momentum_score=momentum_score,
        momentum_label=momentum_label,
        trend_direction=trend_direction,
        weekly_focus=weekly_focus,
        drags=drags,
        positives=positives,
        recent_checkins=recent_checkins,
    )
