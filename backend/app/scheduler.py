"""Agendamento dos lembretes de treino via Web Push."""

import logging
import os
from datetime import date, datetime
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv

from app.database import SessionLocal
from app.models import Workout, WorkoutLog
from app.push import push_enabled, send_push_to_user

load_dotenv()

logger = logging.getLogger(__name__)

REMINDER_TITLE = "A Sistema convoca você para o treino diário"
SCHEDULER_TIMEZONE = os.getenv("SCHEDULER_TIMEZONE", "America/Sao_Paulo")

TZ = ZoneInfo(SCHEDULER_TIMEZONE)

scheduler = BackgroundScheduler(timezone=SCHEDULER_TIMEZONE)


def scheduled_for_today(workout: Workout, today: date) -> bool:
    if not workout.days_of_week:
        return True

    days = {int(part) for part in workout.days_of_week.split(",") if part.strip()}

    return today.weekday() in days


def dispatch_due_reminders() -> None:
    """Roda a cada minuto e notifica os treinos cujo horário chegou."""
    now = datetime.now(TZ)
    today = now.date()
    db = SessionLocal()

    try:
        workouts = db.query(Workout).all()

        for workout in workouts:
            if workout.scheduled_time.hour != now.hour:
                continue

            if workout.scheduled_time.minute != now.minute:
                continue

            if not scheduled_for_today(workout, today):
                continue

            already_done = (
                db.query(WorkoutLog)
                .filter(
                    WorkoutLog.workout_id == workout.id,
                    WorkoutLog.date == today,
                    WorkoutLog.completed.is_(True),
                )
                .first()
            )

            if already_done:
                continue

            send_push_to_user(
                db,
                workout.user_id,
                title=REMINDER_TITLE,
                body=f"{workout.title} — levante-se, Caçador. A masmorra diária está aberta.",
                url="/dashboard",
            )
    finally:
        db.close()


def start_scheduler() -> None:
    if not push_enabled():
        logger.warning("VAPID não configurado: scheduler de lembretes não foi iniciado")
        return

    if scheduler.running:
        return

    scheduler.add_job(
        dispatch_due_reminders,
        trigger="cron",
        minute="*",
        id="workout_reminders",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.start()
    logger.info("Scheduler de lembretes iniciado (timezone %s)", SCHEDULER_TIMEZONE)
