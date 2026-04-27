from __future__ import annotations

import re

from sqlalchemy.orm import Session

from app.models.coach_memory import CoachMemory
from app.models.coach_message_log import CoachMessageLog
from app.schemas.daily_checkin import DailyCheckInRead

MAX_MESSAGE_LENGTH = 4000
MAX_MEMORY_LENGTH = 500
MAX_MESSAGES_PER_USER = 200


def _clean_text(value: str | None, *, max_length: int) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        return ""
    return cleaned[:max_length]


def get_recent_coach_messages(db: Session, user_id: int, limit: int = 20) -> list[CoachMessageLog]:
    safe_limit = min(max(limit, 1), 20)
    rows = (
        db.query(CoachMessageLog)
        .filter(CoachMessageLog.user_id == user_id)
        .order_by(CoachMessageLog.created_at.desc(), CoachMessageLog.id.desc())
        .limit(safe_limit)
        .all()
    )
    return list(reversed(rows))


def save_coach_message(db: Session, user_id: int, role: str, content: str) -> CoachMessageLog | None:
    cleaned = _clean_text(content, max_length=MAX_MESSAGE_LENGTH)
    if role not in {"user", "coach"} or not cleaned:
        return None

    row = CoachMessageLog(user_id=user_id, role=role, content=cleaned)
    db.add(row)
    db.flush()
    _prune_old_messages(db=db, user_id=user_id, keep=MAX_MESSAGES_PER_USER)
    return row


def _prune_old_messages(db: Session, *, user_id: int, keep: int) -> None:
    keep_ids = [
        message_id
        for (message_id,) in (
            db.query(CoachMessageLog.id)
            .filter(CoachMessageLog.user_id == user_id)
            .order_by(CoachMessageLog.created_at.desc(), CoachMessageLog.id.desc())
            .limit(keep)
            .all()
        )
    ]
    if not keep_ids:
        return

    (
        db.query(CoachMessageLog)
        .filter(CoachMessageLog.user_id == user_id, CoachMessageLog.id.notin_(keep_ids))
        .delete(synchronize_session=False)
    )


def get_or_create_coach_memory(db: Session, user_id: int) -> CoachMemory:
    row = db.query(CoachMemory).filter(CoachMemory.user_id == user_id).first()
    if row:
        return row

    row = CoachMemory(user_id=user_id, summary="")
    db.add(row)
    db.flush()
    return row


def _extract_focus_topics(*texts: str) -> list[str]:
    mapping = {
        "sleep": ["sleep", "insomnia", "rest"],
        "energy": ["energy", "tired", "fatigue"],
        "stress": ["stress", "anxious", "anxiety"],
        "check-in consistency": ["check-in", "check in", "consisten"],
        "activity": ["exercise", "workout", "activity", "walk"],
        "medication consistency": ["medication", "dose", "adherence"],
        "momentum": ["momentum", "score"],
    }
    combined = " ".join(texts).lower()
    topics: list[str] = []
    for topic, keywords in mapping.items():
        if any(keyword in combined for keyword in keywords):
            topics.append(topic)
    return topics[:3]


def _sanitize_memory_text(text: str) -> str:
    lowered = text.lower()
    blocked = [
        "diagnosis",
        "diagnosed",
        "condition",
        "syndrome",
        "disorder",
        "disease",
        "emergency",
        "suicid",
        "chest pain",
        "stroke",
    ]
    if any(token in lowered for token in blocked):
        text = re.sub(r"\b(has|with)\b[^.]*", "", text, flags=re.IGNORECASE).strip()
        text = re.sub(r"\s{2,}", " ", text)
    return text[:MAX_MEMORY_LENGTH]


def _extract_existing_memory_sentences(existing_summary: str) -> list[str]:
    if not existing_summary:
        return []

    raw_sentences = [segment.strip() for segment in re.split(r"(?<=[.!?])\s+", existing_summary) if segment.strip()]
    kept: list[str] = []
    for sentence in raw_sentences:
        if sentence.lower().startswith("recent coaching focus:"):
            continue
        if len(sentence) > 180:
            continue
        sanitized = _sanitize_memory_text(sentence).strip()
        if sanitized:
            if sanitized[-1] not in ".!?":
                sanitized = f"{sanitized}."
            kept.append(sanitized)
        if len(kept) >= 2:
            break
    return kept


def update_coach_memory_summary(
    db: Session,
    *,
    user_id: int,
    existing_summary: str | None,
    question: str,
    answer: str,
    recent_checkins: list[DailyCheckInRead] | None = None,
    momentum_label: str | None = None,
) -> str:
    memory = get_or_create_coach_memory(db, user_id)
    current = _clean_text(existing_summary if existing_summary is not None else memory.summary, max_length=MAX_MEMORY_LENGTH)

    topics = _extract_focus_topics(current, question, answer)
    checkin_hint = ""
    if recent_checkins:
        latest = recent_checkins[0]
        if (latest.sleep_hours or 0) < 7:
            checkin_hint = "sleep consistency"
        elif latest.stress_level == "high":
            checkin_hint = "stress regulation"

    focus_parts = topics.copy()
    if checkin_hint and checkin_hint not in focus_parts:
        focus_parts.append(checkin_hint)
    if momentum_label and "momentum" not in focus_parts:
        focus_parts.append("momentum")

    focus_text = ", ".join(focus_parts[:3]) if focus_parts else "daily consistency"
    existing_sentences = _extract_existing_memory_sentences(current)
    if not existing_sentences:
        existing_sentences = [f"User often asks for coaching support around {focus_text}."]
    merged = " ".join(existing_sentences + [f"Recent coaching focus: {focus_text}."])

    memory.summary = _sanitize_memory_text(merged)[:MAX_MEMORY_LENGTH]
    db.add(memory)
    db.flush()
    return memory.summary
