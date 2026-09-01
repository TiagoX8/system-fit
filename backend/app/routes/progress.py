from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.gamification import build_progress_payload

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("/", response_model=schemas.ProgressResponse)
def get_progress(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return build_progress_payload(db, current_user, date.today())
