from datetime import date, datetime
from enum import Enum

from sqlalchemy import Boolean, Date, DateTime, Enum as SqlEnum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class MedicationFrequency(str, Enum):
    daily = "daily"
    weekly = "weekly"
    as_needed = "as_needed"
    custom = "custom"


class MedicationTimeOfDay(str, Enum):
    morning = "morning"
    afternoon = "afternoon"
    evening = "evening"
    bedtime = "bedtime"


class MedicationLogStatus(str, Enum):
    taken = "taken"
    skipped = "skipped"


class Medication(Base):
    __tablename__ = "medications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    external_id: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    dosage: Mapped[str | None] = mapped_column(String(120), nullable=True)
    frequency: Mapped[MedicationFrequency] = mapped_column(SqlEnum(MedicationFrequency), nullable=False, default=MedicationFrequency.daily)
    custom_frequency: Mapped[str | None] = mapped_column(String(120), nullable=True)
    time_of_day: Mapped[MedicationTimeOfDay | None] = mapped_column(SqlEnum(MedicationTimeOfDay), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="medications")
    logs = relationship("MedicationLog", back_populates="medication", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("user_id", "external_id", name="uq_medications_user_external_id"),)


class MedicationLog(Base):
    __tablename__ = "medication_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    medication_id: Mapped[int] = mapped_column(ForeignKey("medications.id", ondelete="CASCADE"), nullable=False, index=True)
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[MedicationLogStatus] = mapped_column(SqlEnum(MedicationLogStatus), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="medication_logs")
    medication = relationship("Medication", back_populates="logs")

    __table_args__ = (UniqueConstraint("medication_id", "event_date", name="uq_medication_logs_medication_date"),)
