from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.gamification import (
    evaluate_punishments,
    get_or_create_progress,
    unlock_rewards,
)

rewards_router = APIRouter(prefix="/rewards", tags=["rewards"])
punishments_router = APIRouter(prefix="/punishments", tags=["punishments"])


@rewards_router.get("/", response_model=list[schemas.RewardResponse])
def list_rewards(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    progress = get_or_create_progress(db, current_user)
    unlock_rewards(db, current_user, progress)
    db.commit()

    return (
        db.query(models.Reward)
        .filter(models.Reward.user_id == current_user.id)
        .order_by(models.Reward.threshold_weeks)
        .all()
    )


@punishments_router.get("/", response_model=list[schemas.PunishmentResponse])
def list_punishments(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    evaluate_punishments(db, current_user, date.today())

    return (
        db.query(models.Punishment)
        .filter(models.Punishment.user_id == current_user.id)
        .order_by(models.Punishment.threshold_streak)
        .all()
    )
