from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class MomentumSnapshotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    score: int = Field(ge=0, le=100)
    label: str
    created_at: datetime


class MomentumHistoryResponse(BaseModel):
    snapshots: list[MomentumSnapshotRead]


class MomentumLatestResponse(BaseModel):
    snapshot: MomentumSnapshotRead | None = None


class MomentumSummaryStats(BaseModel):
    best_score_last_30_days: int | None = None
    average_score_last_30_days: float | None = None
    current_streak: int = 0


class MomentumSummaryResponse(BaseModel):
    trend_direction: str
    weekly_delta: int
    stats: MomentumSummaryStats
