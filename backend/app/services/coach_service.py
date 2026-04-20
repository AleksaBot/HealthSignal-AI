from app.schemas.health_profile import HealthProfileRead


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


def answer_with_context(*, question: str, momentum_score: int, momentum_label: str, trend_direction: str, weekly_focus: str, profile: HealthProfileRead, watchlist: list[str]) -> str:
    q = question.lower()
    drags, positives = _profile_signals(profile)
    meds = [m.name for m in profile.medications][:3]

    if "doctor" in q or "clinician" in q:
        topic = watchlist[0] if watchlist else (drags[0] if drags else "overall risk trends")
        meds_text = f" Mention medications like {', '.join(meds)} during that discussion." if meds else ""
        return (
            f"Your current momentum is {momentum_score}/100 ({momentum_label}) with a {trend_direction.lower()} trend. "
            f"Ask your doctor about {topic}, what to monitor this month, and what threshold should trigger follow-up.{meds_text}"
        )

    if "focus" in q or "this week" in q:
        primary_drag = drags[0] if drags else "consistency"
        return (
            f"Based on your trend ({trend_direction}) and current momentum ({momentum_score}/100), focus this week on {weekly_focus}. "
            f"Your highest leverage area is {primary_drag}. Keep one supporting strength active: {positives[0] if positives else 'your adherence habits'}."
        )

    if "improve" in q or "score" in q:
        drag_text = ", ".join(drags) if drags else "consistency"
        positive_text = ", ".join(positives) if positives else "baseline engagement"
        return (
            f"To lift your momentum score from {momentum_score}, prioritize {drag_text}. "
            f"You can likely gain 4-8 points by tightening those areas while preserving {positive_text}. "
            f"Start with one concrete action today and repeat it for 7 days."
        )

    return (
        f"Your profile shows a momentum score of {momentum_score}/100 ({momentum_label}) and a {trend_direction.lower()} trend. "
        f"Right now I would prioritize {drags[0] if drags else weekly_focus}, then reinforce {positives[0] if positives else 'your current routine'}."
    )
