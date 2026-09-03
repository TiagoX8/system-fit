import os

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.push import VAPID_PUBLIC_KEY, send_push_to_user
from app.scheduler import dispatch_due_reminders

load_dotenv()

CRON_SECRET = os.getenv("CRON_SECRET")

router = APIRouter(prefix="/push", tags=["push"])


@router.get("/public-key", response_model=schemas.VapidPublicKeyResponse)
def public_key():
    return {"public_key": VAPID_PUBLIC_KEY}


@router.post("/subscribe", response_model=schemas.PushSubscriptionResponse)
def subscribe(
    payload: schemas.PushSubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    subscription = (
        db.query(models.PushSubscription)
        .filter(models.PushSubscription.endpoint == payload.endpoint)
        .first()
    )

    if not subscription:
        subscription = models.PushSubscription(endpoint=payload.endpoint)
        db.add(subscription)

    subscription.user_id = current_user.id
    subscription.p256dh = payload.keys.p256dh
    subscription.auth = payload.keys.auth

    db.commit()
    db.refresh(subscription)

    return subscription


@router.post("/test")
def send_test_notification(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    sent = send_push_to_user(
        db,
        current_user.id,
        title="A Sistema convoca você",
        body="Notificação de teste: seu treino diário aguarda, Caçador.",
    )

    return {"sent": sent}


@router.post("/dispatch")
def dispatch_reminders(
    window_minutes: int = Query(default=5, ge=1, le=60),
    x_cron_secret: str | None = Header(default=None),
):
    """Dispara os lembretes vencidos na janela. Usado por um cron externo."""
    if not CRON_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CRON_SECRET não configurado",
        )

    if x_cron_secret != CRON_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Cron secret inválido"
        )

    return {"sent": dispatch_due_reminders(window_minutes=window_minutes)}
