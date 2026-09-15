import * as THREE from 'three'

import type { AvatarEquipped, AvatarPiece, AvatarSlot } from '../types'

/**
 * Boneco 3D do Caçador em proporção chibi (cabeça grande, corpo curto), montado
 * só com primitivas suaves de three.js — cápsulas, esferas e superfícies de
 * revolução — sem nenhum modelo ou textura de terceiros. As cores e as features
 * vêm do catálogo que o backend devolve, então um set novo é só uma paleta mais
 * a lista de `features`.
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
  accent: string
}

function palette(catalog: Catalog, equipped: AvatarEquipped): Palette {
  const skin = piece(catalog, 'skin', equipped.skin)?.colors ?? {}
  const hair = piece(catalog, 'hair_color', equipped.hair_color)?.colors ?? {}
  const outfit = piece(catalog, 'outfit', equipped.outfit)?.colors ?? {}
  const weapon = piece(catalog, 'weapon', equipped.weapon)?.colors ?? {}
  const klass = piece(catalog, 'char_class', equipped.char_class)?.colors ?? {}

  return {
    skin: skin.skin ?? '#f2c9a0',
    skinShade: skin.shade ?? '#d79f76',
    hair: hair.hair ?? '#2b2b3a',
    hairShade: hair.shade ?? '#17171f',
    primary: outfit.primary ?? '#3d4657',
    secondary: outfit.secondary ?? '#2a3140',
    trim: outfit.trim ?? '#7f8ba1',
    cape: outfit.cape ?? outfit.secondary ?? '#2a3140',
    blade: weapon.blade ?? '#c6d0dd',
    grip: weapon.grip ?? '#3b3b4a',
    accent: klass.trim ?? outfit.trim ?? '#7f8ba1',
  }
}

type Finish = 'skin' | 'cloth' | 'leather' | 'metal' | 'glow'

/** Materiais com pouca variação de roughness para manter o ar de cel-shading. */
function material(color: string, finish: Finish): THREE.MeshStandardMaterial {
  const options: THREE.MeshStandardMaterialParameters = { color, flatShading: false }

  if (finish === 'metal') {
    options.metalness = 0.8
    options.roughness = 0.28
  } else if (finish === 'glow') {
    options.emissive = new THREE.Color(color)
    options.emissiveIntensity = 0.75
    options.metalness = 0.5
    options.roughness = 0.2
  } else if (finish === 'leather') {
    options.metalness = 0.2
    options.roughness = 0.55
  } else if (finish === 'skin') {
    options.metalness = 0.02
    options.roughness = 0.75
  } else {
    options.metalness = 0.1
    options.roughness = 0.68
  }

  return new THREE.MeshStandardMaterial(options)
}

interface Placement {
  at?: [number, number, number]
  rotate?: [number, number, number]
  scale?: [number, number, number]
  color: string
  finish?: Finish
}

type Part = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>

function mesh(geometry: THREE.BufferGeometry, options: Placement): Part {
  const node = new THREE.Mesh(geometry, material(options.color, options.finish ?? 'cloth'))

  if (options.at) node.position.set(...options.at)
  if (options.rotate) node.rotation.set(...options.rotate)
  if (options.scale) node.scale.set(...options.scale)

  return node
}

/** Cápsula: base de quase todo membro, dá volume arredondado sem parecer cubo. */
function limb(radius: number, length: number, options: Placement): Part {
  return mesh(new THREE.CapsuleGeometry(radius, length, 8, 20), options)
}

function ball(radius: number, options: Placement): Part {
  return mesh(new THREE.SphereGeometry(radius, 28, 20), options)
}

/**
 * Tronco/manto por revolução: `profile` é o raio em cada altura, então dá para
 * afunilar a cintura e abrir a barra da roupa como nos modelos de MMO estilizado.
 */
function revolve(profile: [number, number][], options: Placement): Part {
  const points = profile.map(([radius, y]) => new THREE.Vector2(radius, y))

  return mesh(new THREE.LatheGeometry(points, 36), options)
}

/** Cabeça chibi com rosto, cabelo é adicionado por cima. */
function buildHead(colors: Palette): THREE.Group {
  const head = new THREE.Group()

  const skull = ball(3.5, { at: [0, 16.8, 0], color: colors.skin, finish: 'skin' })

  skull.scale.set(1, 1.05, 0.95)
  head.add(skull)

  head.add(limb(0.95, 1.1, { at: [0, 13.4, 0], color: colors.skin, finish: 'skin' }))

  // Olhos grandes com brilho, no estilo dos modelos chibi.
  for (const x of [-1.3, 1.3]) {
    const eye = ball(0.62, { at: [x, 17, 3.05], color: '#14151d' })

    eye.scale.set(0.85, 1.15, 0.5)
    head.add(eye)

    const spark = ball(0.2, { at: [x + 0.2, 17.35, 3.35], color: '#eaf4ff', finish: 'glow' })

    spark.scale.set(1, 1, 0.4)
    head.add(spark)
  }

  const mouth = ball(0.35, { at: [0, 15.3, 3.15], color: colors.skinShade, finish: 'skin' })

  mouth.scale.set(1.3, 0.4, 0.3)
  head.add(mouth)

  return head
}

/** Torso, braços, mãos, pernas e botas — muda de cor com o set, não de forma. */
function buildBody(colors: Palette): THREE.Group {
  const body = new THREE.Group()

  // Peito largo afunilando na cintura e abrindo de novo no quadril.
  body.add(
    revolve(
      [
        [2.9, 4.4],
        [3.1, 5.6],
        [2.6, 7.4],
        [3.3, 9.6],
        [3.5, 11.4],
        [2.8, 12.6],
        [1.4, 13.1],
        [0, 13.2],
      ],
      { color: colors.primary, finish: 'leather' },
    ),
  )

  // Gola e peitoral em cima do torso para dar leitura de armadura.
  body.add(
    revolve(
      [
        [2.9, 11.2],
        [3.15, 11.9],
        [2.4, 12.9],
        [1.6, 13.3],
      ],
      { color: colors.secondary, finish: 'leather' },
    ),
  )

  for (const side of [-1, 1]) {
    const shoulder = ball(1.5, {
      at: [side * 3.3, 11.5, 0],
      color: colors.secondary,
      finish: 'leather',
    })

    body.add(shoulder)

    const arm = limb(1, 4.6, {
      at: [side * 3.9, 8.4, 0],
      rotate: [0, 0, side * 0.16],
      color: colors.secondary,
      finish: 'leather',
    })

    body.add(arm)

    body.add(
      limb(0.85, 3.4, {
        at: [side * 4.6, 4.6, 0.2],
        rotate: [0.1, 0, side * 0.05],
        color: colors.skin,
        finish: 'skin',
      }),
    )

    body.add(ball(0.95, { at: [side * 4.8, 2.6, 0.3], color: colors.skin, finish: 'skin' }))
  }

  for (const side of [-1, 1]) {
    body.add(
      limb(1.25, 3.4, {
        at: [side * 1.5, 3.6, 0],
        color: colors.secondary,
        finish: 'leather',
      }),
    )

    // Bota: cano arredondado mais um pé alongado à frente.
    body.add(limb(1.2, 1.6, { at: [side * 1.5, 1.2, 0], color: colors.trim, finish: 'leather' }))

    const foot = ball(1.25, { at: [side * 1.5, 0.55, 0.7], color: colors.trim, finish: 'leather' })

    foot.scale.set(1, 0.6, 1.5)
    body.add(foot)
  }

  return body
}

/** Cabelo em mechas arredondadas; com elmo fica escondido. */
function buildHair(style: string, colors: Palette, hidden: boolean): THREE.Group {
  const hair = new THREE.Group()

  if (hidden) {
    return hair
  }

  // Calota que acompanha o crânio.
  const cap = mesh(new THREE.SphereGeometry(3.62, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.62), {
    at: [0, 16.8, 0],
    color: colors.hair,
  })

  cap.scale.set(1, 1.12, 0.98)
  hair.add(cap)

  const strand = (
    radius: number,
    length: number,
    at: [number, number, number],
    rotate: [number, number, number],
    color = colors.hair,
  ) => hair.add(limb(radius, length, { at, rotate, color }))

  if (style === 'moicano') {
    for (const [index, z] of [1.7, 0.6, -0.5, -1.6].entries()) {
      strand(0.5 - index * 0.05, 2.4 - index * 0.2, [0, 20.2 - index * 0.35, z], [0.2, 0, 0])
    }

    return hair
  }

  if (style === 'espetado') {
    for (const [x, z, tilt] of [
      [-1.6, 0.9, -0.5],
      [0, 1.3, 0],
      [1.6, 0.9, 0.5],
      [-1, -1.3, -0.3],
      [1, -1.3, 0.3],
    ] as const) {
      strand(0.55, 2.6, [x, 19.6, z], [-0.45, 0, tilt])
    }
  }

  if (style === 'curto') {
    strand(1.1, 1.6, [0, 16.4, -2.5], [0.35, 0, 0])

    for (const side of [-1, 1]) {
      strand(0.8, 2.2, [side * 2.9, 16.6, 0.4], [0, 0, side * 0.25], colors.hairShade)
    }
  }

  if (style === 'longo') {
    const tail = revolve(
      [
        [2.9, 0],
        [3.1, -1.6],
        [2.6, -4.4],
        [1.4, -6],
        [0, -6.4],
      ],
      { at: [0, 17, -0.5], color: colors.hair },
    )

    tail.scale.set(1, 1, 0.75)
    hair.add(tail)

    for (const side of [-1, 1]) {
      strand(0.85, 4.4, [side * 2.9, 14.6, 1], [0, 0, side * 0.12], colors.hairShade)
    }
  }

  // Franja recortada na frente, comum a todos os cortes com calota.
  for (const [x, drop] of [
    [-2.2, 0.2],
    [-0.8, 0.6],
    [0.8, 0.5],
    [2.2, 0.1],
  ] as const) {
    strand(0.62, 1.5 + drop, [x, 18.3 - drop, 2.5], [0.25, 0, x * 0.08])
  }

  return hair
}

/** Peças que cada set (e a classe) adicionam sobre o corpo base. */
function buildFeatures(features: string[], colors: Palette): THREE.Group {
  const group = new THREE.Group()

  if (features.includes('belt')) {
    group.add(
      mesh(new THREE.TorusGeometry(2.75, 0.42, 10, 32), {
        at: [0, 7.2, 0],
        rotate: [Math.PI / 2, 0, 0],
        color: colors.trim,
        finish: 'metal',
      }),
    )

    group.add(
      mesh(new THREE.OctahedronGeometry(0.8), {
        at: [0, 7.2, 2.5],
        color: colors.trim,
        finish: 'metal',
      }),
    )
  }

  if (features.includes('shoulders') || features.includes('class_pauldron')) {
    const heavy = features.includes('class_pauldron')

    for (const side of [-1, 1]) {
      const pad = mesh(new THREE.SphereGeometry(heavy ? 2.3 : 1.9, 24, 16, 0, Math.PI * 2, 0, 1.5), {
        at: [side * 3.4, 11.6, 0],
        rotate: [0, 0, side * 0.3],
        color: colors.trim,
        finish: 'metal',
      })

      pad.scale.set(1, 0.75, 1.05)
      group.add(pad)

      if (heavy) {
        group.add(
          mesh(new THREE.ConeGeometry(0.35, 1.4, 10), {
            at: [side * 4.6, 12.4, 0],
            rotate: [0, 0, side * 0.9],
            color: colors.trim,
            finish: 'metal',
          }),
        )
      }
    }
  }

  if (features.includes('cape')) {
    const cape = revolve(
      [
        [3.2, 12],
        [3.6, 9],
        [4.2, 4],
        [4.6, 0.6],
      ],
      { color: colors.cape, finish: 'cloth' },
    )

    // Meia casca: a capa cobre só as costas.
    cape.scale.set(1, 1, 0.55)
    cape.position.z = -1.3
    cape.material.side = THREE.DoubleSide
    group.add(cape)

    group.add(
      mesh(new THREE.TorusGeometry(2.6, 0.3, 8, 28, Math.PI), {
        at: [0, 12.4, -0.6],
        rotate: [Math.PI / 2, 0, 0],
        color: colors.trim,
        finish: 'metal',
      }),
    )
  }

  if (features.includes('robe') || features.includes('class_robe')) {
    const robe = revolve(
      [
        [2.9, 8],
        [3.6, 5],
        [4.4, 2],
        [5, 0.2],
      ],
      { color: colors.cape, finish: 'cloth' },
    )

    robe.material.side = THREE.DoubleSide
    group.add(robe)
  }

  if (features.includes('hood') || features.includes('class_hood')) {
    const hood = mesh(new THREE.SphereGeometry(4, 26, 18, 0, Math.PI * 2, 0, Math.PI * 0.55), {
      at: [0, 16.6, -0.6],
      rotate: [-0.18, 0, 0],
      color: colors.cape,
      finish: 'cloth',
    })

    hood.scale.set(1.05, 1.15, 1.05)
    hood.material.side = THREE.DoubleSide
    group.add(hood)

    group.add(
      mesh(new THREE.ConeGeometry(1.5, 3.4, 14), {
        at: [0, 15.4, -3.4],
        rotate: [-0.9, 0, 0],
        color: colors.cape,
        finish: 'cloth',
      }),
    )
  }

  if (features.includes('quiver') || features.includes('class_quiver')) {
    group.add(
      limb(0.9, 3.6, {
        at: [-2.4, 9.6, -2.4],
        rotate: [0.2, 0, -0.45],
        color: colors.grip,
        finish: 'leather',
      }),
    )

    for (const offset of [-0.5, 0, 0.5]) {
      group.add(
        limb(0.09, 3, {
          at: [-2.4 + offset * 0.6, 12.4, -2.4 + offset * 0.4],
          rotate: [0.2, 0, -0.45],
          color: colors.trim,
        }),
      )
    }
  }

  if (features.includes('helmet')) {
    // Calota aberta: para o rosto continuar visível, o corte para acima dos olhos.
    const shell = mesh(new THREE.SphereGeometry(3.7, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.42), {
      at: [0, 16.9, 0],
      color: colors.secondary,
      finish: 'metal',
    })

    shell.scale.set(1.05, 1.14, 1.03)
    group.add(shell)

    const rim = mesh(new THREE.TorusGeometry(3.55, 0.24, 10, 40), {
      at: [0, 18.35, 0],
      rotate: [Math.PI / 2, 0, 0],
      color: colors.trim,
      finish: 'metal',
    })

    rim.scale.set(1.03, 1, 1)
    group.add(rim)

    // Protetores laterais descendo até a linha da bochecha.
    for (const side of [-1, 1]) {
      const guard = ball(1.6, {
        at: [side * 2.95, 17.2, 0.2],
        color: colors.secondary,
        finish: 'metal',
      })

      guard.scale.set(0.32, 1.05, 1.05)
      group.add(guard)
    }

    for (const side of [-1, 1]) {
      group.add(
        mesh(new THREE.ConeGeometry(0.4, 2.6, 10), {
          at: [side * 2.4, 19.6, -0.4],
          rotate: [0, 0, side * 0.45],
          color: colors.trim,
          finish: 'metal',
        }),
      )
    }
  }

  return group
}

function buildAura(colors: Palette): THREE.Group {
  const aura = new THREE.Group()

  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(9.5, 1),
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

  // Runas orbitando: dão movimento sem custar geometria pesada.
  const runes = new THREE.Group()

  runes.name = 'aura-runes'

  for (const [index, angle] of [0, 2.1, 4.2].entries()) {
    const rune = mesh(new THREE.TorusGeometry(0.9, 0.12, 6, 18), {
      at: [Math.cos(angle) * 5.4, 6 + index * 2.4, Math.sin(angle) * 5.4],
      rotate: [Math.PI / 2, angle, 0],
      color: colors.trim,
      finish: 'glow',
    })

    runes.add(rune)
  }

  aura.add(runes)

  const light = new THREE.PointLight(new THREE.Color(colors.trim), 70, 40)

  light.position.set(0, 10, 6)
  aura.add(light)

  return aura
}

/** Arma na mão direita; cada id monta uma silhueta diferente. */
function buildWeapon(id: string, colors: Palette): THREE.Group {
  const hand = new THREE.Group()

  hand.position.set(4.9, 2.6, 0.5)
  hand.rotation.z = -0.1

  const steel: Finish = id === 'sombras' ? 'glow' : 'metal'

  const edge = (geometry: THREE.BufferGeometry, options: Omit<Placement, 'color'>) =>
    hand.add(mesh(geometry, { ...options, color: colors.blade, finish: steel }))

  const shaft = (radius: number, length: number, at: [number, number, number]) =>
    hand.add(limb(radius, length, { at, color: colors.grip, finish: 'leather' }))

  if (id === 'bastao') {
    shaft(0.36, 12, [0, 3, 0])
    edge(new THREE.TorusGeometry(0.5, 0.14, 8, 20), { at: [0, 8.6, 0], rotate: [Math.PI / 2, 0, 0] })
  }

  if (id === 'adaga') {
    edge(new THREE.ConeGeometry(0.55, 4.4, 4), { at: [0, 4.4, 0] })
    edge(new THREE.BoxGeometry(2.4, 0.3, 0.5), { at: [0, 2.1, 0] })
    shaft(0.28, 1.4, [0, 1.1, 0])
  }

  if (id === 'espada') {
    edge(new THREE.ConeGeometry(0.85, 10, 4), { at: [0, 7.8, 0] })
    edge(new THREE.BoxGeometry(3.6, 0.4, 0.7), { at: [0, 2.6, 0] })
    edge(new THREE.SphereGeometry(0.45, 14, 10), { at: [0, 0.5, 0] })
    shaft(0.32, 1.9, [0, 1.5, 0])
  }

  if (id === 'machado') {
    shaft(0.36, 10, [0, 4, 0])

    const blade = mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.5, 20, 1, false, 0, Math.PI * 0.9), {
      at: [0, 8.4, 1],
      rotate: [Math.PI / 2, 0, Math.PI / 2],
      color: colors.blade,
      finish: 'metal',
    })

    hand.add(blade)
    edge(new THREE.ConeGeometry(0.4, 1.6, 10), { at: [0, 10.2, 0] })
  }

  if (id === 'alabarda') {
    shaft(0.34, 15, [0, 5.4, 0])
    edge(new THREE.ConeGeometry(0.7, 4.6, 4), { at: [0, 15, 0] })

    const hook = mesh(new THREE.TorusGeometry(1.3, 0.22, 8, 20, Math.PI), {
      at: [0, 12.6, 1],
      rotate: [Math.PI / 2, 0, 0],
      color: colors.blade,
      finish: 'metal',
    })

    hand.add(hook)
  }

  if (id === 'sombras') {
    edge(new THREE.ConeGeometry(1.1, 12.4, 4), { at: [0, 9, 0] })
    edge(new THREE.BoxGeometry(4.4, 0.4, 0.8), { at: [0, 2.7, 0] })
    edge(new THREE.OctahedronGeometry(0.6), { at: [0, 0.4, 0] })
    shaft(0.34, 2.2, [0, 1.5, 0])
  }

  return hand
}

export function hasAura(catalog: Catalog, equipped: AvatarEquipped): boolean {
  return piece(catalog, 'outfit', equipped.outfit)?.features.includes('aura') ?? false
}

/** Monta o boneco completo, com o centro do corpo na origem. */
export function buildFigure(catalog: Catalog, equipped: AvatarEquipped): THREE.Group {
  const colors = palette(catalog, equipped)
  const outfit = piece(catalog, 'outfit', equipped.outfit)
  const klass = piece(catalog, 'char_class', equipped.char_class)

  const features = [...(outfit?.features ?? []), ...(klass?.features ?? [])]

  const figure = new THREE.Group()

  // Plataforma de invocação sob os pés.
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(5.6, 0.2, 8, 48),
    new THREE.MeshStandardMaterial({
      color: colors.accent,
      emissive: new THREE.Color(colors.accent),
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.7,
    }),
  )

  ring.rotation.x = Math.PI / 2
  figure.add(ring)

  figure.add(buildHead(colors))
  figure.add(buildBody(colors))
  figure.add(
    buildHair(
      equipped.hair,
      colors,
      features.includes('helmet') || features.includes('hood') || features.includes('class_hood'),
    ),
  )
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
  scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x101a2c, 1.1))

  const key = new THREE.DirectionalLight(0xffffff, 2.2)

  key.position.set(12, 20, 18)
  scene.add(key)

  const rim = new THREE.DirectionalLight(0x4cc9ff, 1.1)

  rim.position.set(-14, 12, -12)
  scene.add(rim)

  const fill = new THREE.DirectionalLight(0xffffff, 0.4)

  fill.position.set(0, -6, 12)
  scene.add(fill)
}
