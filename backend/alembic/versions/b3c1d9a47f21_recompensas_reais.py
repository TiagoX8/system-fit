"""Troca recompensas/punições temáticas por metas reais

Revision ID: b3c1d9a47f21
Revises: a8f500cc3e74
Create Date: 2026-09-03 02:20:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'b3c1d9a47f21'
down_revision: Union[str, Sequence[str], None] = 'a8f500cc3e74'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


REWARDS = [
    (
        1,
        "Refeição livre no fim de semana",
        "1 semana consecutiva: escolha um prato ou sobremesa sem culpa, uma vez.",
    ),
    (
        2,
        "Maratona liberada",
        "2 semanas consecutivas: uma noite de série, filme ou jogo sem cobrança.",
    ),
    (
        4,
        "Compra que você adiou",
        "4 semanas consecutivas: aquele tênis, fone ou camiseta na sua faixa de preço.",
    ),
    (
        12,
        "Rolê grande",
        "12 semanas consecutivas: viagem curta, show ou dia inteiro fora — você ganhou.",
    ),
]

PUNISHMENTS = [
    (
        1,
        "Sem doces por 7 dias",
        "Você falhou com a rotina diária: nada de doce, chocolate ou sobremesa por uma semana.",
    ),
    (
        3,
        "Sem refrigerante e fast food por 14 dias",
        "Três dias sem treinar: só água, café e comida de verdade por duas semanas.",
    ),
    (
        5,
        "Treino em dobro no próximo dia",
        "Cinco dias parado: o Sistema cobra a dívida com o dobro das séries na volta.",
    ),
]


def upgrade() -> None:
    connection = op.get_bind()

    for threshold, title, description in REWARDS:
        connection.execute(
            sa.text(
                "UPDATE rewards SET title = :title, description = :description "
                "WHERE threshold_weeks = :threshold"
            ),
            {"title": title, "description": description, "threshold": threshold},
        )

    for threshold, title, description in PUNISHMENTS:
        connection.execute(
            sa.text(
                "UPDATE punishments SET title = :title, description = :description "
                "WHERE threshold_streak = :threshold"
            ),
            {"title": title, "description": description, "threshold": threshold},
        )

    connection.execute(
        sa.text(
            "INSERT INTO punishments (user_id, title, description, threshold_streak, unlocked) "
            "SELECT u.id, :title, :description, :threshold, false FROM users u "
            "WHERE NOT EXISTS ("
            "  SELECT 1 FROM punishments p "
            "  WHERE p.user_id = u.id AND p.threshold_streak = :threshold"
            ")"
        ),
        {
            "title": PUNISHMENTS[-1][1],
            "description": PUNISHMENTS[-1][2],
            "threshold": PUNISHMENTS[-1][0],
        },
    )


def downgrade() -> None:
    pass
