from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.avatar import (
    SLOTS,
    catalog_payload,
    equipped_payload,
    find_piece,
    get_or_create_avatar,
    is_unlocked,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.gamification import get_or_create_progress, rank_for_xp

router = APIRouter(prefix="/avatar", tags=["avatar"])


def build_response(db: Session, user: models.User) -> dict:
    progress = get_or_create_progress(db, user)
    avatar = get_or_create_avatar(db, user)

    return {
        "equipped": equipped_payload(avatar),
        "rank": rank_for_xp(progress.xp),
        "catalog": catalog_payload(rank_for_xp(progress.xp)),
    }


@router.get("/", response_model=schemas.AvatarResponse)
def read_avatar(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return build_response(db, current_user)


@router.put("/", response_model=schemas.AvatarResponse)
def update_avatar(
    payload: schemas.AvatarEquipped,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    progress = get_or_create_progress(db, current_user)
    rank = rank_for_xp(progress.xp)

    avatar = get_or_create_avatar(db, current_user)

    for slot in SLOTS:
        piece_id = getattr(payload, slot)
        piece = find_piece(slot, piece_id)

        if piece is None:
            raise HTTPException(
                status_code=404,
                detail=f"Peça desconhecida para {slot}: {piece_id}",
            )

        # O rank é a única moeda do Sistema: sem ele a peça nem entra.
        if not is_unlocked(piece, rank):
            raise HTTPException(
                status_code=403,
                detail=f"{piece.name} exige o rank {piece.rank}.",
            )

        setattr(avatar, slot, piece_id)

    db.commit()

    return build_response(db, current_user)
