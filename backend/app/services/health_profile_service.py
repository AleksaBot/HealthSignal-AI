import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.health_profile import HealthProfileRead, HealthProfileUpdateRequest


def get_health_profile_for_user(user: User) -> HealthProfileRead:
    raw = user.health_profile_json
    if not raw:
        return HealthProfileRead(updated_at=user.health_profile_updated_at)

    parsed = json.loads(raw)
    return HealthProfileRead(**parsed, updated_at=user.health_profile_updated_at)


def update_health_profile_for_user(*, db: Session, user: User, payload: HealthProfileUpdateRequest) -> HealthProfileRead:
    normalized_payload = payload.model_dump()
    user.health_profile_json = json.dumps(normalized_payload)
    user.health_profile_updated_at = datetime.utcnow()

    db.add(user)
    db.commit()
    db.refresh(user)

    return HealthProfileRead(**normalized_payload, updated_at=user.health_profile_updated_at)
