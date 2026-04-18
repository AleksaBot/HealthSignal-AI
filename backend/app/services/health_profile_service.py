import json
from datetime import datetime
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.health_profile import HealthProfileRead, HealthProfileUpdateRequest


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

    if medications:
        payload["current_medications"] = [entry["name"] for entry in medications if entry.get("name")]
    else:
        payload["current_medications"] = []

    return payload


def get_health_profile_for_user(user: User) -> HealthProfileRead:
    raw = user.health_profile_json
    if not raw:
        return HealthProfileRead(updated_at=user.health_profile_updated_at)

    parsed = _normalize_medications(json.loads(raw))
    return HealthProfileRead(**parsed, updated_at=user.health_profile_updated_at)


def update_health_profile_for_user(*, db: Session, user: User, payload: HealthProfileUpdateRequest) -> HealthProfileRead:
    normalized_payload = _normalize_medications(payload.model_dump())
    user.health_profile_json = json.dumps(normalized_payload)
    user.health_profile_updated_at = datetime.utcnow()

    db.add(user)
    db.commit()
    db.refresh(user)

    return HealthProfileRead(**normalized_payload, updated_at=user.health_profile_updated_at)
