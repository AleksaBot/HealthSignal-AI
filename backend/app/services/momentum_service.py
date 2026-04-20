from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.momentum_snapshot import MomentumSnapshot
from app.models.user import User
from app.schemas.health_profile import HealthProfileRead


def momentum_label(score: int) -> str:
    if score <= 39:
        return "Needs Attention"
    if score <= 59:
        return "Building Momentum"
    if score <= 79:
        return "Stable"
    return "Strong Routine"


def _calculate_profile_completion(profile: HealthProfileRead) -> int:
    checks = [
        profile.age,
        profile.sex,
        profile.height_cm,
        profile.weight_kg,
        profile.activity_level,
        profile.smoking_vaping_status,
        profile.alcohol_frequency,
        profile.sleep_average_hours,
        profile.stress_level,
    ]
    complete = len([item for item in checks if item is not None])
    return round((complete / len(checks)) * 100)


def calculate_momentum_score(profile: HealthProfileRead) -> int:
    sleep_score = 100 if (profile.sleep_average_hours or 0) >= 7 else 70 if (profile.sleep_average_hours or 0) >= 6 else 45

    activity_map = {"low": 35, "moderate": 68, "active": 85, "very_active": 95}
    activity_score = activity_map.get(profile.activity_level or "", 55)

    stress_map = {"low": 92, "moderate": 75, "high": 50, "very_high": 32}
    stress_score = stress_map.get(profile.stress_level or "", 60)

    adherence_score = 70
    recent_events = profile.recent_medication_events or []
    if recent_events:
        taken_count = len([event for event in recent_events if event.status == "taken"])
        adherence_score = round((taken_count / len(recent_events)) * 100)

    baseline_score = _calculate_profile_completion(profile)

    weighted = (
        sleep_score * 0.2
        + activity_score * 0.2
        + stress_score * 0.2
        + adherence_score * 0.2
        + baseline_score * 0.2
    )
    return max(0, min(100, round(weighted)))


def maybe_create_snapshot(db: Session, user: User, score: int, label: str) -> MomentumSnapshot | None:
    latest = (
        db.query(MomentumSnapshot)
        .filter(MomentumSnapshot.user_id == user.id)
        .order_by(MomentumSnapshot.created_at.desc())
        .first()
    )

    if latest and latest.score == score and latest.label == label and latest.created_at >= datetime.utcnow() - timedelta(hours=18):
        return None

    snapshot = MomentumSnapshot(user_id=user.id, score=score, label=label)
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot


def get_history(db: Session, user_id: int, limit: int = 30) -> list[MomentumSnapshot]:
    return (
        db.query(MomentumSnapshot)
        .filter(MomentumSnapshot.user_id == user_id)
        .order_by(MomentumSnapshot.created_at.desc())
        .limit(limit)
        .all()
    )


def get_latest(db: Session, user_id: int) -> MomentumSnapshot | None:
    return (
        db.query(MomentumSnapshot)
        .filter(MomentumSnapshot.user_id == user_id)
        .order_by(MomentumSnapshot.created_at.desc())
        .first()
    )


def summarize_history(snapshots: list[MomentumSnapshot]) -> dict:
    if not snapshots:
        return {
            "trend_direction": "Stable",
            "weekly_delta": 0,
            "stats": {
                "best_score_last_30_days": None,
                "average_score_last_30_days": None,
                "current_streak": 0,
            },
        }

    ordered = list(reversed(snapshots))
    weekly_delta = ordered[-1].score - ordered[0].score if len(ordered) > 1 else 0

    if weekly_delta >= 4:
        trend = "Improving"
    elif weekly_delta <= -4:
        trend = "Declining"
    else:
        trend = "Stable"

    scores = [s.score for s in snapshots]
    streak = 1
    if len(ordered) > 1:
        streak = 1
        for idx in range(len(ordered) - 1, 0, -1):
            if ordered[idx].score >= ordered[idx - 1].score:
                streak += 1
            else:
                break

    return {
        "trend_direction": trend,
        "weekly_delta": weekly_delta,
        "stats": {
            "best_score_last_30_days": max(scores),
            "average_score_last_30_days": round(sum(scores) / len(scores), 1),
            "current_streak": streak,
        },
    }
