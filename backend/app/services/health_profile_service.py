import json
from datetime import date, datetime
from uuid import uuid4

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.medication import Medication, MedicationFrequency, MedicationLog, MedicationLogStatus, MedicationTimeOfDay
from app.models.user import User
from app.schemas.health_profile import (
    HealthProfileRead,
    HealthProfileUpdateRequest,
    MedicationAdherenceEvent,
    MedicationEntry,
    TodayMedicationStatus,
)

_RECENT_MEDICATION_EVENT_LIMIT = 14


def _normalize_medications(payload: dict) -> dict:
    medications = payload.get("medications") or []
    current_medications = payload.get("current_medications") or []

    if not medications and current_medications:
        payload["medications"] = [
            {
                "id": f"legacy-{uuid4().hex[:16]}",
                "name": medication_name,
                "dosage": None,
                "frequency": "daily",
                "custom_frequency": None,
                "time_of_day": None,
                "notes": "Imported from prior Current medications data.",
            }
            for medication_name in current_medications
            if medication_name
        ]
        medications = payload["medications"]

    payload["current_medications"] = [entry["name"] for entry in medications if entry.get("name")]
    return payload


def _serialize_medication_row(row: Medication) -> MedicationEntry:
    return MedicationEntry(
        id=row.external_id,
        name=row.name,
        dosage=row.dosage,
        frequency=row.frequency.value,
        custom_frequency=row.custom_frequency,
        time_of_day=row.time_of_day.value if row.time_of_day else None,
        notes=row.notes,
    )


def _sync_medications_to_relational_store(*, db: Session, user: User, medication_entries: list[MedicationEntry]) -> list[MedicationEntry]:
    existing_rows = db.query(Medication).filter(Medication.user_id == user.id).all()
    existing_by_external_id = {row.external_id: row for row in existing_rows}

    incoming_external_ids = set()
    for entry in medication_entries:
        incoming_external_ids.add(entry.id)
        record = existing_by_external_id.get(entry.id)
        if record is None:
            record = Medication(user_id=user.id, external_id=entry.id)

        record.name = entry.name
        record.dosage = entry.dosage
        record.frequency = MedicationFrequency(entry.frequency)
        record.custom_frequency = entry.custom_frequency
        record.time_of_day = MedicationTimeOfDay(entry.time_of_day) if entry.time_of_day else None
        record.notes = entry.notes
        record.is_active = True

        db.add(record)

    for row in existing_rows:
        if row.external_id not in incoming_external_ids:
            row.is_active = False
            db.add(row)

    db.flush()

    refreshed = (
        db.query(Medication)
        .filter(Medication.user_id == user.id, Medication.is_active.is_(True))
        .order_by(Medication.created_at.asc(), Medication.id.asc())
        .all()
    )
    return [_serialize_medication_row(row) for row in refreshed]


def _hydrate_medications_from_db(*, db: Session, user_id: int) -> list[MedicationEntry]:
    rows = (
        db.query(Medication)
        .filter(Medication.user_id == user_id, Medication.is_active.is_(True))
        .order_by(Medication.created_at.asc(), Medication.id.asc())
        .all()
    )
    return [_serialize_medication_row(row) for row in rows]


def _get_today_status_and_recent_events(*, db: Session, user_id: int, medications: list[MedicationEntry]) -> tuple[list[TodayMedicationStatus], list[MedicationAdherenceEvent]]:
    if not medications:
        return [], []

    medication_ids = [med.id for med in medications]
    today = date.today()

    medication_rows = (
        db.query(Medication)
        .filter(and_(Medication.user_id == user_id, Medication.external_id.in_(medication_ids)))
        .all()
    )
    row_by_external_id = {row.external_id: row for row in medication_rows}
    row_by_id = {row.id: row for row in medication_rows}
    db_medication_ids = [row.id for row in medication_rows]

    if not db_medication_ids:
        return [], []

    today_logs = (
        db.query(MedicationLog)
        .filter(
            MedicationLog.user_id == user_id,
            MedicationLog.medication_id.in_(db_medication_ids),
            MedicationLog.event_date == today,
        )
        .all()
    )
    today_status_by_medication_id = {log.medication_id: log.status.value for log in today_logs}

    today_status = [
        TodayMedicationStatus(
            medication_id=entry.id,
            status=today_status_by_medication_id.get(row_by_external_id[entry.id].id),
        )
        for entry in medications
        if entry.id in row_by_external_id
    ]

    recent_logs = (
        db.query(MedicationLog, Medication.name)
        .join(Medication, Medication.id == MedicationLog.medication_id)
        .filter(MedicationLog.user_id == user_id, MedicationLog.medication_id.in_(db_medication_ids))
        .order_by(MedicationLog.event_date.desc(), MedicationLog.created_at.desc())
        .limit(_RECENT_MEDICATION_EVENT_LIMIT)
        .all()
    )

    recent_events = [
        MedicationAdherenceEvent(
            medication_id=row_by_id[log.medication_id].external_id,
            medication_name=medication_name,
            event_date=log.event_date,
            status=log.status.value,
        )
        for log, medication_name in recent_logs
        if log.medication_id in row_by_id
    ]

    return today_status, recent_events


def get_health_profile_for_user(user: User, db: Session | None = None) -> HealthProfileRead:
    raw = user.health_profile_json
    parsed = _normalize_medications(json.loads(raw)) if raw else {"medications": [], "current_medications": []}

    medications = parsed.get("medications") or []
    if db is not None:
        relational_medications = _hydrate_medications_from_db(db=db, user_id=user.id)
        if not relational_medications and medications:
            migrated = [MedicationEntry(**entry) for entry in medications]
            relational_medications = _sync_medications_to_relational_store(db=db, user=user, medication_entries=migrated)
            db.commit()
        if relational_medications:
            medications = [entry.model_dump() for entry in relational_medications]
            parsed["medications"] = medications
            parsed["current_medications"] = [entry["name"] for entry in medications]

    profile = HealthProfileRead(**parsed, updated_at=user.health_profile_updated_at)

    if db is None:
        return profile

    today_status, recent_events = _get_today_status_and_recent_events(db=db, user_id=user.id, medications=profile.medications)
    profile.todays_medication_status = today_status
    profile.recent_medication_events = recent_events
    return profile


def update_health_profile_for_user(*, db: Session, user: User, payload: HealthProfileUpdateRequest) -> HealthProfileRead:
    normalized_payload = _normalize_medications(payload.model_dump())

    medication_entries = [MedicationEntry(**entry) for entry in normalized_payload.get("medications") or []]
    synced_medications = _sync_medications_to_relational_store(db=db, user=user, medication_entries=medication_entries)

    normalized_payload["medications"] = [entry.model_dump() for entry in synced_medications]
    normalized_payload["current_medications"] = [entry.name for entry in synced_medications]

    user.health_profile_json = json.dumps(normalized_payload)
    user.health_profile_updated_at = datetime.utcnow()

    db.add(user)
    db.commit()
    db.refresh(user)

    return get_health_profile_for_user(user, db)


def upsert_medication_adherence_for_today(*, db: Session, user: User, medication_external_id: str, status: MedicationLogStatus) -> HealthProfileRead:
    medication = (
        db.query(Medication)
        .filter(
            Medication.user_id == user.id,
            Medication.external_id == medication_external_id,
            Medication.is_active.is_(True),
        )
        .first()
    )
    if medication is None:
        raise ValueError("Medication not found")

    today = date.today()
    log = (
        db.query(MedicationLog)
        .filter(
            MedicationLog.user_id == user.id,
            MedicationLog.medication_id == medication.id,
            MedicationLog.event_date == today,
        )
        .first()
    )

    if log is None:
        log = MedicationLog(
            user_id=user.id,
            medication_id=medication.id,
            event_date=today,
            status=status,
        )
    else:
        log.status = status

    db.add(log)
    db.commit()
    db.refresh(user)
    return get_health_profile_for_user(user, db)
