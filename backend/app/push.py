"""Envio de Web Push (VAPID) para as subscriptions salvas."""

import json
import logging
import os

from dotenv import load_dotenv
from pywebpush import WebPushException, webpush
from sqlalchemy.orm import Session

from app.models import PushSubscription

load_dotenv()

logger = logging.getLogger(__name__)

VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY")
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:admin@example.com")


def push_enabled() -> bool:
    return bool(VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)


def send_push_to_user(db: Session, user_id: int, title: str, body: str, url: str = "/") -> int:
    """Envia uma notificação para todas as subscriptions do usuário.

    Retorna quantas foram entregues. Subscriptions inválidas (404/410) são
    removidas do banco.
    """
    if not push_enabled():
        logger.warning("VAPID não configurado: notificação para user %s ignorada", user_id)
        return 0

    subscriptions = (
        db.query(PushSubscription).filter(PushSubscription.user_id == user_id).all()
    )

    payload = json.dumps({"title": title, "body": body, "url": url})
    sent = 0

    for subscription in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": subscription.endpoint,
                    "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
                },
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_SUBJECT},
            )
            sent += 1
        except WebPushException as error:
            response = error.response

            if response is not None and response.status_code in (404, 410):
                db.delete(subscription)
            else:
                logger.warning("Falha ao enviar push para %s: %s", subscription.endpoint, error)

    db.commit()

    return sent
