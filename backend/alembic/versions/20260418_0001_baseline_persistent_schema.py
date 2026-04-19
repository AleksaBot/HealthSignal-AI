"""baseline persistent schema

Revision ID: 20260418_0001
Revises: 
Create Date: 2026-04-18 00:00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260418_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


MEDICATION_FREQUENCY_VALUES = ("daily", "weekly", "as_needed", "custom")
MEDICATION_TIME_OF_DAY_VALUES = ("morning", "afternoon", "evening", "bedtime")
MEDICATION_LOG_STATUS_VALUES = ("taken", "skipped")


def _enum_types_for_dialect(dialect_name: str) -> tuple[sa.Enum, sa.Enum, sa.Enum]:
    if dialect_name == "postgresql":
        return (
            postgresql.ENUM(*MEDICATION_FREQUENCY_VALUES, name="medicationfrequency", create_type=False),
            postgresql.ENUM(*MEDICATION_TIME_OF_DAY_VALUES, name="medicationtimeofday", create_type=False),
            postgresql.ENUM(*MEDICATION_LOG_STATUS_VALUES, name="medicationlogstatus", create_type=False),
        )

    return (
        sa.Enum(*MEDICATION_FREQUENCY_VALUES, name="medicationfrequency"),
        sa.Enum(*MEDICATION_TIME_OF_DAY_VALUES, name="medicationtimeofday"),
        sa.Enum(*MEDICATION_LOG_STATUS_VALUES, name="medicationlogstatus"),
    )


def upgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    medication_frequency_enum, medication_time_of_day_enum, medication_log_status_enum = _enum_types_for_dialect(dialect_name)

    if dialect_name == "postgresql":
        medication_frequency_enum.create(bind, checkfirst=True)
        medication_time_of_day_enum.create(bind, checkfirst=True)
        medication_log_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("first_name", sa.String(length=80), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("health_profile_json", sa.Text(), nullable=True),
        sa.Column("health_profile_updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)

    op.create_table(
        "reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("report_type", sa.String(length=64), nullable=False),
        sa.Column("input_payload", sa.Text(), nullable=False),
        sa.Column("output_summary", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_reports_id"), "reports", ["id"], unique=False)

    op.create_table(
        "medications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("external_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("dosage", sa.String(length=120), nullable=True),
        sa.Column("frequency", medication_frequency_enum, nullable=False),
        sa.Column("custom_frequency", sa.String(length=120), nullable=True),
        sa.Column("time_of_day", medication_time_of_day_enum, nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "external_id", name="uq_medications_user_external_id"),
    )
    op.create_index(op.f("ix_medications_id"), "medications", ["id"], unique=False)
    op.create_index(op.f("ix_medications_user_id"), "medications", ["user_id"], unique=False)

    op.create_table(
        "medication_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("medication_id", sa.Integer(), nullable=False),
        sa.Column("event_date", sa.Date(), nullable=False),
        sa.Column("status", medication_log_status_enum, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["medication_id"], ["medications.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("medication_id", "event_date", name="uq_medication_logs_medication_date"),
    )
    op.create_index(op.f("ix_medication_logs_id"), "medication_logs", ["id"], unique=False)
    op.create_index(op.f("ix_medication_logs_medication_id"), "medication_logs", ["medication_id"], unique=False)
    op.create_index(op.f("ix_medication_logs_user_id"), "medication_logs", ["user_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    medication_frequency_enum, medication_time_of_day_enum, medication_log_status_enum = _enum_types_for_dialect(dialect_name)

    op.drop_index(op.f("ix_medication_logs_user_id"), table_name="medication_logs")
    op.drop_index(op.f("ix_medication_logs_medication_id"), table_name="medication_logs")
    op.drop_index(op.f("ix_medication_logs_id"), table_name="medication_logs")
    op.drop_table("medication_logs")

    op.drop_index(op.f("ix_medications_user_id"), table_name="medications")
    op.drop_index(op.f("ix_medications_id"), table_name="medications")
    op.drop_table("medications")

    op.drop_index(op.f("ix_reports_id"), table_name="reports")
    op.drop_table("reports")

    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")

    if dialect_name == "postgresql":
        medication_log_status_enum.drop(bind, checkfirst=True)
        medication_time_of_day_enum.drop(bind, checkfirst=True)
        medication_frequency_enum.drop(bind, checkfirst=True)
