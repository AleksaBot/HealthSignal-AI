"""add coach persistent memory tables

Revision ID: 20260427_0005
Revises: 20260420_0004
Create Date: 2026-04-27 00:30:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260427_0005"
down_revision: Union[str, None] = "20260420_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "coach_message_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_coach_message_logs_id"), "coach_message_logs", ["id"], unique=False)
    op.create_index(op.f("ix_coach_message_logs_user_id"), "coach_message_logs", ["user_id"], unique=False)

    op.create_table(
        "coach_memories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_coach_memories_user_id"),
    )
    op.create_index(op.f("ix_coach_memories_id"), "coach_memories", ["id"], unique=False)
    op.create_index(op.f("ix_coach_memories_user_id"), "coach_memories", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_coach_memories_user_id"), table_name="coach_memories")
    op.drop_index(op.f("ix_coach_memories_id"), table_name="coach_memories")
    op.drop_table("coach_memories")

    op.drop_index(op.f("ix_coach_message_logs_user_id"), table_name="coach_message_logs")
    op.drop_index(op.f("ix_coach_message_logs_id"), table_name="coach_message_logs")
    op.drop_table("coach_message_logs")
