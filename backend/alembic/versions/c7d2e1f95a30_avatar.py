"""Avatar em pixel art do Caçador

Revision ID: c7d2e1f95a30
Revises: b3c1d9a47f21
Create Date: 2026-09-13 14:10:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'c7d2e1f95a30'
down_revision: Union[str, Sequence[str], None] = 'b3c1d9a47f21'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "avatars",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("skin", sa.String(), nullable=False, server_default="media"),
        sa.Column("hair", sa.String(), nullable=False, server_default="curto"),
        sa.Column("hair_color", sa.String(), nullable=False, server_default="preto"),
        sa.Column("outfit", sa.String(), nullable=False, server_default="treino"),
        sa.Column("weapon", sa.String(), nullable=False, server_default="nenhuma"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(op.f("ix_avatars_id"), "avatars", ["id"])
    op.create_index(op.f("ix_avatars_user_id"), "avatars", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_avatars_user_id"), table_name="avatars")
    op.drop_index(op.f("ix_avatars_id"), table_name="avatars")
    op.drop_table("avatars")
