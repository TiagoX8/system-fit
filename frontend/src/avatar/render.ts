import type { AvatarEquipped, AvatarPiece, AvatarSlot } from '../types'
import { BODY, FEATURES, HAIR, HEIGHT, WEAPON, WIDTH, type Grid } from './sprite'

type Catalog = Record<AvatarSlot, AvatarPiece[]>

function piece(catalog: Catalog, slot: AvatarSlot, id: string): AvatarPiece | undefined {
  return catalog[slot]?.find((item) => item.id === id) ?? catalog[slot]?.[0]
}

/** Cores lógicas do sprite montadas a partir das peças equipadas. */
function palette(catalog: Catalog, equipped: AvatarEquipped): Record<string, string> {
  const skin = piece(catalog, 'skin', equipped.skin)?.colors ?? {}
  const hair = piece(catalog, 'hair_color', equipped.hair_color)?.colors ?? {}
  const outfit = piece(catalog, 'outfit', equipped.outfit)?.colors ?? {}
  const weapon = piece(catalog, 'weapon', equipped.weapon)?.colors ?? {}

  return {
    S: skin.skin ?? '#d79a68',
    s: skin.shade ?? '#b1744a',
    E: '#14151d',
    H: hair.hair ?? '#2b2b3a',
    h: hair.shade ?? '#17171f',
    A: outfit.primary ?? '#3d4657',
    B: outfit.secondary ?? '#2a3140',
    T: outfit.trim ?? '#7f8ba1',
    C: outfit.cape ?? outfit.secondary ?? '#2a3140',
    V: weapon.blade ?? '#c6d0dd',
    G: weapon.grip ?? '#3b3b4a',
  }
}

/** Camadas na ordem de desenho: capa atrás, arma na frente. */
function layers(catalog: Catalog, equipped: AvatarEquipped): Grid[] {
  const outfit = piece(catalog, 'outfit', equipped.outfit)
  const features = outfit?.features ?? []

  const stack: Grid[] = []

  if (features.includes('cape')) {
    stack.push(FEATURES.cape)
  }

  stack.push(BODY)
  stack.push(HAIR[equipped.hair] ?? HAIR.curto)

  for (const feature of features) {
    if (feature !== 'cape' && FEATURES[feature]) {
      stack.push(FEATURES[feature])
    }
  }

  stack.push(WEAPON[equipped.weapon] ?? WEAPON.nenhuma)

  return stack
}

export function hasAura(catalog: Catalog, equipped: AvatarEquipped): boolean {
  return piece(catalog, 'outfit', equipped.outfit)?.features.includes('aura') ?? false
}

export function drawAvatar(
  canvas: HTMLCanvasElement,
  catalog: Catalog,
  equipped: AvatarEquipped,
  scale: number,
) {
  const ratio = window.devicePixelRatio || 1

  canvas.width = WIDTH * scale * ratio
  canvas.height = HEIGHT * scale * ratio
  canvas.style.width = `${WIDTH * scale}px`
  canvas.style.height = `${HEIGHT * scale}px`

  const ctx = canvas.getContext('2d')

  if (!ctx) return

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, WIDTH * scale, HEIGHT * scale)
  ctx.imageSmoothingEnabled = false

  const colors = palette(catalog, equipped)
  const aura = hasAura(catalog, equipped)

  if (aura) {
    ctx.shadowColor = colors.T
    ctx.shadowBlur = scale * 2
  }

  for (const grid of layers(catalog, equipped)) {
    for (let row = 0; row < HEIGHT; row += 1) {
      for (let col = 0; col < WIDTH; col += 1) {
        const char = grid[row]?.[col]

        if (!char || char === '.') continue

        const color = colors[char]

        if (!color) continue

        ctx.fillStyle = color
        ctx.fillRect(col * scale, row * scale, scale, scale)
      }
    }
  }
}
