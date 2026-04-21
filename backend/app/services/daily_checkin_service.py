from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models.daily_checkin import DailyCheckIn
from app.models.user import User
from app.schemas.daily_checkin import DailyCheckInRead, DailyCheckInUpsertRequest


def _to_read(row: DailyCheckIn) -> DailyCheckInRead:
    return DailyCheckInRead(
        id=row.id,
        user_id=row.user_id,
        date=row.date,
        sleep_hours=row.sleep_hours,
        energy_level=row.energy_level,
        stress_level=row.stress_level,
        exercised_today=row.exercised_today,
        note=row.note,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def get_today_checkin(*, db: Session, user: User, today: date | None = None) -> DailyCheckInRead | None:
    target_day = today or date.today()
    row = (
        db.query(DailyCheckIn)
        .filter(DailyCheckIn.user_id == user.id, DailyCheckIn.date == target_day)
        .first()
    )
    return _to_read(row) if row else None


def upsert_today_checkin(*, db: Session, user: User, payload: DailyCheckInUpsertRequest, today: date | None = None) -> DailyCheckInRead:
    target_day = today or date.today()
    row = (
        db.query(DailyCheckIn)
        .filter(DailyCheckIn.user_id == user.id, DailyCheckIn.date == target_day)
        .first()
    )

    if row is None:
        row = DailyCheckIn(user_id=user.id, date=target_day)
        db.add(row)

    row.sleep_hours = payload.sleep_hours
    row.energy_level = payload.energy_level
    row.stress_level = payload.stress_level
    row.exercised_today = payload.exercised_today
    row.note = payload.note.strip() if isinstance(payload.note, str) and payload.note.strip() else None

    db.commit()
    db.refresh(row)
    return _to_read(row)


def get_recent_checkins(*, db: Session, user: User, days: int = 7, today: date | None = None) -> list[DailyCheckInRead]:
    anchor = today or date.today()
    safe_days = min(max(days, 1), 30)
    start = anchor - timedelta(days=safe_days - 1)
    rows = (
        db.query(DailyCheckIn)
        .filter(DailyCheckIn.user_id == user.id, DailyCheckIn.date >= start)
        .order_by(DailyCheckIn.date.desc())
        .all()
    )
    return [_to_read(row) for row in rows]


def summarize_recent_checkins(checkins: list[DailyCheckInRead]) -> str:
    if not checkins:
        return "No daily check-ins logged yet."

    sleep_values = [item.sleep_hours for item in checkins if item.sleep_hours is not None]
    energy_values = [item.energy_level for item in checkins if item.energy_level is not None]
    stressed_days = sum(1 for item in checkins if item.stress_level == "high")
    exercised_days = sum(1 for item in checkins if item.exercised_today)

    bits: list[str] = [f"{len(checkins)} recent check-in(s)"]
    if sleep_values:
        bits.append(f"avg sleep {sum(sleep_values) / len(sleep_values):.1f}h")
    if energy_values:
        bits.append(f"avg energy {sum(energy_values) / len(energy_values):.1f}/10")
    bits.append(f"high-stress days {stressed_days}")
    bits.append(f"exercise days {exercised_days}")
    return "; ".join(bits)
