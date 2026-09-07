import logging
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app import models, schemas
from app.coach import (
    COACH_MESSAGES_PER_DAY,
    CoachQuotaExceeded,
    CoachUnavailable,
    ask_coach,
    check_and_count_usage,
    is_enabled,
    refund_usage,
    stream_coach,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.gamification import get_or_create_progress

logger = logging.getLogger(__name__)

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
        refund_usage(current_user.id)

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)
        ) from error

    return {"reply": reply, "remaining_today": remaining}


@router.post("/chat/stream")
async def chat_stream(
    payload: schemas.CoachRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Mesma resposta do `/coach/chat`, entregue em texto puro conforme sai."""
    if not is_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="O Conselheiro do Sistema não está configurado no servidor.",
        )

    try:
        check_and_count_usage(current_user.id)
    except CoachQuotaExceeded as error:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(error)
        ) from error

    history = [message.model_dump() for message in payload.messages]
    context = await run_in_threadpool(build_context, db, current_user)

    chunks = stream_coach(history, context).__aiter__()

    # O primeiro pedaço é puxado aqui: se o stream não entrega nada, ainda dá
    # para responder pela chamada normal, e só então o erro vira HTTP 502.
    try:
        first = await anext(chunks, "")
    except CoachUnavailable as stream_error:
        logger.warning("Stream do Conselheiro falhou: %s", stream_error)

        try:
            reply = await run_in_threadpool(ask_coach, history, context)
        except CoachUnavailable as error:
            refund_usage(current_user.id)

            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)
            ) from error

        return StreamingResponse(
            iter([reply]),
            media_type="text/plain; charset=utf-8",
            headers={"X-Accel-Buffering": "no", "Cache-Control": "no-store"},
        )

    async def body() -> AsyncIterator[str]:
        yield first

        try:
            async for chunk in chunks:
                yield chunk
        except CoachUnavailable as error:
            # Conexão caiu no meio: o texto já enviado fica, o resto vira aviso.
            yield f"\n\n[{error}]"
        except Exception:
            logger.exception("Stream do Conselheiro interrompido.")

            yield "\n\n[A resposta foi interrompida. Tente novamente.]"

    return StreamingResponse(
        body(),
        media_type="text/plain; charset=utf-8",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-store"},
    )
