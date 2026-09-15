"""Avatar do Caçador: catálogo de peças e o que cada rank libera.

O backend guarda apenas a escolha do usuário e decide o que está liberado; o
desenho em pixel art fica no frontend, que lê as cores daqui.
"""

from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.gamification import RANKS
from app.models import Avatar, User

# Ordem dos ranks para comparar quem já pode usar cada peça.
RANK_ORDER: list[str] = [name for name, _ in RANKS]


@dataclass(frozen=True)
class Piece:
    """Peça do avatar. `colors` é o que o frontend usa para pintar."""

    id: str
    name: str
    rank: str
    description: str
    colors: dict[str, str]

    # Detalhes de silhueta que o set adiciona ao corpo base.
    features: list[str] = field(default_factory=list)

    # Quando preenchido, só a classe indicada pode equipar a peça.
    class_id: str | None = None


# ============================================================================
# PEÇAS SEM RANK (aparência do Caçador)
# ============================================================================

SKINS: list[Piece] = [
    Piece("clara", "Clara", "E", "Tom de pele claro", {"skin": "#f2c9a0", "shade": "#d79f76"}),
    Piece("media", "Média", "E", "Tom de pele médio", {"skin": "#d79a68", "shade": "#b1744a"}),
    Piece("morena", "Morena", "E", "Tom de pele moreno", {"skin": "#a86a3d", "shade": "#834d29"}),
    Piece("escura", "Escura", "E", "Tom de pele escuro", {"skin": "#6f4326", "shade": "#4f2d18"}),
]

CLASSES: list[Piece] = [
    Piece(
        "guerreiro",
        "Guerreiro",
        "E",
        "Combate direto: placas pesadas e ombreiras largas.",
        {"primary": "#8f2f2f", "trim": "#e0b25c"},
        ["class_pauldron"],
    ),
    Piece(
        "assassino",
        "Assassino",
        "E",
        "Silêncio e velocidade: capuz e couro leve.",
        {"primary": "#2f2f45", "trim": "#7ee0c0"},
        ["class_hood"],
    ),
    Piece(
        "mago",
        "Mago",
        "E",
        "Poder arcano: manto longo e runas flutuantes.",
        {"primary": "#3a2f6b", "trim": "#8fb2ff"},
        ["class_robe"],
    ),
    Piece(
        "arqueiro",
        "Arqueiro",
        "E",
        "Precisão à distância: aljava nas costas.",
        {"primary": "#2f5b3a", "trim": "#c8e07e"},
        ["class_quiver"],
    ),
]

HAIRS: list[Piece] = [
    Piece("curto", "Curto", "E", "Corte curto de treino", {}),
    Piece("espetado", "Espetado", "E", "Espetado para cima", {}),
    Piece("longo", "Longo", "E", "Comprido até o ombro", {}),
    Piece("moicano", "Moicano", "E", "Faixa central alta", {}),
]

HAIR_COLORS: list[Piece] = [
    Piece("preto", "Preto", "E", "Preto", {"hair": "#2b2b3a", "shade": "#17171f"}),
    Piece("castanho", "Castanho", "E", "Castanho", {"hair": "#5a3a22", "shade": "#3b2515"}),
    Piece("loiro", "Loiro", "E", "Loiro", {"hair": "#d9b45c", "shade": "#a8873c"}),
    Piece("branco", "Branco", "E", "Branco", {"hair": "#dfe6f2", "shade": "#a9b4c6"}),
    Piece("azul", "Azul do Sistema", "E", "Azul néon", {"hair": "#4fa8ff", "shade": "#2c6bb0"}),
]


# ============================================================================
# SETS LIBERADOS POR RANK
# ============================================================================

OUTFITS: list[Piece] = [
    Piece(
        "treino",
        "Uniforme de Treino",
        "E",
        "Camiseta e short de quem está começando a caçada.",
        {"primary": "#3d4657", "secondary": "#2a3140", "trim": "#7f8ba1"},
    ),
    Piece(
        "couro",
        "Couro Reforçado",
        "D",
        "Peitoral de couro para os primeiros combates.",
        {"primary": "#6b4a2b", "secondary": "#4a3220", "trim": "#c39a5f"},
        ["belt"],
    ),
    Piece(
        "guarda",
        "Cota da Guarda",
        "C",
        "Malha de aço com ombreiras da guarda da cidade.",
        {"primary": "#5b6675", "secondary": "#39424e", "trim": "#aab6c6"},
        ["belt", "shoulders"],
    ),
    Piece(
        "cacador",
        "Armadura de Caçador",
        "B",
        "Placas azuis do Sistema e capa curta.",
        {"primary": "#26456d", "secondary": "#182c47", "trim": "#5fa8ff", "cape": "#1d3a63"},
        ["belt", "shoulders", "cape"],
    ),
    Piece(
        "elite",
        "Placas de Elite",
        "A",
        "Armadura completa com elmo aberto.",
        {"primary": "#2b3f6b", "secondary": "#1a2745", "trim": "#8fd0ff", "cape": "#25406e"},
        ["belt", "shoulders", "cape", "helmet"],
    ),
    Piece(
        "soberano",
        "Manto Soberano",
        "S",
        "Manto longo dourado sobre placas escuras.",
        {"primary": "#2a2a3d", "secondary": "#1a1a28", "trim": "#e9c46a", "cape": "#7a5c1f"},
        ["belt", "shoulders", "cape", "helmet"],
    ),
    Piece(
        "monarca",
        "Sombras do Monarca",
        "Monarca das Sombras",
        "Armadura viva envolta na aura das sombras.",
        {"primary": "#241b3a", "secondary": "#150f24", "trim": "#a06bff", "cape": "#3a2263"},
        ["belt", "shoulders", "cape", "helmet", "aura"],
    ),
    Piece(
        "monarca_guerreiro",
        "Monarca de Ferro",
        "Monarca das Sombras",
        "Set exclusivo do Guerreiro: placas colossais e elmo coroado.",
        {"primary": "#4a1d1d", "secondary": "#2a1010", "trim": "#e0b25c", "cape": "#7a1f1f"},
        ["belt", "shoulders", "cape", "helmet", "aura"],
        "guerreiro",
    ),
    Piece(
        "monarca_assassino",
        "Monarca Silente",
        "Monarca das Sombras",
        "Set exclusivo do Assassino: capuz vivo e manto rasgado.",
        {"primary": "#16202b", "secondary": "#0d1319", "trim": "#7ee0c0", "cape": "#123028"},
        ["belt", "cape", "hood", "aura"],
        "assassino",
    ),
    Piece(
        "monarca_mago",
        "Monarca Arcano",
        "Monarca das Sombras",
        "Set exclusivo do Mago: manto longo com runas suspensas.",
        {"primary": "#241c4e", "secondary": "#150f2e", "trim": "#8fb2ff", "cape": "#2c1f63"},
        ["belt", "shoulders", "cape", "robe", "aura"],
        "mago",
    ),
    Piece(
        "monarca_arqueiro",
        "Monarca do Vento",
        "Monarca das Sombras",
        "Set exclusivo do Arqueiro: couro leve, aljava dupla e capa curta.",
        {"primary": "#1c3a28", "secondary": "#122519", "trim": "#c8e07e", "cape": "#1f4a2c"},
        ["belt", "shoulders", "cape", "quiver", "aura"],
        "arqueiro",
    ),
]

WEAPONS: list[Piece] = [
    Piece("nenhuma", "Mãos livres", "E", "Sem arma: só o corpo.", {}),
    Piece(
        "bastao",
        "Bastão de Treino",
        "D",
        "Madeira simples para condicionamento.",
        {"blade": "#a97c4d", "grip": "#5d4127"},
    ),
    Piece(
        "adaga",
        "Adaga Curta",
        "C",
        "Lâmina leve de aço.",
        {"blade": "#c6d0dd", "grip": "#3b3b4a"},
    ),
    Piece(
        "espada",
        "Espada do Caçador",
        "B",
        "Lâmina longa com fio azul.",
        {"blade": "#dbe6f5", "grip": "#2b3b57"},
    ),
    Piece(
        "machado",
        "Machado de Guerra",
        "A",
        "Cabeça larga, dano bruto.",
        {"blade": "#b9c4d4", "grip": "#4a3320"},
    ),
    Piece(
        "alabarda",
        "Alabarda Real",
        "S",
        "Haste longa com detalhe dourado.",
        {"blade": "#f0e2b6", "grip": "#8a6a24"},
    ),
    Piece(
        "sombras",
        "Lâmina das Sombras",
        "Monarca das Sombras",
        "A arma que o próprio Sistema forjou.",
        {"blade": "#c9a6ff", "grip": "#2a1b45"},
    ),
]


SLOTS: dict[str, list[Piece]] = {
    "char_class": CLASSES,
    "skin": SKINS,
    "hair": HAIRS,
    "hair_color": HAIR_COLORS,
    "outfit": OUTFITS,
    "weapon": WEAPONS,
}

DEFAULTS: dict[str, str] = {
    "char_class": "guerreiro",
    "skin": "media",
    "hair": "curto",
    "hair_color": "preto",
    "outfit": "treino",
    "weapon": "nenhuma",
}


# ============================================================================
# LIBERAÇÃO POR RANK
# ============================================================================

def rank_index(rank: str) -> int:
    """Posição do rank na escala; ranks desconhecidos valem o primeiro."""

    if rank in RANK_ORDER:
        return RANK_ORDER.index(rank)

    return 0


def is_unlocked(piece: Piece, rank: str) -> bool:
    return rank_index(rank) >= rank_index(piece.rank)


def fits_class(piece: Piece, class_id: str) -> bool:
    """Peça sem `class_id` serve para todos; com `class_id` só para a classe."""

    return piece.class_id is None or piece.class_id == class_id


def find_piece(slot: str, piece_id: str) -> Piece | None:
    for piece in SLOTS[slot]:
        if piece.id == piece_id:
            return piece

    return None


def catalog_payload(rank: str) -> dict[str, list[dict]]:
    """Catálogo completo, marcando o que o rank atual já liberou."""

    return {
        slot: [
            {
                "id": piece.id,
                "name": piece.name,
                "rank": piece.rank,
                "description": piece.description,
                "colors": piece.colors,
                "features": piece.features,
                "class_id": piece.class_id,
                "unlocked": is_unlocked(piece, rank),
            }
            for piece in pieces
        ]
        for slot, pieces in SLOTS.items()
    }


# ============================================================================
# PERSISTÊNCIA
# ============================================================================

def get_or_create_avatar(db: Session, user: User) -> Avatar:
    avatar = db.query(Avatar).filter(Avatar.user_id == user.id).first()

    if avatar:
        return avatar

    avatar = Avatar(user_id=user.id, **DEFAULTS)

    db.add(avatar)
    db.commit()
    db.refresh(avatar)

    return avatar


def equipped_payload(avatar: Avatar) -> dict[str, str]:
    return {slot: getattr(avatar, slot) for slot in SLOTS}
