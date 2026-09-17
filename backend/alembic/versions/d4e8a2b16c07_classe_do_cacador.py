"""Classe do Caçador no avatar

Revision ID: d4e8a2b16c07
Revises: c7d2e1f95a30
Create Date: 2026-09-13 20:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'd4e8a2b16c07'
down_revision: Union[str, Sequence[str], None] = 'c7d2e1f95a30'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "avatars",
        sa.Column("char_class", sa.String(), nullable=False, server_default="guerreiro"),
    )


def downgrade() -> None:
    op.drop_column("avatars", "char_class")
