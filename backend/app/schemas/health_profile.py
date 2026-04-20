from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


SexChoice = Literal["female", "male", "non_binary", "other", "prefer_not_to_say"]
ActivityLevelChoice = Literal["low", "moderate", "active", "very_active"]
SmokingStatusChoice = Literal["none", "former", "occasional", "daily"]
AlcoholFrequencyChoice = Literal["never", "monthly", "weekly", "several_times_weekly", "daily"]
StressLevelChoice = Literal["low", "moderate", "high", "very_high"]
MedicationFrequencyChoice = Literal["daily", "weekly", "as_needed", "custom"]
MedicationTimeOfDayChoice = Literal["morning", "afternoon", "evening", "bedtime"]
MedicationLogStatusChoice = Literal["taken", "skipped"]


class MedicationEntry(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=120)
    dosage: str | None = Field(default=None, max_length=120)
    frequency: MedicationFrequencyChoice = "daily"
    custom_frequency: str | None = Field(default=None, max_length=120)
    time_of_day: MedicationTimeOfDayChoice | None = None
    notes: str | None = Field(default=None, max_length=300)


class MedicationAdherenceEvent(BaseModel):
    medication_id: str = Field(min_length=1, max_length=64)
    medication_name: str = Field(min_length=1, max_length=120)
    event_date: date
    status: MedicationLogStatusChoice


class TodayMedicationStatus(BaseModel):
    medication_id: str = Field(min_length=1, max_length=64)
    status: MedicationLogStatusChoice | None = None


class MedicationAdherenceUpdateRequest(BaseModel):
    medication_id: str = Field(min_length=1, max_length=64)
    status: MedicationLogStatusChoice


class HealthProfileUpdateRequest(BaseModel):
    age: int | None = Field(default=None, ge=13, le=120)
    sex: SexChoice | None = None
    height_cm: float | None = Field(default=None, ge=120, le=240)
    weight_kg: float | None = Field(default=None, ge=30, le=350)
    activity_level: ActivityLevelChoice | None = None
    smoking_vaping_status: SmokingStatusChoice | None = None
    alcohol_frequency: AlcoholFrequencyChoice | None = None
    sleep_average_hours: float | None = Field(default=None, ge=0, le=16)
    stress_level: StressLevelChoice | None = None
    known_conditions: list[str] = Field(default_factory=list, max_length=30)
    current_medications: list[str] = Field(default_factory=list, max_length=30)
    medications: list[MedicationEntry] = Field(default_factory=list, max_length=100)
    family_history: list[str] = Field(default_factory=list, max_length=30)
    systolic_bp: int | None = Field(default=None, ge=70, le=260)
    diastolic_bp: int | None = Field(default=None, ge=40, le=160)
    total_cholesterol: int | None = Field(default=None, ge=80, le=500)
    medication_reminders_enabled: bool = False
    medication_reminder_time: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    weekly_health_summary_enabled: bool = False


class HealthProfileRead(HealthProfileUpdateRequest):
    updated_at: datetime | None = None
    todays_medication_status: list[TodayMedicationStatus] = Field(default_factory=list)
    recent_medication_events: list[MedicationAdherenceEvent] = Field(default_factory=list)


class RiskInsightSection(BaseModel):
    level: Literal["positive", "watch", "caution"]
    summary: str
    factors: list[str] = Field(default_factory=list)


class HealthRiskInsightsResponse(BaseModel):
    generated_at: datetime
    profile_snapshot: HealthProfileRead
    overall_health_snapshot: str
    cardiovascular_caution: RiskInsightSection
    metabolic_weight_caution: RiskInsightSection
    lifestyle_risk_factors: list[str]
    positive_habits: list[str]
    top_priorities_for_improvement: list[str]
    suggested_next_steps: list[str]
    disclaimer: str = "This is educational guidance and not a diagnosis. For personal medical care, consult a licensed clinician."
