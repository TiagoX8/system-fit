"""Regras do "Sistema": XP, ranks, streak, prêmios e penalidades."""

from datetime import date, time, timedelta

from sqlalchemy.orm import Session

from app.models import Progress, Punishment, Reward, User, Workout, WorkoutLog, utcnow

XP_PER_WORKOUT = 50

# XP mínimo acumulado para cada rank.
RANKS: list[tuple[str, int]] = [
    ("E", 0),
    ("D", 750),
    ("C", 2000),
    ("B", 4500),
    ("A", 9000),
    ("S", 16000),
    ("Monarca das Sombras", 30000),
]

DEFAULT_WORKOUTS: list[tuple[str, str]] = [
    ("Flexões", "4 séries até a falha técnica. Peito, ombro e tríceps."),
    ("Agachamento livre", "5 séries de 20 repetições, sem equipamento."),
    ("Prancha isométrica", "4 séries de 60 segundos de core sob tensão."),
    ("Abdominais", "4 séries de 25 repetições."),
    ("Burpees", "5 séries de 15 repetições em ritmo de caçada."),
]

DEFAULT_REWARDS: list[tuple[str, str, int]] = [
    (
        "Refeição livre no fim de semana",
        "1 semana consecutiva: escolha um prato ou sobremesa sem culpa, uma vez.",
        1,
    ),
    (
        "Maratona liberada",
        "2 semanas consecutivas: uma noite de série, filme ou jogo sem cobrança.",
        2,
    ),
    (
        "Compra que você adiou",
        "4 semanas consecutivas: aquele tênis, fone ou camiseta na sua faixa de preço.",
        4,
    ),
    (
        "Rolê grande",
        "12 semanas consecutivas: viagem curta, show ou dia inteiro fora — você ganhou.",
        12,
    ),
]

DEFAULT_PUNISHMENTS: list[tuple[str, str, int]] = [
    (
        "Sem doces por 7 dias",
        "Você falhou com a rotina diária: nada de doce, chocolate ou sobremesa por uma semana.",
        1,
    ),
    (
        "Sem refrigerante e fast food por 14 dias",
        "Três dias sem treinar: só água, café e comida de verdade por duas semanas.",
        3,
    ),
    (
        "Treino em dobro no próximo dia",
        "Cinco dias parado: o Sistema cobra a dívida com o dobro das séries na volta.",
        5,
    ),
]


def rank_for_xp(xp: int) -> str:
    current = RANKS[0][0]

    for name, required in RANKS:
        if xp >= required:
            current = name

    return current


def next_rank_for_xp(xp: int) -> tuple[str | None, int | None]:
    for name, required in RANKS:
        if xp < required:
            return name, required - xp

    return None, None


def get_or_create_progress(db: Session, user: User) -> Progress:
    progress = db.query(Progress).filter(Progress.user_id == user.id).first()

    if progress:
        return progress

    progress = Progress(user_id=user.id, current_streak=0, longest_streak=0, xp=0, rank="E")
    db.add(progress)
    db.commit()
    db.refresh(progress)

    return progress


def seed_user_content(db: Session, user: User) -> None:
    """Cria treinos, prêmios e penalidades padrão para um usuário novo."""
    for index, (title, description) in enumerate(DEFAULT_WORKOUTS):
        db.add(
            Workout(
                user_id=user.id,
                title=title,
                description=description,
                scheduled_time=time(hour=7, minute=(index * 5) % 60),
                days_of_week="0,1,2,3,4",
            )
        )

    for title, description, weeks in DEFAULT_REWARDS:
        db.add(
            Reward(
                user_id=user.id,
                title=title,
                description=description,
                threshold_weeks=weeks,
            )
        )

    for title, description, threshold in DEFAULT_PUNISHMENTS:
        db.add(
            Punishment(
                user_id=user.id,
                title=title,
                description=description,
                threshold_streak=threshold,
            )
        )

    db.commit()


def weeks_completed(progress: Progress) -> int:
    return progress.current_streak // 7


def register_completion(db: Session, user: User, day: date) -> tuple[Progress, list[Reward], str]:
    """Aplica o ganho de XP/streak de um treino concluído em `day`."""
    progress = get_or_create_progress(db, user)

    if progress.last_completed_date == day:
        # Já pontuou hoje: treinos extras no mesmo dia rendem XP, não streak.
        progress.xp += XP_PER_WORKOUT // 2
    else:
        if progress.last_completed_date == day - timedelta(days=1):
            progress.current_streak += 1
        else:
            progress.current_streak = 1

        progress.xp += XP_PER_WORKOUT
        progress.last_completed_date = day

    progress.longest_streak = max(progress.longest_streak, progress.current_streak)
    progress.rank = rank_for_xp(progress.xp)

    unlocked = unlock_rewards(db, user, progress)

    db.commit()
    db.refresh(progress)

    message = (
        f"O Sistema registrou o treino. Sequência de {progress.current_streak} dia(s), "
        f"{progress.xp} XP, rank {progress.rank}."
    )

    return progress, unlocked, message


def unlock_rewards(db: Session, user: User, progress: Progress) -> list[Reward]:
    achieved_weeks = weeks_completed(progress)

    rewards = (
        db.query(Reward)
        .filter(
            Reward.user_id == user.id,
            Reward.unlocked.is_(False),
            Reward.threshold_weeks <= achieved_weeks,
        )
        .all()
    )

    for reward in rewards:
        reward.unlocked = True
        reward.unlocked_at = utcnow()

    return rewards


def evaluate_punishments(db: Session, user: User, today: date) -> list[Punishment]:
    """Quebra a sequência e aplica penalidades quando o usuário falta.

    Chamado sempre que o progresso é lido, para que a penalidade apareça mesmo
    sem nenhuma requisição no dia perdido.
    """
    progress = get_or_create_progress(db, user)

    if progress.last_completed_date is None:
        return []

    missed_days = (today - progress.last_completed_date).days

    if missed_days <= 1:
        return []

    applied = (
        db.query(Punishment)
        .filter(
            Punishment.user_id == user.id,
            Punishment.unlocked.is_(False),
            Punishment.threshold_streak <= missed_days - 1,
        )
        .all()
    )

    for punishment in applied:
        punishment.unlocked = True
        punishment.unlocked_at = utcnow()

    if progress.current_streak > 0:
        progress.current_streak = 0
        progress.xp = max(0, progress.xp - XP_PER_WORKOUT)
        progress.rank = rank_for_xp(progress.xp)

    db.commit()

    return applied


def build_progress_payload(db: Session, user: User, today: date) -> dict:
    evaluate_punishments(db, user, today)

    progress = get_or_create_progress(db, user)

    # A escala de ranks pode mudar entre versões: reavalia o rank guardado.
    rank = rank_for_xp(progress.xp)

    if progress.rank != rank:
        progress.rank = rank
        db.commit()

    next_rank, xp_to_next = next_rank_for_xp(progress.xp)

    rewards = db.query(Reward).filter(Reward.user_id == user.id).order_by(Reward.threshold_weeks).all()
    punishments = (
        db.query(Punishment)
        .filter(Punishment.user_id == user.id)
        .order_by(Punishment.threshold_streak)
        .all()
    )

    return {
        "current_streak": progress.current_streak,
        "longest_streak": progress.longest_streak,
        "xp": progress.xp,
        "rank": progress.rank,
        "next_rank": next_rank,
        "xp_to_next_rank": xp_to_next,
        "weeks_completed": weeks_completed(progress),
        "last_completed_date": progress.last_completed_date,
        "rewards": rewards,
        "punishments": punishments,
    }


def today_logs(db: Session, user: User, day: date) -> list[WorkoutLog]:
    return (
        db.query(WorkoutLog)
        .filter(
            WorkoutLog.user_id == user.id,
            WorkoutLog.date == day,
            WorkoutLog.completed.is_(True),
        )
        .all()
    )
