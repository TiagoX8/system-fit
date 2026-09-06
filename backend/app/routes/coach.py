from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.coach import (
    COACH_MESSAGES_PER_DAY,
    CoachQuotaExceeded,
    CoachUnavailable,
    ask_coach,
    check_and_count_usage,
    is_enabled,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.gamification import get_or_create_progress

router = APIRouter(prefix="/coach", tags=["coach"])

DAY_LABELS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]


def build_context(db: Session, user: models.User) -> str:
    """Resumo da rotina enviado junto da primeira mensagem do chat."""
    workouts = (
        db.query(models.Workout).filter(models.Workout.user_id == user.id).all()
    )
    progress = get_or_create_progress(db, user)

    lines = [
        f"Rank {progress.rank}, {progress.xp} XP, "
        f"sequência de {progress.current_streak} dia(s)."
    ]

    if workouts:
        lines.append("Treinos cadastrados:")

        for workout in workouts:
            days = [
                DAY_LABELS[int(part)]
                for part in workout.days_of_week.split(",")
                if part.strip().isdigit()
            ]
            when = ", ".join(days) if days else "todos os dias"
            lines.append(f"- {workout.title} ({when})")
    else:
        lines.append("Nenhum treino cadastrado ainda.")

    return "\n".join(lines)


@router.get("/status", response_model=schemas.CoachStatusResponse)
def coach_status(_: models.User = Depends(get_current_user)):
    return {"enabled": is_enabled(), "messages_per_day": COACH_MESSAGES_PER_DAY}


@router.post("/chat", response_model=schemas.CoachResponse)
def chat(
    payload: schemas.CoachRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not is_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="O Conselheiro do Sistema não está configurado no servidor.",
        )

    try:
        remaining = check_and_count_usage(current_user.id)
    except CoachQuotaExceeded as error:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(error)
        ) from error

    history = [message.model_dump() for message in payload.messages]

    try:
        reply = ask_coach(history, build_context(db, current_user))
    except CoachUnavailable as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)
        ) from error

    return {"reply": reply, "remaining_today": remaining}
