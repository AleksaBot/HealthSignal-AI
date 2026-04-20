"""add momentum snapshots table

Revision ID: 20260420_0003
Revises: 20260420_0002
Create Date: 2026-04-20 00:30:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260420_0003"
down_revision: Union[str, None] = "20260420_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "momentum_snapshots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=48), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_momentum_snapshots_id"), "momentum_snapshots", ["id"], unique=False)
    op.create_index(op.f("ix_momentum_snapshots_user_id"), "momentum_snapshots", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_momentum_snapshots_user_id"), table_name="momentum_snapshots")
    op.drop_index(op.f("ix_momentum_snapshots_id"), table_name="momentum_snapshots")
    op.drop_table("momentum_snapshots")
