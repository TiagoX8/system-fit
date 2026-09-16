"""Avatar do Caçador: catálogo de peças e o que cada rank libera.

O backend guarda apenas a escolha do usuário e decide o que está liberado; o
desenho 3D fica no frontend, que lê daqui as cores e a lista de `features` — é
`features` que muda a silhueta da peça (placas, ombreiras com espinho, capa
rasgada, manto com fenda, elmo chifrudo, forma da arma...).

Cada rank tem sets e armas gerais (qualquer classe usa) e, em paralelo, uma
linha exclusiva por classe: peça com `class_id` só serve para aquela classe.
"""

from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.gamification import RANKS
from app.models import Avatar, User

# Ordem dos ranks para comparar quem já pode usar cada peça.
RANK_ORDER: list[str] = [name for name, _ in RANKS]

MONARCA = "Monarca das Sombras"


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
    Piece("clara", "Clara", "E", "Tom de pele claro", {"skin": "#e0b48f", "shade": "#b98b68"}),
    Piece("media", "Média", "E", "Tom de pele médio", {"skin": "#c48a5e", "shade": "#9b6640"}),
    Piece("morena", "Morena", "E", "Tom de pele moreno", {"skin": "#96603a", "shade": "#6f4526"}),
    Piece("escura", "Escura", "E", "Tom de pele escuro", {"skin": "#623c22", "shade": "#432716"}),
]

CLASSES: list[Piece] = [
    Piece(
        "guerreiro",
        "Guerreiro",
        "E",
        "Linha de frente: placas pesadas, machados e montantes.",
        {"primary": "#7a2320", "trim": "#c2853a"},
    ),
    Piece(
        "assassino",
        "Assassino",
        "E",
        "Sombra e sangue: sobrecasaca, capuz e lâminas curtas.",
        {"primary": "#1d2430", "trim": "#4fae94"},
    ),
    Piece(
        "mago",
        "Mago",
        "E",
        "Poder profano: mantos longos, cajados e foices arcanas.",
        {"primary": "#2b2350", "trim": "#7a6bd6"},
    ),
    Piece(
        "arqueiro",
        "Arqueiro",
        "E",
        "Caça à distância: couro leve, aljava, arcos e bestas.",
        {"primary": "#22331f", "trim": "#8aa346"},
    ),
]

HAIRS: list[Piece] = [
    Piece("curto", "Curto", "E", "Corte curto de treino", {}),
    Piece("espetado", "Espetado", "E", "Espetado para cima", {}),
    Piece("longo", "Longo", "E", "Comprido até o ombro", {}),
    Piece("moicano", "Moicano", "E", "Faixa central alta", {}),
]

HAIR_COLORS: list[Piece] = [
    Piece("preto", "Preto", "E", "Preto", {"hair": "#20202a", "shade": "#111117"}),
    Piece("castanho", "Castanho", "E", "Castanho", {"hair": "#4a2f1c", "shade": "#2f1d10"}),
    Piece("loiro", "Cinza-claro", "E", "Loiro acinzentado", {"hair": "#b8a173", "shade": "#8b7649"}),
    Piece("branco", "Branco", "E", "Branco", {"hair": "#cdd4de", "shade": "#98a1ad"}),
    Piece("azul", "Brasa do Sistema", "E", "Vermelho-brasa", {"hair": "#a83a2a", "shade": "#6d2118"}),
]


# ============================================================================
# SETS GERAIS (qualquer classe pode equipar)
# ============================================================================

OUTFITS: list[Piece] = [
    Piece(
        "treino",
        "Trapos de Treino",
        "E",
        "Pano cru e faixas: o começo de quem ainda não matou nada.",
        {"primary": "#39373a", "secondary": "#26252a", "trim": "#5b5760"},
    ),
    Piece(
        "couro",
        "Couro Cru",
        "D",
        "Correias cruzadas sobre couro batido.",
        {"primary": "#4a3524", "secondary": "#2f2318", "trim": "#8a6a3c"},
        ["harness", "belt"],
    ),
    Piece(
        "guarda",
        "Cota Enferrujada",
        "C",
        "Malha de aço velho com ombreiras da guarda morta.",
        {"primary": "#3f434a", "secondary": "#282b31", "trim": "#79808c"},
        ["plate", "pauldrons", "belt"],
    ),
    Piece(
        "cacador",
        "Placas do Caçador",
        "B",
        "Placas escuras, braçadeiras e capa curta de caça.",
        {"primary": "#2a3340", "secondary": "#181e27", "trim": "#5f7a94", "cape": "#1c2530"},
        ["plate", "pauldrons", "cape", "belt", "bracers"],
    ),
    Piece(
        "elite",
        "Aço de Elite",
        "A",
        "Armadura completa, elmo fechado e grevas reforçadas.",
        {"primary": "#2c2f3a", "secondary": "#1a1c24", "trim": "#8b93a4", "cape": "#242833"},
        ["plate_heavy", "pauldrons", "cape", "helmet", "belt", "greaves"],
    ),
    Piece(
        "soberano",
        "Aço Soberano",
        "S",
        "Placas negras com sobreveste e ombreiras espinhadas.",
        {"primary": "#26242c", "secondary": "#16151a", "trim": "#b08a3c", "cape": "#5a4418"},
        ["plate", "pauldrons_spiked", "cape_long", "tabard", "circlet", "belt", "skirt_plate"],
    ),
    Piece(
        "monarca",
        "Sombras do Monarca",
        MONARCA,
        "Armadura viva: capa esfarrapada, elmo chifrudo e brasas.",
        {"primary": "#1d1826", "secondary": "#100d16", "trim": "#7e46c8", "cape": "#2a1b40"},
        [
            "plate_heavy",
            "pauldrons_spiked",
            "cape_tattered",
            "helmet_horned",
            "skirt_plate",
            "belt",
            "aura",
            "embers",
        ],
    ),
]


# ============================================================================
# SETS EXCLUSIVOS DE CLASSE (um por rank, silhueta própria)
# ============================================================================

CLASS_OUTFITS: list[Piece] = [
    # ---------------------------------------------------------------- Guerreiro
    Piece(
        "g_ferro",
        "Placa de Ferro Batido",
        "D",
        "Peitoral inteiriço e cinto largo de forja.",
        {"primary": "#4a2b23", "secondary": "#2c1a15", "trim": "#96622f"},
        ["plate", "belt"],
        "guerreiro",
    ),
    Piece(
        "g_carrasco",
        "Arreio do Carrasco",
        "C",
        "Placas somadas, saiote de aço e ombreiras curtas.",
        {"primary": "#5a2622", "secondary": "#331414", "trim": "#a86a2c"},
        ["plate", "pauldrons", "belt", "skirt_plate"],
        "guerreiro",
    ),
    Piece(
        "g_bastiao",
        "Bastião de Sangue",
        "B",
        "Peitoral duplo com sobreveste e braçadeiras grossas.",
        {"primary": "#61231f", "secondary": "#361110", "trim": "#c2853a", "cape": "#4a1512"},
        ["plate_heavy", "pauldrons", "tabard", "belt", "bracers"],
        "guerreiro",
    ),
    Piece(
        "g_juggernaut",
        "Colosso de Guerra",
        "A",
        "Ombreiras espinhadas, capa rasgada e elmo fechado.",
        {"primary": "#4f1f1c", "secondary": "#2a0f0e", "trim": "#cf9440", "cape": "#3b1210"},
        ["plate_heavy", "pauldrons_spiked", "cape_tattered", "helmet", "greaves", "belt"],
        "guerreiro",
    ),
    Piece(
        "g_dominador",
        "Dominador de Portais",
        "S",
        "Placas colossais, elmo chifrudo e brasas na fenda da armadura.",
        {"primary": "#45191a", "secondary": "#240b0c", "trim": "#e0b25c", "cape": "#5c1a17"},
        [
            "plate_heavy",
            "pauldrons_spiked",
            "cape_long",
            "helmet_horned",
            "skirt_plate",
            "belt",
            "embers",
        ],
        "guerreiro",
    ),
    Piece(
        "monarca_guerreiro",
        "Monarca de Ferro",
        MONARCA,
        "Coroa sobre elmo chifrudo, placas colossais e aura de brasa.",
        {"primary": "#3a1416", "secondary": "#1d080a", "trim": "#f0c46a", "cape": "#5a1512"},
        [
            "plate_heavy",
            "pauldrons_spiked",
            "cape_long",
            "helmet_horned",
            "crown",
            "skirt_plate",
            "belt",
            "aura",
            "embers",
        ],
        "guerreiro",
    ),
    # ---------------------------------------------------------------- Assassino
    Piece(
        "a_correias",
        "Correias do Beco",
        "D",
        "Torso enfaixado com correias cruzadas e cinto de bainhas.",
        {"primary": "#232830", "secondary": "#14171d", "trim": "#4a6b62"},
        ["harness", "belt"],
        "assassino",
    ),
    Piece(
        "a_sobrecasaca",
        "Sobrecasaca Rasgada",
        "C",
        "Casaco longo aberto e capuz baixo.",
        {"primary": "#1e242e", "secondary": "#101419", "trim": "#4fae94"},
        ["coat", "harness", "hood", "belt"],
        "assassino",
    ),
    Piece(
        "a_mascara",
        "Véu do Silêncio",
        "B",
        "Capuz com máscara, braçadeiras e manto curto rasgado.",
        {"primary": "#1a1f28", "secondary": "#0d1116", "trim": "#5cc0a4", "cape": "#131a20"},
        ["coat", "hood", "mask", "bracers", "cape_tattered"],
        "assassino",
    ),
    Piece(
        "a_lamina_negra",
        "Lâminas nas Costas",
        "A",
        "Ombreira única, lâminas cruzadas nas costas e máscara.",
        {"primary": "#171d26", "secondary": "#0b0f14", "trim": "#61d2b0", "cape": "#111820"},
        ["coat", "pauldron_single", "hood", "mask", "back_blades", "belt"],
        "assassino",
    ),
    Piece(
        "a_espectro",
        "Espectro de Sangue",
        "S",
        "Casaco esfarrapado, lâminas nas costas e rastro de sombra.",
        {"primary": "#141a22", "secondary": "#090d12", "trim": "#6fe0bd", "cape": "#0f1720"},
        ["coat", "hood", "mask", "back_blades", "cape_tattered", "shadow", "belt"],
        "assassino",
    ),
    Piece(
        "monarca_assassino",
        "Monarca Silente",
        MONARCA,
        "Capuz vivo, máscara e lâminas que sangram sombra.",
        {"primary": "#101823", "secondary": "#070b10", "trim": "#7ee0c0", "cape": "#0c1a1e"},
        [
            "coat",
            "pauldron_single",
            "hood",
            "mask",
            "back_blades",
            "cape_tattered",
            "shadow",
            "aura",
        ],
        "assassino",
    ),
    # --------------------------------------------------------------------- Mago
    Piece(
        "m_novico",
        "Manto do Noviço",
        "D",
        "Manto simples com faixa cruzada no peito.",
        {"primary": "#2c2846", "secondary": "#191630", "trim": "#6a5fb0", "cape": "#241f3d"},
        ["robe", "sash"],
        "mago",
    ),
    Piece(
        "m_ocultista",
        "Vestes do Ocultista",
        "C",
        "Manto com fenda frontal e diadema de runas.",
        {"primary": "#2a2450", "secondary": "#161233", "trim": "#7a6bd6", "cape": "#221c46"},
        ["robe", "robe_split", "sash", "circlet"],
        "mago",
    ),
    Piece(
        "m_nigromante",
        "Trajes do Nigromante",
        "B",
        "Capuz fundo, manto com fenda e runas orbitando.",
        {"primary": "#251f4a", "secondary": "#130f2b", "trim": "#8f7ce8", "cape": "#1d1740"},
        ["robe", "robe_split", "cape", "hood", "runes"],
        "mago",
    ),
    Piece(
        "m_abissal",
        "Manto Abissal",
        "A",
        "Ombreiras rúnicas sobre manto longo e capuz.",
        {"primary": "#221b48", "secondary": "#110d27", "trim": "#9a86ff", "cape": "#1a1440"},
        ["robe", "robe_split", "pauldrons", "hood", "runes", "sash"],
        "mago",
    ),
    Piece(
        "m_arquimago",
        "Coroa do Arquimago",
        "S",
        "Manto de cauda longa, ombreiras espinhadas e coroa de runas.",
        {"primary": "#1e1743", "secondary": "#0e0a22", "trim": "#a892ff", "cape": "#241a5c"},
        ["robe", "robe_split", "pauldrons_spiked", "cape_long", "crown", "runes"],
        "mago",
    ),
    Piece(
        "monarca_mago",
        "Monarca Arcano",
        MONARCA,
        "Manto abissal com runas suspensas e aura de vazio.",
        {"primary": "#1a1440", "secondary": "#0b081d", "trim": "#b7a2ff", "cape": "#2a1c66"},
        [
            "robe",
            "robe_split",
            "pauldrons_spiked",
            "cape_long",
            "crown",
            "runes",
            "aura",
            "shadow",
        ],
        "mago",
    ),
    # ----------------------------------------------------------------- Arqueiro
    Piece(
        "r_batedor",
        "Couro de Batedor",
        "D",
        "Correias, cinto de flechas e aljava simples.",
        {"primary": "#2b3524", "secondary": "#1a2015", "trim": "#7d8f45"},
        ["harness", "belt", "quiver"],
        "arqueiro",
    ),
    Piece(
        "r_silvicultor",
        "Casaco do Silvicultor",
        "C",
        "Casaco curto de couro com braçadeiras de tiro.",
        {"primary": "#293520", "secondary": "#171f12", "trim": "#8aa346"},
        ["coat", "belt", "quiver", "bracers"],
        "arqueiro",
    ),
    Piece(
        "r_emboscador",
        "Trajes de Emboscada",
        "B",
        "Capuz, ombreira única e grevas leves.",
        {"primary": "#243019", "secondary": "#141b0f", "trim": "#9bb551"},
        ["coat", "pauldron_single", "hood", "quiver", "greaves"],
        "arqueiro",
    ),
    Piece(
        "r_atirador",
        "Atirador de Elite",
        "A",
        "Manto curto rasgado, capuz e braçadeiras pesadas.",
        {"primary": "#1f2b16", "secondary": "#10170c", "trim": "#a8c25c", "cape": "#1a2412"},
        ["coat", "pauldron_single", "hood", "quiver", "cape_tattered", "bracers"],
        "arqueiro",
    ),
    Piece(
        "r_falcao",
        "Presságio do Falcão",
        "S",
        "Máscara de bico, ombreiras e capa curta com brasas.",
        {"primary": "#1b2814", "secondary": "#0d1409", "trim": "#b6d165", "cape": "#16240f"},
        ["coat", "pauldrons", "quiver", "mask", "cape_tattered", "greaves", "embers"],
        "arqueiro",
    ),
    Piece(
        "monarca_arqueiro",
        "Monarca do Vento",
        MONARCA,
        "Aljava dupla, máscara e capa longa cortada pelo vento.",
        {"primary": "#16240f", "secondary": "#0a1006", "trim": "#c8e07e", "cape": "#123018"},
        [
            "coat",
            "pauldrons_spiked",
            "quiver",
            "hood",
            "mask",
            "cape_long",
            "aura",
            "embers",
        ],
        "arqueiro",
    ),
]


# ============================================================================
# ARMAS (a feature `shape_*` define a forma no 3D)
# ============================================================================

WEAPONS: list[Piece] = [
    Piece("nenhuma", "Mãos livres", "E", "Sem arma: só o corpo.", {}),
    Piece(
        "bastao",
        "Bordão Lascado",
        "D",
        "Madeira dura com anel de ferro.",
        {"blade": "#7d6540", "grip": "#3f3120"},
        ["shape_club"],
    ),
    Piece(
        "adaga",
        "Adaga Enferrujada",
        "C",
        "Lâmina curta de aço velho.",
        {"blade": "#8f98a6", "grip": "#2c2c33"},
        ["shape_dagger"],
    ),
    Piece(
        "espada",
        "Espada do Caçador",
        "B",
        "Lâmina longa de aço escuro.",
        {"blade": "#a3adbb", "grip": "#232a35"},
        ["shape_sword"],
    ),
    Piece(
        "machado",
        "Machado de Guerra",
        "A",
        "Cabeça larga, dano bruto.",
        {"blade": "#98a2b0", "grip": "#3a2a1c"},
        ["shape_axe"],
    ),
    Piece(
        "alabarda",
        "Alabarda Negra",
        "S",
        "Haste longa com gancho de ferro.",
        {"blade": "#aab0bb", "grip": "#4a3a1c"},
        ["shape_polearm"],
    ),
    Piece(
        "sombras",
        "Lâmina das Sombras",
        MONARCA,
        "A arma que o próprio Sistema forjou.",
        {"blade": "#b98cff", "grip": "#241539"},
        ["shape_greatsword", "glow"],
    ),
]

CLASS_WEAPONS: list[Piece] = [
    # ---------------------------------------------------------------- Guerreiro
    Piece(
        "g_machadinha",
        "Machadinha Lascada",
        "D",
        "Ferro tosco preso a um cabo curto.",
        {"blade": "#8a939f", "grip": "#3a2a1c"},
        ["shape_axe"],
        "guerreiro",
    ),
    Piece(
        "g_montante",
        "Montante de Ferro",
        "C",
        "Lâmina larga de duas mãos.",
        {"blade": "#9aa4b2", "grip": "#2a2118"},
        ["shape_greatsword"],
        "guerreiro",
    ),
    Piece(
        "g_martelo",
        "Martelo de Cerco",
        "B",
        "Cabeça de bloco maciço para quebrar placa.",
        {"blade": "#8d96a4", "grip": "#3d2c1b"},
        ["shape_hammer"],
        "guerreiro",
    ),
    Piece(
        "g_machado_duplo",
        "Machado Bipene",
        "A",
        "Duas cabeças opostas, corte contínuo.",
        {"blade": "#a4aebc", "grip": "#42301d"},
        ["shape_axe_double"],
        "guerreiro",
    ),
    Piece(
        "g_lanca",
        "Lança do Carrasco",
        "S",
        "Haste longa com ponta triangular e brasa no fio.",
        {"blade": "#d8b26a", "grip": "#4a3418"},
        ["shape_spear"],
        "guerreiro",
    ),
    Piece(
        "g_monarca",
        "Devoradora de Portais",
        MONARCA,
        "Montante colossal com fio em brasa.",
        {"blade": "#ffb45c", "grip": "#3a1a10"},
        ["shape_greatsword", "glow"],
        "guerreiro",
    ),
    # ---------------------------------------------------------------- Assassino
    Piece(
        "a_adaga_serrada",
        "Adaga Serrada",
        "D",
        "Fio dentado para cortes rápidos.",
        {"blade": "#93a09c", "grip": "#20262c"},
        ["shape_dagger"],
        "assassino",
    ),
    Piece(
        "a_adagas_gemeas",
        "Adagas Gêmeas",
        "C",
        "Uma em cada mão, ataque duplo.",
        {"blade": "#9fb0aa", "grip": "#1b2126"},
        ["shape_twin_daggers"],
        "assassino",
    ),
    Piece(
        "a_katana",
        "Katana Sombria",
        "B",
        "Lâmina curva e leve.",
        {"blade": "#aebfc4", "grip": "#161b20"},
        ["shape_katana"],
        "assassino",
    ),
    Piece(
        "a_garras",
        "Garras de Aço",
        "A",
        "Três lâminas presas ao antebraço.",
        {"blade": "#9fb2ad", "grip": "#151a1f"},
        ["shape_claws"],
        "assassino",
    ),
    Piece(
        "a_adagas_veneno",
        "Presas Envenenadas",
        "S",
        "Par de adagas curvas com fio esverdeado.",
        {"blade": "#7fe0b4", "grip": "#12181c"},
        ["shape_twin_daggers"],
        "assassino",
    ),
    Piece(
        "a_monarca",
        "Presas do Silêncio",
        MONARCA,
        "Garras que sangram sombra.",
        {"blade": "#7ee0c0", "grip": "#0d1418"},
        ["shape_claws", "glow"],
        "assassino",
    ),
    # --------------------------------------------------------------------- Mago
    Piece(
        "m_cajado_torto",
        "Cajado Torto",
        "D",
        "Galho retorcido com pedra amarrada.",
        {"blade": "#8f7fd0", "grip": "#3b2e20"},
        ["shape_staff"],
        "mago",
    ),
    Piece(
        "m_cajado_orbe",
        "Cajado do Orbe",
        "C",
        "Orbe suspenso entre garras de ferro.",
        {"blade": "#9a86ff", "grip": "#2e2440"},
        ["shape_orb_staff"],
        "mago",
    ),
    Piece(
        "m_foice_arcana",
        "Foice Arcana",
        "B",
        "Lâmina curva presa a uma haste rúnica.",
        {"blade": "#a794ff", "grip": "#251c3c"},
        ["shape_scythe"],
        "mago",
    ),
    Piece(
        "m_cetro_abissal",
        "Cetro Abissal",
        "A",
        "Orbe negro em coroa de espinhos.",
        {"blade": "#b49dff", "grip": "#1e1733"},
        ["shape_orb_staff"],
        "mago",
    ),
    Piece(
        "m_foice_vazio",
        "Foice do Vazio",
        "S",
        "Lâmina dupla que corta o próprio espaço.",
        {"blade": "#c4b0ff", "grip": "#191230"},
        ["shape_scythe"],
        "mago",
    ),
    Piece(
        "m_monarca",
        "Cajado do Monarca",
        MONARCA,
        "Orbe vivo do vazio preso ao cajado.",
        {"blade": "#d0b8ff", "grip": "#150f2b"},
        ["shape_orb_staff", "glow"],
        "mago",
    ),
    # ----------------------------------------------------------------- Arqueiro
    Piece(
        "r_arco_curto",
        "Arco Curto",
        "D",
        "Madeira flexível, tiro rápido.",
        {"blade": "#8d9a52", "grip": "#3b2e1c"},
        ["shape_bow"],
        "arqueiro",
    ),
    Piece(
        "r_arco_recurvo",
        "Arco Recurvo",
        "C",
        "Pontas viradas para mais força no tiro.",
        {"blade": "#9bb551", "grip": "#33291a"},
        ["shape_recurve_bow"],
        "arqueiro",
    ),
    Piece(
        "r_besta",
        "Besta de Ferro",
        "B",
        "Coronha curta e virote pesado.",
        {"blade": "#a2ae8a", "grip": "#2c2418"},
        ["shape_crossbow"],
        "arqueiro",
    ),
    Piece(
        "r_arco_negro",
        "Arco Longo Negro",
        "A",
        "Madeira escurecida, alcance brutal.",
        {"blade": "#b6d165", "grip": "#241d12"},
        ["shape_recurve_bow"],
        "arqueiro",
    ),
    Piece(
        "r_besta_pesada",
        "Besta Pesada",
        "S",
        "Arco duplo de aço sobre coronha reforçada.",
        {"blade": "#c8e07e", "grip": "#1f1a10"},
        ["shape_crossbow"],
        "arqueiro",
    ),
    Piece(
        "r_monarca",
        "Arco das Sombras",
        MONARCA,
        "Corda de sombra que nunca arrebenta.",
        {"blade": "#d8f09a", "grip": "#141a0d"},
        ["shape_recurve_bow", "glow"],
        "arqueiro",
    ),
]


SLOTS: dict[str, list[Piece]] = {
    "char_class": CLASSES,
    "skin": SKINS,
    "hair": HAIRS,
    "hair_color": HAIR_COLORS,
    "outfit": OUTFITS + CLASS_OUTFITS,
    "weapon": WEAPONS + CLASS_WEAPONS,
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
