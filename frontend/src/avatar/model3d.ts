import * as THREE from 'three'

import type { AvatarEquipped, AvatarPiece, AvatarSlot } from '../types'

/**
 * Boneco 3D do Caçador montado só com caixas (estilo voxel), sem nenhum modelo
 * ou textura de terceiros: as cores vêm do catálogo que o backend devolve, então
 * um set novo é só uma paleta + a lista de `features`.
 */

export type Catalog = Record<AvatarSlot, AvatarPiece[]>

/** Altura aproximada do boneco em unidades da cena, usada para enquadrar a câmera. */
export const FIGURE_HEIGHT = 21

function piece(catalog: Catalog, slot: AvatarSlot, id: string): AvatarPiece | undefined {
  return catalog[slot]?.find((item) => item.id === id) ?? catalog[slot]?.[0]
}

interface Palette {
  skin: string
  skinShade: string
  hair: string
  hairShade: string
  primary: string
  secondary: string
  trim: string
  cape: string
  blade: string
  grip: string
}

function palette(catalog: Catalog, equipped: AvatarEquipped): Palette {
  const skin = piece(catalog, 'skin', equipped.skin)?.colors ?? {}
  const hair = piece(catalog, 'hair_color', equipped.hair_color)?.colors ?? {}
  const outfit = piece(catalog, 'outfit', equipped.outfit)?.colors ?? {}
  const weapon = piece(catalog, 'weapon', equipped.weapon)?.colors ?? {}

  return {
    skin: skin.skin ?? '#d79a68',
    skinShade: skin.shade ?? '#b1744a',
    hair: hair.hair ?? '#2b2b3a',
    hairShade: hair.shade ?? '#17171f',
    primary: outfit.primary ?? '#3d4657',
    secondary: outfit.secondary ?? '#2a3140',
    trim: outfit.trim ?? '#7f8ba1',
    cape: outfit.cape ?? outfit.secondary ?? '#2a3140',
    blade: weapon.blade ?? '#c6d0dd',
    grip: weapon.grip ?? '#3b3b4a',
  }
}

type Finish = 'skin' | 'cloth' | 'metal' | 'glow'

function material(color: string, finish: Finish): THREE.MeshStandardMaterial {
  const options: THREE.MeshStandardMaterialParameters = { color }

  if (finish === 'metal') {
    options.metalness = 0.65
    options.roughness = 0.35
  } else if (finish === 'glow') {
    options.emissive = new THREE.Color(color)
    options.emissiveIntensity = 0.6
    options.metalness = 0.4
    options.roughness = 0.3
  } else {
    options.metalness = finish === 'skin' ? 0.05 : 0.15
    options.roughness = finish === 'skin' ? 0.85 : 0.7
  }

  return new THREE.MeshStandardMaterial(options)
}

interface BoxOptions {
  size: [number, number, number]
  at: [number, number, number]
  color: string
  finish?: Finish
}

function box({ size, at, color, finish = 'cloth' }: BoxOptions): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material(color, finish))

  mesh.position.set(...at)
  mesh.castShadow = true

  return mesh
}

/** Cabeça, rosto e membros — o que não muda com o set. */
function buildBody(colors: Palette): THREE.Group {
  const body = new THREE.Group()

  body.add(box({ size: [5.6, 5.6, 5.6], at: [0, 16.9, 0], color: colors.skin, finish: 'skin' }))
  body.add(box({ size: [2.2, 1.6, 2.2], at: [0, 13.6, 0], color: colors.skinShade, finish: 'skin' }))

  // Olhos e boca, um pouco à frente da face.
  for (const x of [-1.25, 1.25]) {
    body.add(box({ size: [0.9, 0.9, 0.4], at: [x, 17.3, 2.85], color: '#14151d' }))
  }

  body.add(box({ size: [1.6, 0.4, 0.3], at: [0, 15.5, 2.85], color: colors.skinShade }))

  // Torso com a cor primária; braços na secundária para a silhueta se separar.
  body.add(box({ size: [7.4, 8, 4.2], at: [0, 9, 0], color: colors.primary }))
  body.add(box({ size: [7.6, 1.2, 4.4], at: [0, 12.6, 0], color: colors.secondary }))

  for (const x of [-4.9, 4.9]) {
    body.add(box({ size: [2.2, 7.4, 2.6], at: [x, 9.4, 0], color: colors.secondary }))
    body.add(box({ size: [2.6, 2.2, 3], at: [x, 4.9, 0], color: colors.skin, finish: 'skin' }))
  }

  // Pernas e botas com a secundária.
  for (const x of [-1.95, 1.95]) {
    body.add(box({ size: [3.2, 5.6, 3.4], at: [x, 2.6, 0], color: colors.secondary }))
    body.add(box({ size: [3.8, 1.4, 4.6], at: [x, 0.7, 0.4], color: colors.trim }))
  }

  return body
}

function buildHair(style: string, colors: Palette, helmet: boolean): THREE.Group {
  const hair = new THREE.Group()

  const top = box({ size: [5.9, 1.5, 5.9], at: [0, 19.4, 0], color: colors.hair })

  // Com elmo o cabelo fica escondido.
  if (helmet) {
    return hair
  }

  if (style === 'moicano') {
    hair.add(box({ size: [1.6, 2.8, 6], at: [0, 20.4, 0], color: colors.hair }))
    hair.add(box({ size: [5.9, 0.8, 5.9], at: [0, 19.4, 0], color: colors.hairShade }))

    return hair
  }

  hair.add(top)
  hair.add(box({ size: [6, 2.2, 1.3], at: [0, 18.3, -2.4], color: colors.hair }))

  if (style === 'espetado') {
    for (const x of [-1.8, 0, 1.8]) {
      hair.add(box({ size: [1.3, 2, 1.3], at: [x, 20.6, -0.6], color: colors.hair }))
    }
  }

  if (style === 'longo') {
    hair.add(box({ size: [6, 7.2, 1.5], at: [0, 15.4, -2.5], color: colors.hair }))

    for (const x of [-2.9, 2.9]) {
      hair.add(box({ size: [1, 5.6, 5.4], at: [x, 16.6, -0.2], color: colors.hairShade }))
    }
  }

  if (style === 'curto') {
    for (const x of [-2.9, 2.9]) {
      hair.add(box({ size: [1, 2.4, 5.4], at: [x, 18.4, -0.2], color: colors.hairShade }))
    }
  }

  return hair
}

/** Peças de silhueta que cada set adiciona (`features` do catálogo). */
function buildFeatures(features: string[], colors: Palette): THREE.Group {
  const group = new THREE.Group()

  if (features.includes('belt')) {
    group.add(box({ size: [7.8, 1.3, 4.5], at: [0, 5.4, 0], color: colors.trim, finish: 'metal' }))
    group.add(box({ size: [1.6, 1.6, 0.5], at: [0, 5.4, 2.4], color: colors.trim, finish: 'metal' }))
  }

  if (features.includes('shoulders')) {
    for (const x of [-4.6, 4.6]) {
      group.add(
        box({ size: [3, 1.8, 4.2], at: [x, 12.6, 0], color: colors.trim, finish: 'metal' }),
      )
    }
  }

  if (features.includes('cape')) {
    const cape = box({ size: [7, 10, 0.6], at: [0, 8, -2.6], color: colors.cape })

    cape.rotation.x = -0.07
    group.add(cape)

    group.add(box({ size: [8, 1.2, 1.4], at: [0, 12.9, -2.2], color: colors.trim, finish: 'metal' }))
  }

  if (features.includes('helmet')) {
    group.add(box({ size: [6, 1.9, 6], at: [0, 19, 0], color: colors.trim, finish: 'metal' }))
    group.add(box({ size: [0.9, 2.4, 0.7], at: [0, 17.5, 2.9], color: colors.trim, finish: 'metal' }))

    for (const x of [-2.9, 2.9]) {
      group.add(box({ size: [0.7, 3.2, 5.6], at: [x, 17.2, 0], color: colors.trim, finish: 'metal' }))
    }
  }

  return group
}

function buildAura(colors: Palette): THREE.Group {
  const aura = new THREE.Group()

  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(10, 1),
    new THREE.MeshStandardMaterial({
      color: colors.trim,
      emissive: new THREE.Color(colors.trim),
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.07,
      wireframe: true,
    }),
  )

  shell.position.y = 9
  shell.name = 'aura-shell'
  aura.add(shell)

  const light = new THREE.PointLight(new THREE.Color(colors.trim), 70, 40)

  light.position.set(0, 10, 6)
  aura.add(light)

  return aura
}

/** Arma na mão direita; cada id monta uma silhueta diferente. */
function buildWeapon(id: string, colors: Palette): THREE.Group {
  const hand = new THREE.Group()

  hand.position.set(5.1, 4.9, 0.6)

  const blade = (size: [number, number, number], at: [number, number, number]) =>
    box({ size, at, color: colors.blade, finish: id === 'sombras' ? 'glow' : 'metal' })

  const grip = (size: [number, number, number], at: [number, number, number]) =>
    box({ size, at, color: colors.grip })

  if (id === 'bastao') {
    hand.add(grip([1.2, 14, 1.2], [0, 3, 0]))
  }

  if (id === 'adaga') {
    hand.add(blade([0.6, 5, 1.6], [0, 4.4, 0]))
    hand.add(grip([1, 2, 1], [0, 1, 0]))
  }

  if (id === 'espada') {
    hand.add(blade([0.7, 11, 1.8], [0, 8.2, 0]))
    hand.add(blade([0.6, 0.8, 4.4], [0, 2.4, 0]))
    hand.add(grip([1, 2.6, 1], [0, 0.9, 0]))
  }

  if (id === 'machado') {
    hand.add(grip([1.2, 12, 1.2], [0, 4, 0]))
    hand.add(blade([1, 4.4, 5], [0, 9.4, 1.6]))
  }

  if (id === 'alabarda') {
    hand.add(grip([1.2, 17, 1.2], [0, 5.5, 0]))
    hand.add(blade([0.8, 5, 1.6], [0, 15.4, 0]))
    hand.add(blade([0.8, 1.2, 3], [0, 12.6, 1.4]))
  }

  if (id === 'sombras') {
    hand.add(blade([0.8, 13, 2.6], [0, 9.4, 0]))
    hand.add(blade([0.8, 1, 5.4], [0, 2.6, 0]))
    hand.add(grip([1.2, 3, 1.2], [0, 1, 0]))
  }

  return hand
}

export function hasAura(catalog: Catalog, equipped: AvatarEquipped): boolean {
  return piece(catalog, 'outfit', equipped.outfit)?.features.includes('aura') ?? false
}

/** Monta o boneco completo, com o centro do corpo na origem. */
export function buildFigure(catalog: Catalog, equipped: AvatarEquipped): THREE.Group {
  const colors = palette(catalog, equipped)
  const features = piece(catalog, 'outfit', equipped.outfit)?.features ?? []

  const figure = new THREE.Group()

  // Plataforma de invocação sob os pés.
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(6.4, 0.22, 8, 48),
    new THREE.MeshStandardMaterial({
      color: colors.trim,
      emissive: new THREE.Color(colors.trim),
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.65,
    }),
  )

  ring.rotation.x = Math.PI / 2
  figure.add(ring)

  figure.add(buildBody(colors))
  figure.add(buildHair(equipped.hair, colors, features.includes('helmet')))
  figure.add(buildFeatures(features, colors))

  if (equipped.weapon !== 'nenhuma') {
    figure.add(buildWeapon(equipped.weapon, colors))
  }

  if (features.includes('aura')) {
    figure.add(buildAura(colors))
  }

  figure.position.y = -FIGURE_HEIGHT / 2

  return figure
}

/** Libera geometrias e materiais do boneco antes de trocá-lo. */
export function disposeFigure(figure: THREE.Object3D) {
  figure.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.geometry.dispose()

      const materials = Array.isArray(node.material) ? node.material : [node.material]

      for (const item of materials) {
        item.dispose()
      }
    }
  })
}

/** Luzes fixas da cena: frontal quente + azul do Sistema atrás. */
export function addLights(scene: THREE.Scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.75))

  const key = new THREE.DirectionalLight(0xffffff, 2.4)

  key.position.set(12, 20, 18)
  scene.add(key)

  const rim = new THREE.DirectionalLight(0x4cc9ff, 0.8)

  rim.position.set(-14, 12, -12)
  scene.add(rim)

  const fill = new THREE.DirectionalLight(0xffffff, 0.35)

  fill.position.set(0, -6, 12)
  scene.add(fill)
}
