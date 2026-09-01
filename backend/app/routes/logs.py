from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("/", response_model=list[schemas.WorkoutLogResponse])
def list_logs(
    limit: int = 180,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.WorkoutLog)
        .filter(models.WorkoutLog.user_id == current_user.id)
        .order_by(models.WorkoutLog.date.desc(), models.WorkoutLog.id.desc())
        .limit(limit)
        .all()
    )
