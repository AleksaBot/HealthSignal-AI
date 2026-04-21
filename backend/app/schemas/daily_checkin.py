from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


DailyStressLevel = Literal["low", "moderate", "high"]


class DailyCheckInUpsertRequest(BaseModel):
    sleep_hours: float | None = Field(default=None, ge=0, le=16)
    energy_level: int | None = Field(default=None, ge=1, le=10)
    stress_level: DailyStressLevel | None = None
    exercised_today: bool | None = None
    note: str | None = Field(default=None, max_length=300)


class DailyCheckInRead(DailyCheckInUpsertRequest):
    id: int
    user_id: int
    date: date
    created_at: datetime
    updated_at: datetime


class DailyCheckInRecentResponse(BaseModel):
    items: list[DailyCheckInRead] = Field(default_factory=list)
