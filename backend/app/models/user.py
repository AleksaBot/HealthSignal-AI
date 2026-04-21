from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    first_name: Mapped[str] = mapped_column(String(80), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    email_verification_token_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email_verification_sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    email_verification_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    password_reset_token_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_reset_sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    password_reset_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    health_profile_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    health_profile_updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    reports = relationship("Report", back_populates="user", cascade="all, delete-orphan")
    medications = relationship("Medication", back_populates="user", cascade="all, delete-orphan")
    medication_logs = relationship("MedicationLog", back_populates="user", cascade="all, delete-orphan")
    momentum_snapshots = relationship("MomentumSnapshot", back_populates="user", cascade="all, delete-orphan")
    daily_checkins = relationship("DailyCheckIn", back_populates="user", cascade="all, delete-orphan")
