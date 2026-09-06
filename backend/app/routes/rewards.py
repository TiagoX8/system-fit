from datetime import date

from fastapi import APIRouter, Depends, HTTPException
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


def get_owned_reward(db: Session, reward_id: int, user_id: int) -> models.Reward:
    reward = (
        db.query(models.Reward)
        .filter(models.Reward.id == reward_id, models.Reward.user_id == user_id)
        .first()
    )

    if not reward:
        raise HTTPException(status_code=404, detail="Recompensa não encontrada")

    return reward


def get_owned_punishment(db: Session, punishment_id: int, user_id: int) -> models.Punishment:
    punishment = (
        db.query(models.Punishment)
        .filter(models.Punishment.id == punishment_id, models.Punishment.user_id == user_id)
        .first()
    )

    if not punishment:
        raise HTTPException(status_code=404, detail="Penalidade não encontrada")

    return punishment


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


@rewards_router.post("/", response_model=schemas.RewardResponse)
def create_reward(
    payload: schemas.RewardCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    reward = models.Reward(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        threshold_weeks=payload.threshold_weeks,
    )

    db.add(reward)
    db.commit()
    db.refresh(reward)

    return reward


@rewards_router.put("/{reward_id}", response_model=schemas.RewardResponse)
def update_reward(
    reward_id: int,
    payload: schemas.RewardUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    reward = get_owned_reward(db, reward_id, current_user.id)

    reward.title = payload.title
    reward.description = payload.description

    if payload.threshold_weeks != reward.threshold_weeks:
        # Meta nova: a recompensa volta a ser um objetivo a conquistar.
        reward.threshold_weeks = payload.threshold_weeks
        reward.unlocked = False
        reward.unlocked_at = None

    db.commit()
    db.refresh(reward)

    return reward


@rewards_router.delete("/{reward_id}")
def delete_reward(
    reward_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    reward = get_owned_reward(db, reward_id, current_user.id)

    db.delete(reward)
    db.commit()

    return {"message": "Recompensa removida"}


@punishments_router.post("/", response_model=schemas.PunishmentResponse)
def create_punishment(
    payload: schemas.PunishmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    punishment = models.Punishment(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        threshold_streak=payload.threshold_streak,
    )

    db.add(punishment)
    db.commit()
    db.refresh(punishment)

    return punishment


@punishments_router.put("/{punishment_id}", response_model=schemas.PunishmentResponse)
def update_punishment(
    punishment_id: int,
    payload: schemas.PunishmentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    punishment = get_owned_punishment(db, punishment_id, current_user.id)

    punishment.title = payload.title
    punishment.description = payload.description

    if payload.threshold_streak != punishment.threshold_streak:
        punishment.threshold_streak = payload.threshold_streak
        punishment.unlocked = False
        punishment.unlocked_at = None

    db.commit()
    db.refresh(punishment)

    return punishment


@punishments_router.delete("/{punishment_id}")
def delete_punishment(
    punishment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    punishment = get_owned_punishment(db, punishment_id, current_user.id)

    db.delete(punishment)
    db.commit()

    return {"message": "Penalidade removida"}
