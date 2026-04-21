"""add daily checkins table

Revision ID: 20260420_0004
Revises: 20260420_0003
Create Date: 2026-04-20 02:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260420_0004"
down_revision: Union[str, None] = "20260420_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "daily_checkins",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("sleep_hours", sa.Float(), nullable=True),
        sa.Column("energy_level", sa.Integer(), nullable=True),
        sa.Column("stress_level", sa.String(length=20), nullable=True),
        sa.Column("exercised_today", sa.Boolean(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "date", name="uq_daily_checkins_user_date"),
    )
    op.create_index(op.f("ix_daily_checkins_id"), "daily_checkins", ["id"], unique=False)
    op.create_index(op.f("ix_daily_checkins_user_id"), "daily_checkins", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_daily_checkins_user_id"), table_name="daily_checkins")
    op.drop_index(op.f("ix_daily_checkins_id"), table_name="daily_checkins")
    op.drop_table("daily_checkins")
