from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.gamification import build_progress_payload, evaluate_punishments, register_completion
from app.models import utcnow

router = APIRouter(prefix="/workouts", tags=["workouts"])


def serialize(workout: models.Workout, completed_today: bool) -> dict:
    return {
        "id": workout.id,
        "user_id": workout.user_id,
        "title": workout.title,
        "description": workout.description,
        "scheduled_time": workout.scheduled_time,
        "days_of_week": workout.days_of_week,
        "created_at": workout.created_at,
        "completed_today": completed_today,
    }


def completed_workout_ids(db: Session, user_id: int, day: date) -> set[int]:
    rows = (
        db.query(models.WorkoutLog.workout_id)
        .filter(
            models.WorkoutLog.user_id == user_id,
            models.WorkoutLog.date == day,
            models.WorkoutLog.completed.is_(True),
        )
        .all()
    )

    return {row[0] for row in rows}


def get_owned_workout(db: Session, workout_id: int, user_id: int) -> models.Workout:
    workout = (
        db.query(models.Workout)
        .filter(models.Workout.id == workout_id, models.Workout.user_id == user_id)
        .first()
    )

    if not workout:
        raise HTTPException(status_code=404, detail="Treino não encontrado")

    return workout


@router.get("/", response_model=list[schemas.WorkoutResponse])
def list_workouts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    workouts = (
        db.query(models.Workout)
        .filter(models.Workout.user_id == current_user.id)
        .order_by(models.Workout.scheduled_time, models.Workout.id)
        .all()
    )

    done = completed_workout_ids(db, current_user.id, date.today())

    return [serialize(workout, workout.id in done) for workout in workouts]


@router.post("/", response_model=schemas.WorkoutResponse)
def create_workout(
    payload: schemas.WorkoutCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    workout = models.Workout(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        scheduled_time=payload.scheduled_time,
        days_of_week=",".join(str(day) for day in payload.days_of_week),
    )

    db.add(workout)
    db.commit()
    db.refresh(workout)

    return serialize(workout, False)


@router.put("/{workout_id}", response_model=schemas.WorkoutResponse)
def update_workout(
    workout_id: int,
    payload: schemas.WorkoutUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    workout = get_owned_workout(db, workout_id, current_user.id)

    workout.title = payload.title
    workout.description = payload.description
    workout.scheduled_time = payload.scheduled_time
    workout.days_of_week = ",".join(str(day) for day in payload.days_of_week)

    db.commit()
    db.refresh(workout)

    done = completed_workout_ids(db, current_user.id, date.today())

    return serialize(workout, workout.id in done)


@router.delete("/{workout_id}")
def delete_workout(
    workout_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    workout = get_owned_workout(db, workout_id, current_user.id)

    db.query(models.WorkoutLog).filter(models.WorkoutLog.workout_id == workout.id).delete()
    db.delete(workout)
    db.commit()

    return {"message": "Treino removido"}


@router.post("/{workout_id}/complete", response_model=schemas.CompleteWorkoutResponse)
def complete_workout(
    workout_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    workout = get_owned_workout(db, workout_id, current_user.id)
    today = date.today()

    evaluate_punishments(db, current_user, today)

    log = (
        db.query(models.WorkoutLog)
        .filter(
            models.WorkoutLog.workout_id == workout.id,
            models.WorkoutLog.date == today,
        )
        .first()
    )

    if log and log.completed:
        raise HTTPException(status_code=400, detail="Treino já concluído hoje")

    if not log:
        log = models.WorkoutLog(
            user_id=current_user.id,
            workout_id=workout.id,
            date=today,
        )
        db.add(log)

    log.completed = True
    log.completed_at = utcnow()
    db.commit()
    db.refresh(log)

    _, unlocked, message = register_completion(db, current_user, today)

    return {
        "log": log,
        "progress": build_progress_payload(db, current_user, today),
        "message": message,
        "unlocked_rewards": unlocked,
    }
