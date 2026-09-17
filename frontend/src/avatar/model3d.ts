import * as THREE from 'three'

import type { AvatarEquipped, AvatarPiece, AvatarSlot } from '../types'

/**
 * Boneco 3D do Caçador em proporção heroica (~5 cabeças), montado só com
 * primitivas de three.js — cápsulas, esferas, cones e superfícies de revolução
 * com poucos segmentos, o que dá o ar angular/gótico — sem nenhum modelo ou
 * textura de terceiros.
 *
 * O backend manda cores e uma lista de `features` por peça; aqui cada feature
 * vira geometria (`plate_heavy`, `pauldrons_spiked`, `cape_tattered`, `robe`,
 * `hood`, `mask`, `helmet_horned`, `back_blades`, ...) e cada arma traz um
 * token `shape_*` que escolhe a silhueta. Set novo = paleta + features, sem
 * mexer neste arquivo.
 */

export type Catalog = Record<AvatarSlot, AvatarPiece[]>

/** Altura aproximada do boneco em unidades da cena, usada para enquadrar a câmera. */
export const FIGURE_HEIGHT = 24

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
    skin: skin.skin ?? '#c48a5e',
    skinShade: skin.shade ?? '#9b6640',
    hair: hair.hair ?? '#20202a',
    hairShade: hair.shade ?? '#111117',
    primary: outfit.primary ?? '#39373a',
    secondary: outfit.secondary ?? '#26252a',
    trim: outfit.trim ?? '#5b5760',
    cape: outfit.cape ?? outfit.secondary ?? '#1c1b20',
    blade: weapon.blade ?? '#9aa4b2',
    grip: weapon.grip ?? '#2a2118',
    accent: klass.trim ?? outfit.trim ?? '#5b5760',
  }
}

type Finish = 'skin' | 'cloth' | 'leather' | 'metal' | 'glow'

/** Materiais escuros com pouco brilho difuso: leitura sombria, quase gótica. */
function material(color: string, finish: Finish): THREE.MeshStandardMaterial {
  const options: THREE.MeshStandardMaterialParameters = { color, flatShading: false }

  if (finish === 'metal') {
    options.metalness = 0.85
    options.roughness = 0.34
  } else if (finish === 'glow') {
    options.emissive = new THREE.Color(color)
    options.emissiveIntensity = 0.85
    options.metalness = 0.5
    options.roughness = 0.2
  } else if (finish === 'leather') {
    options.metalness = 0.15
    options.roughness = 0.72
  } else if (finish === 'skin') {
    options.metalness = 0.02
    options.roughness = 0.78
  } else {
    options.metalness = 0.06
    options.roughness = 0.85
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

/** Cápsula: base de quase todo membro. */
function limb(radius: number, length: number, options: Placement): Part {
  return mesh(new THREE.CapsuleGeometry(radius, length, 6, 16), options)
}

function ball(radius: number, options: Placement): Part {
  return mesh(new THREE.SphereGeometry(radius, 20, 14), options)
}

function spike(radius: number, length: number, options: Placement): Part {
  return mesh(new THREE.ConeGeometry(radius, length, 6), options)
}

/**
 * Tronco/manto por revolução: `profile` é o raio em cada altura. Com 12 lados
 * as facetas ficam visíveis, o que dá o aspecto de placa em vez de plástico.
 */
function revolve(
  profile: [number, number][],
  options: Placement,
  segments = 12,
): Part {
  const points = profile.map(([radius, y]) => new THREE.Vector2(radius, y))

  return mesh(new THREE.LatheGeometry(points, segments), options)
}

/**
 * Painel de tecido/placa usado em sobreveste, tiras e lâminas. É extrudado com
 * bisel em vez de ser uma caixa crua: a quina chanfrada pega a luz e tira o
 * aspecto de bloco de Lego que uma `BoxGeometry` tem nesse tamanho.
 */
function panel(
  width: number,
  height: number,
  depth: number,
  options: Placement,
): Part {
  const bevel = Math.min(width, height, depth) * 0.22
  const inset = bevel * 0.9

  const shape = new THREE.Shape()

  shape.moveTo(-width / 2 + inset, -height / 2)
  shape.lineTo(width / 2 - inset, -height / 2)
  shape.lineTo(width / 2, -height / 2 + inset)
  shape.lineTo(width / 2, height / 2 - inset)
  shape.lineTo(width / 2 - inset, height / 2)
  shape.lineTo(-width / 2 + inset, height / 2)
  shape.lineTo(-width / 2, height / 2 - inset)
  shape.lineTo(-width / 2, -height / 2 + inset)
  shape.closePath()

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(depth - bevel * 2, depth * 0.3),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 1,
  })

  geometry.translate(0, 0, -depth / 2)

  return mesh(geometry, options)
}

/**
 * Lâmina: contorno extrudado com base larga, afinamento e ponta em bisel, em
 * vez de uma caixa com um cone na ponta. A geometria nasce com a base em y=0.
 */
function bladeGeometry(length: number, width: number): THREE.ExtrudeGeometry {
  const half = width / 2
  const shape = new THREE.Shape()

  shape.moveTo(-half, 0)
  shape.lineTo(half, 0)
  shape.lineTo(half * 0.84, length * 0.6)
  shape.lineTo(half * 0.6, length * 0.88)
  shape.lineTo(0, length)
  shape.lineTo(-half * 0.6, length * 0.88)
  shape.lineTo(-half * 0.84, length * 0.6)
  shape.closePath()

  const thickness = Math.max(width * 0.24, 0.16)

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.9,
    bevelSize: Math.min(half * 0.5, thickness * 1.5),
    bevelSegments: 1,
    curveSegments: 1,
  })

  geometry.translate(0, 0, -thickness / 2)

  return geometry
}

// ============================================================================
// CORPO
// ============================================================================

const SHOULDER_Y = 16.4
const HAND = { x: 4.8, y: 7.6, z: 0.5 }

function buildHead(colors: Palette): THREE.Group {
  const head = new THREE.Group()

  const skull = ball(2.6, { at: [0, 19.9, 0], color: colors.skin, finish: 'skin' })

  skull.scale.set(0.95, 1.12, 1)
  head.add(skull)

  // Maxilar: dá queixo em vez de bola.
  const jaw = ball(2.1, { at: [0, 18.7, 0.35], color: colors.skin, finish: 'skin' })

  jaw.scale.set(0.9, 0.85, 0.95)
  head.add(jaw)

  head.add(limb(0.78, 1.1, { at: [0, 17.6, 0], color: colors.skin, finish: 'skin' }))

  // Olhos estreitos e fundos, com brilho frio.
  for (const x of [-0.95, 0.95]) {
    const socket = panel(1.05, 0.42, 0.3, {
      at: [x, 20.1, 2.28],
      rotate: [0, 0, x > 0 ? -0.12 : 0.12],
      color: '#0b0c10',
    })

    head.add(socket)

    const glint = panel(0.7, 0.2, 0.16, {
      at: [x, 20.1, 2.38],
      rotate: [0, 0, x > 0 ? -0.12 : 0.12],
      color: '#cfe4ff',
      finish: 'glow',
    })

    head.add(glint)
  }

  const brow = panel(2.9, 0.3, 0.4, { at: [0, 20.75, 2.1], color: colors.skinShade, finish: 'skin' })

  head.add(brow)

  return head
}

/** Torso, braços, mãos, pernas e botas — a base que os sets cobrem. */
function buildBody(colors: Palette): THREE.Group {
  const body = new THREE.Group()

  // Ombro largo caindo para a cintura estreita: silhueta em V.
  body.add(
    revolve(
      [
        [2.5, 9.2],
        [2.9, 10.4],
        [2.4, 12.4],
        [3.1, 14.6],
        [3.5, 15.9],
        [3.1, 16.9],
        [1.8, 17.4],
        [0, 17.6],
      ],
      { color: colors.primary, finish: 'leather' },
    ),
  )

  for (const side of [-1, 1]) {
    body.add(
      ball(1.32, {
        at: [side * 3.2, SHOULDER_Y, 0],
        color: colors.secondary,
        finish: 'leather',
      }),
    )

    body.add(
      limb(0.92, 3.9, {
        at: [side * 3.85, 13.6, 0],
        rotate: [0, 0, side * 0.14],
        color: colors.secondary,
        finish: 'leather',
      }),
    )

    // Antebraço enfaixado em couro: evita o braço de boneco liso.
    body.add(
      limb(0.8, 3.4, {
        at: [side * 4.45, 9.7, 0.2],
        rotate: [0.08, 0, side * 0.06],
        color: colors.trim,
        finish: 'leather',
      }),
    )

    for (const y of [10.9, 9.9, 8.9]) {
      body.add(
        mesh(new THREE.TorusGeometry(0.84, 0.13, 6, 14), {
          at: [side * 4.45, y, 0.2],
          rotate: [Math.PI / 2, 0, 0],
          color: colors.secondary,
          finish: 'leather',
        }),
      )
    }

    // Luva com dorso facetado em vez de bola de pele.
    const glove = ball(0.86, { at: [side * 4.7, 7.7, 0.35], color: colors.secondary, finish: 'leather' })

    glove.scale.set(0.85, 1.05, 0.95)
    body.add(glove)

    body.add(
      mesh(new THREE.OctahedronGeometry(0.5), {
        at: [side * 4.85, 7.9, 0.5],
        color: colors.trim,
        finish: 'metal',
      }),
    )
  }

  // Quadril e pernas.
  body.add(
    revolve(
      [
        [2.6, 9.4],
        [2.7, 8.4],
        [2.3, 7.6],
      ],
      { color: colors.secondary, finish: 'leather' },
    ),
  )

  for (const side of [-1, 1]) {
    body.add(
      limb(1.15, 3.6, {
        at: [side * 1.45, 5.6, 0],
        color: colors.secondary,
        finish: 'leather',
      }),
    )

    body.add(
      limb(1, 2.6, {
        at: [side * 1.45, 2.4, 0.1],
        color: colors.secondary,
        finish: 'leather',
      }),
    )

    // Bota: cano com dobra, pé estreito e só a fivela em metal claro.
    body.add(
      mesh(new THREE.CylinderGeometry(1.2, 1.02, 2.4, 10), {
        at: [side * 1.45, 1.4, 0.05],
        color: colors.primary,
        finish: 'leather',
      }),
    )

    body.add(
      mesh(new THREE.CylinderGeometry(1.34, 1.24, 0.5, 10), {
        at: [side * 1.45, 2.5, 0.05],
        color: colors.trim,
        finish: 'metal',
      }),
    )

    const foot = panel(1.85, 0.8, 2.9, {
      at: [side * 1.45, 0.42, 0.62],
      color: colors.primary,
      finish: 'leather',
    })

    body.add(foot)

    body.add(
      mesh(new THREE.BoxGeometry(1.9, 0.3, 2.95), {
        at: [side * 1.45, 0.16, 0.62],
        color: '#14161d',
        finish: 'leather',
      }),
    )
  }

  return body
}

/** Cabelo em mechas; com elmo, capuz ou máscara integral fica escondido. */
function buildHair(style: string, colors: Palette, hidden: boolean): THREE.Group {
  const hair = new THREE.Group()

  if (hidden) {
    return hair
  }

  const cap = mesh(new THREE.SphereGeometry(2.72, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.6), {
    at: [0, 19.9, 0],
    color: colors.hair,
  })

  cap.scale.set(0.96, 1.2, 1.02)
  hair.add(cap)

  const strand = (
    radius: number,
    length: number,
    at: [number, number, number],
    rotate: [number, number, number],
    color = colors.hair,
  ) => hair.add(limb(radius, length, { at, rotate, color }))

  if (style === 'moicano') {
    for (const [index, z] of [1.3, 0.4, -0.5, -1.4].entries()) {
      strand(0.36, 1.9 - index * 0.2, [0, 22.4 - index * 0.3, z], [0.18, 0, 0])
    }

    return hair
  }

  if (style === 'espetado') {
    for (const [x, z, tilt] of [
      [-1.2, 0.7, -0.5],
      [0, 1, 0],
      [1.2, 0.7, 0.5],
      [-0.8, -1, -0.3],
      [0.8, -1, 0.3],
    ] as const) {
      strand(0.4, 2, [x, 22, z], [-0.45, 0, tilt])
    }
  }

  if (style === 'curto') {
    strand(0.85, 1.2, [0, 19.6, -1.9], [0.35, 0, 0])

    for (const side of [-1, 1]) {
      strand(0.6, 1.7, [side * 2.2, 19.7, 0.3], [0, 0, side * 0.25], colors.hairShade)
    }
  }

  if (style === 'longo') {
    const tail = revolve(
      [
        [2.2, 0],
        [2.4, -1.4],
        [2, -3.8],
        [1, -5.2],
        [0, -5.6],
      ],
      { at: [0, 20, -0.4], color: colors.hair },
    )

    tail.scale.set(1, 1, 0.7)
    hair.add(tail)

    for (const side of [-1, 1]) {
      strand(0.6, 3.6, [side * 2.2, 18, 0.8], [0, 0, side * 0.1], colors.hairShade)
    }
  }

  for (const [x, drop] of [
    [-1.7, 0.2],
    [-0.6, 0.5],
    [0.6, 0.45],
    [1.7, 0.1],
  ] as const) {
    strand(0.45, 1.1 + drop, [x, 21.1 - drop, 1.9], [0.25, 0, x * 0.1])
  }

  return hair
}

// ============================================================================
// FEATURES DOS SETS
// ============================================================================

function addBelt(group: THREE.Group, colors: Palette) {
  group.add(
    mesh(new THREE.TorusGeometry(2.5, 0.36, 8, 20), {
      at: [0, 11.4, 0],
      rotate: [Math.PI / 2, 0, 0],
      color: colors.trim,
      finish: 'metal',
    }),
  )

  group.add(
    mesh(new THREE.OctahedronGeometry(0.72), {
      at: [0, 11.4, 2.35],
      color: colors.trim,
      finish: 'metal',
    }),
  )
}

/** Correias cruzadas: leitura de couro tosco, sem placa. */
function addHarness(group: THREE.Group, colors: Palette) {
  for (const side of [-1, 1]) {
    group.add(
      panel(0.85, 7.4, 0.4, {
        at: [side * 0.7, 13.4, 1.9],
        rotate: [0, 0, side * 0.35],
        color: colors.trim,
        finish: 'leather',
      }),
    )
  }

  group.add(
    panel(1, 1, 0.5, { at: [0, 13.6, 2.2], color: colors.trim, finish: 'metal' }),
  )
}

function addPlate(group: THREE.Group, colors: Palette, heavy: boolean) {
  const chest = revolve(
    heavy
      ? [
          [3.1, 11.8],
          [3.7, 13.2],
          [3.9, 15],
          [3.4, 16.4],
          [2.2, 17.2],
        ]
      : [
          [2.8, 12],
          [3.3, 13.4],
          [3.5, 15],
          [3.1, 16.4],
          [2, 17.1],
        ],
    { color: colors.secondary, finish: 'metal' },
    heavy ? 10 : 12,
  )

  group.add(chest)

  // Gola alta e crista central.
  group.add(
    mesh(new THREE.CylinderGeometry(1.9, 2.4, 1.6, 10, 1, true), {
      at: [0, 17.4, 0],
      color: colors.trim,
      finish: 'metal',
    }),
  )

  group.add(
    panel(0.5, 4.6, 0.6, { at: [0, 14.6, 3.1], color: colors.trim, finish: 'metal' }),
  )

  if (heavy) {
    for (const side of [-1, 1]) {
      group.add(
        panel(1.1, 3.4, 0.5, {
          at: [side * 2.1, 14.4, 2.8],
          rotate: [0, side * 0.35, 0],
          color: colors.trim,
          finish: 'metal',
        }),
      )
    }
  }
}

/** Saiote de placas: tiras verticais soltas na cintura. */
function addSkirtPlate(group: THREE.Group, colors: Palette) {
  for (let index = 0; index < 10; index += 1) {
    const angle = (index / 10) * Math.PI * 2

    group.add(
      panel(1.5, 3.6, 0.45, {
        at: [Math.sin(angle) * 2.5, 9.4, Math.cos(angle) * 2.5],
        rotate: [0.06, angle, 0],
        color: colors.secondary,
        finish: 'metal',
      }),
    )
  }
}

/** Sobrecasaca: painéis longos de couro caindo dos ombros. */
function addCoat(group: THREE.Group, colors: Palette) {
  for (const side of [-1, 1]) {
    const skirt = panel(2.6, 8.6, 0.5, {
      at: [side * 1.9, 8.4, 1.6],
      rotate: [0.05, side * -0.25, side * 0.05],
      color: colors.primary,
      finish: 'leather',
    })

    group.add(skirt)
  }

  const back = revolve(
    [
      [3, 16.2],
      [3.4, 13],
      [3.6, 8],
      [3.2, 4.4],
    ],
    { color: colors.primary, finish: 'leather' },
    10,
  )

  back.scale.set(1, 1, 0.6)
  back.position.z = -0.9
  back.material.side = THREE.DoubleSide
  group.add(back)
}

function addTabard(group: THREE.Group, colors: Palette) {
  group.add(
    panel(2.9, 8.4, 0.35, {
      at: [0, 10.4, 2.75],
      color: colors.cape,
      finish: 'cloth',
    }),
  )

  group.add(
    spike(1.5, 1.8, {
      at: [0, 5.6, 2.75],
      rotate: [0, 0, Math.PI],
      color: colors.cape,
      finish: 'cloth',
    }),
  )
}

function addSash(group: THREE.Group, colors: Palette) {
  group.add(
    panel(1.5, 8.6, 0.4, {
      at: [0.5, 13.4, 2.1],
      rotate: [0, 0, 0.5],
      color: colors.trim,
      finish: 'cloth',
    }),
  )
}

function addPauldrons(
  group: THREE.Group,
  colors: Palette,
  options: { spiked?: boolean; sides?: number[] },
) {
  const spiked = options.spiked ?? false
  const sides = options.sides ?? [-1, 1]

  for (const side of sides) {
    const pad = revolve(
      spiked
        ? [
            [0, 1.9],
            [2.1, 1.3],
            [2.7, 0.1],
            [2.3, -1.1],
          ]
        : [
            [0, 1.6],
            [1.7, 1],
            [2.2, -0.2],
            [1.9, -1.1],
          ],
      {
        at: [side * 3.3, SHOULDER_Y + 0.4, 0],
        rotate: [0, 0, side * 0.28],
        color: colors.secondary,
        finish: 'metal',
      },
      8,
    )

    pad.material.side = THREE.DoubleSide
    group.add(pad)

    group.add(
      mesh(new THREE.TorusGeometry(spiked ? 2.5 : 2, 0.22, 6, 16), {
        at: [side * 3.3, SHOULDER_Y - 0.6, 0],
        rotate: [Math.PI / 2, 0, side * 0.28],
        color: colors.trim,
        finish: 'metal',
      }),
    )

    if (spiked) {
      for (const [index, tilt] of [-0.5, 0.1, 0.7].entries()) {
        group.add(
          spike(0.4, 2.6 - index * 0.4, {
            at: [side * (4 + index * 0.1), SHOULDER_Y + 1.6, tilt * 2],
            rotate: [tilt * 0.6, 0, side * 1.1],
            color: colors.trim,
            finish: 'metal',
          }),
        )
      }
    }
  }
}

function addCape(group: THREE.Group, colors: Palette, kind: 'short' | 'long' | 'tattered') {
  const bottom = kind === 'short' ? 6.5 : 1.2

  const cape = revolve(
    [
      [3, SHOULDER_Y + 0.8],
      [3.4, 13],
      [4.1, 7],
      [4.6, bottom],
    ],
    { color: colors.cape, finish: 'cloth' },
    12,
  )

  cape.scale.set(1, 1, 0.5)
  cape.position.z = -1.1
  cape.material.side = THREE.DoubleSide
  group.add(cape)

  // Fecho no peito.
  group.add(
    mesh(new THREE.TorusGeometry(2.4, 0.26, 6, 18, Math.PI), {
      at: [0, SHOULDER_Y + 0.9, -0.4],
      rotate: [Math.PI / 2, 0, 0],
      color: colors.trim,
      finish: 'metal',
    }),
  )

  if (kind === 'tattered') {
    // Tiras irregulares abaixo da barra: o esfarrapado vem daqui.
    for (const [index, x] of [-3.2, -1.8, -0.4, 1.1, 2.6].entries()) {
      group.add(
        spike(0.75, 3.4 + (index % 3) * 1.3, {
          at: [x, bottom - 1.2, -2.6 + (index % 2) * 0.4],
          rotate: [0, 0, Math.PI + (index - 2) * 0.08],
          color: colors.cape,
          finish: 'cloth',
        }),
      )
    }
  }
}

function addRobe(group: THREE.Group, colors: Palette, split: boolean) {
  const robe = revolve(
    [
      [2.7, 11.6],
      [3.3, 8],
      [4.2, 4],
      [4.8, 0.4],
    ],
    { color: colors.primary, finish: 'cloth' },
    14,
  )

  robe.material.side = THREE.DoubleSide
  group.add(robe)

  if (split) {
    // Fenda frontal: dois painéis de forro deixam a perna aparecer no meio.
    for (const side of [-1, 1]) {
      group.add(
        panel(2.4, 11.4, 0.3, {
          at: [side * 1.9, 5.9, 2.6],
          rotate: [0, side * -0.3, side * 0.04],
          color: colors.cape,
          finish: 'cloth',
        }),
      )
    }
  }
}

function addHood(group: THREE.Group, colors: Palette) {
  const hood = mesh(new THREE.SphereGeometry(3.1, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), {
    at: [0, 19.6, -0.5],
    rotate: [-0.16, 0, 0],
    color: colors.cape,
    finish: 'cloth',
  })

  hood.scale.set(1.08, 1.2, 1.1)
  hood.material.side = THREE.DoubleSide
  group.add(hood)

  // Bico caído nas costas e sombra na abertura do capuz.
  group.add(
    spike(1.3, 3.6, {
      at: [0, 18.6, -3],
      rotate: [-1, 0, 0],
      color: colors.cape,
      finish: 'cloth',
    }),
  )

  const shade = mesh(new THREE.TorusGeometry(2.5, 0.5, 6, 18, Math.PI * 1.2), {
    at: [0, 20.2, 0.9],
    rotate: [0.25, 0, Math.PI * 0.9],
    color: colors.cape,
    finish: 'cloth',
  })

  group.add(shade)
}

function addMask(group: THREE.Group, colors: Palette) {
  const mask = revolve(
    [
      [1.9, 20],
      [2.2, 19.2],
      [1.7, 18.2],
      [0.7, 17.9],
    ],
    { at: [0, 0, 0.3], color: colors.secondary, finish: 'metal' },
    10,
  )

  mask.scale.set(1, 1, 1.15)
  group.add(mask)

  group.add(
    spike(0.6, 2.2, {
      at: [0, 18.4, 2.4],
      rotate: [1.35, 0, 0],
      color: colors.trim,
      finish: 'metal',
    }),
  )
}

function addHelmet(group: THREE.Group, colors: Palette, horned: boolean) {
  const shell = mesh(new THREE.SphereGeometry(2.85, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), {
    at: [0, 19.9, 0],
    color: colors.secondary,
    finish: 'metal',
  })

  shell.scale.set(1.02, 1.2, 1.04)
  group.add(shell)

  // Viseira em T: fenda dos olhos e protetor do nariz.
  group.add(panel(4.4, 0.9, 0.6, { at: [0, 20.1, 2.1], color: '#0a0b0f' }))
  group.add(
    panel(0.7, 3.4, 0.6, { at: [0, 19.2, 2.25], color: colors.secondary, finish: 'metal' }),
  )

  for (const side of [-1, 1]) {
    group.add(
      panel(0.5, 3.6, 2.4, {
        at: [side * 2.4, 19, 0.6],
        color: colors.secondary,
        finish: 'metal',
      }),
    )
  }

  group.add(
    mesh(new THREE.TorusGeometry(2.75, 0.2, 6, 20), {
      at: [0, 21, 0],
      rotate: [Math.PI / 2, 0, 0],
      color: colors.trim,
      finish: 'metal',
    }),
  )

  if (horned) {
    for (const side of [-1, 1]) {
      group.add(
        mesh(new THREE.TorusGeometry(1.9, 0.32, 6, 14, Math.PI * 0.8), {
          at: [side * 2.5, 21.4, -0.4],
          rotate: [0.2, side * 0.4, side * -1.9],
          color: colors.trim,
          finish: 'metal',
        }),
      )
    }
  } else {
    group.add(
      panel(0.4, 1.2, 4.4, { at: [0, 22.1, -0.4], color: colors.trim, finish: 'metal' }),
    )
  }
}

function addCrown(group: THREE.Group, colors: Palette, circlet: boolean) {
  group.add(
    mesh(new THREE.TorusGeometry(2.7, 0.22, 6, 22), {
      at: [0, circlet ? 20.9 : 21.8, 0],
      rotate: [Math.PI / 2, 0, 0],
      color: colors.trim,
      finish: 'metal',
    }),
  )

  if (circlet) {
    group.add(
      mesh(new THREE.OctahedronGeometry(0.6), {
        at: [0, 21.1, 2.5],
        color: colors.trim,
        finish: 'glow',
      }),
    )

    return
  }

  for (let index = 0; index < 7; index += 1) {
    const angle = (index / 7) * Math.PI * 2 - Math.PI / 2

    group.add(
      spike(0.32, index % 2 === 0 ? 2.2 : 1.4, {
        at: [Math.cos(angle) * 2.6, 22.7, Math.sin(angle) * 2.6],
        color: colors.trim,
        finish: 'metal',
      }),
    )
  }
}

function addBracers(group: THREE.Group, colors: Palette) {
  for (const side of [-1, 1]) {
    group.add(
      mesh(new THREE.CylinderGeometry(1.05, 0.9, 3, 8), {
        at: [side * 4.45, 9.8, 0.2],
        rotate: [0, 0, side * 0.06],
        color: colors.trim,
        finish: 'metal',
      }),
    )

    group.add(
      spike(0.28, 1.3, {
        at: [side * 5.3, 10.6, 0.2],
        rotate: [0, 0, side * 1.4],
        color: colors.trim,
        finish: 'metal',
      }),
    )
  }
}

function addGreaves(group: THREE.Group, colors: Palette) {
  for (const side of [-1, 1]) {
    group.add(
      mesh(new THREE.CylinderGeometry(1.3, 1.15, 3.4, 8), {
        at: [side * 1.45, 2.9, 0.1],
        color: colors.secondary,
        finish: 'metal',
      }),
    )

    group.add(
      panel(1.9, 1.6, 0.5, {
        at: [side * 1.45, 6.4, 1.1],
        color: colors.trim,
        finish: 'metal',
      }),
    )
  }
}

function addQuiver(group: THREE.Group, colors: Palette) {
  group.add(
    mesh(new THREE.CylinderGeometry(0.95, 0.75, 5, 8), {
      at: [-2.3, 12.4, -2.3],
      rotate: [0.24, 0, -0.42],
      color: colors.trim,
      finish: 'leather',
    }),
  )

  for (const offset of [-0.55, 0, 0.55]) {
    group.add(
      limb(0.08, 3, {
        at: [-2.3 + offset * 0.6, 16.1, -2.3 + offset * 0.4],
        rotate: [0.24, 0, -0.42],
        color: '#d8cbb0',
      }),
    )

    group.add(
      spike(0.32, 0.9, {
        at: [-2.3 + offset * 0.6, 17.7, -2.3 + offset * 0.4],
        rotate: [0.24, 0, -0.42],
        color: colors.trim,
        finish: 'cloth',
      }),
    )
  }
}

/** Lâminas cruzadas nas costas: silhueta que grita assassino de longe. */
function addBackBlades(group: THREE.Group, colors: Palette) {
  for (const side of [-1, 1]) {
    group.add(
      panel(0.7, 8.4, 0.24, {
        at: [side * 1.4, 13.6, -2.6],
        rotate: [0, 0, side * 0.55],
        color: colors.trim,
        finish: 'metal',
      }),
    )

    group.add(
      spike(0.45, 1.6, {
        at: [side * 3.6, 17.4, -2.6],
        rotate: [0, 0, side * 0.55],
        color: colors.trim,
        finish: 'metal',
      }),
    )
  }
}

/** Sombra colada ao chão + véu escuro: rastro de quem anda no escuro. */
function addShadow(group: THREE.Group, colors: Palette) {
  const pool = mesh(new THREE.CircleGeometry(5.4, 20), {
    at: [0, 0.05, 0],
    rotate: [-Math.PI / 2, 0, 0],
    color: '#05060a',
  })

  pool.material.transparent = true
  pool.material.opacity = 0.65
  group.add(pool)

  const veil = revolve(
    [
      [2.4, 7],
      [3.6, 3.4],
      [4.4, 0.3],
    ],
    { color: colors.cape, finish: 'cloth' },
    12,
  )

  veil.material.transparent = true
  veil.material.opacity = 0.45
  veil.material.side = THREE.DoubleSide
  group.add(veil)
}

/** Brasas subindo: pontos emissivos que a animação faz flutuar. */
function addEmbers(group: THREE.Group, colors: Palette) {
  const embers = new THREE.Group()

  embers.name = 'fx-embers'

  for (let index = 0; index < 14; index += 1) {
    const angle = (index / 14) * Math.PI * 2

    embers.add(
      mesh(new THREE.OctahedronGeometry(0.22 + (index % 3) * 0.06), {
        at: [Math.cos(angle) * (3.4 + (index % 4)), 1 + index * 1.4, Math.sin(angle) * 3.4],
        color: colors.trim,
        finish: 'glow',
      }),
    )
  }

  group.add(embers)

  return embers
}

function addRunes(group: THREE.Group, colors: Palette) {
  const runes = new THREE.Group()

  runes.name = 'fx-runes'

  for (const [index, angle] of [0, 1.6, 3.1, 4.7].entries()) {
    runes.add(
      mesh(new THREE.TorusGeometry(0.85, 0.1, 5, 6), {
        at: [Math.cos(angle) * 4.8, 8 + index * 2.6, Math.sin(angle) * 4.8],
        rotate: [Math.PI / 2, angle, 0],
        color: colors.trim,
        finish: 'glow',
      }),
    )
  }

  group.add(runes)

  return runes
}

/** Peças que cada set adiciona sobre o corpo base. */
function buildFeatures(features: string[], colors: Palette): THREE.Group {
  const group = new THREE.Group()
  const has = (name: string) => features.includes(name)

  if (has('plate') || has('plate_heavy')) addPlate(group, colors, has('plate_heavy'))
  if (has('harness')) addHarness(group, colors)
  if (has('coat')) addCoat(group, colors)
  if (has('robe')) addRobe(group, colors, has('robe_split'))
  if (has('skirt_plate')) addSkirtPlate(group, colors)
  if (has('tabard')) addTabard(group, colors)
  if (has('sash')) addSash(group, colors)
  if (has('belt')) addBelt(group, colors)

  if (has('pauldrons') || has('pauldrons_spiked') || has('pauldron_single')) {
    addPauldrons(group, colors, {
      spiked: has('pauldrons_spiked'),
      sides: has('pauldron_single') && !has('pauldrons') ? [-1] : [-1, 1],
    })
  }

  if (has('cape_long')) addCape(group, colors, 'long')
  else if (has('cape_tattered')) addCape(group, colors, 'tattered')
  else if (has('cape')) addCape(group, colors, 'short')

  if (has('helmet') || has('helmet_horned')) addHelmet(group, colors, has('helmet_horned'))
  if (has('hood')) addHood(group, colors)
  if (has('mask')) addMask(group, colors)
  if (has('crown') || has('circlet')) addCrown(group, colors, has('circlet') && !has('crown'))

  if (has('bracers')) addBracers(group, colors)
  if (has('greaves')) addGreaves(group, colors)
  if (has('quiver')) addQuiver(group, colors)
  if (has('back_blades')) addBackBlades(group, colors)
  if (has('shadow')) addShadow(group, colors)
  if (has('embers')) addEmbers(group, colors)
  if (has('runes')) addRunes(group, colors)

  return group
}

function buildAura(colors: Palette): THREE.Group {
  const aura = new THREE.Group()

  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(11, 1),
    new THREE.MeshStandardMaterial({
      color: colors.trim,
      emissive: new THREE.Color(colors.trim),
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.06,
      wireframe: true,
    }),
  )

  shell.position.y = 11
  shell.name = 'aura-shell'
  aura.add(shell)

  const light = new THREE.PointLight(new THREE.Color(colors.trim), 90, 46)

  light.position.set(0, 12, 6)
  aura.add(light)

  return aura
}

// ============================================================================
// ARMAS
// ============================================================================

/** Arma na mão direita; o token `shape_*` do catálogo escolhe a silhueta. */
function buildWeapon(features: string[], colors: Palette): THREE.Group {
  const hand = new THREE.Group()

  hand.position.set(HAND.x, HAND.y, HAND.z)

  const shape = features.find((name) => name.startsWith('shape_'))?.slice('shape_'.length) ?? 'sword'
  const steel: Finish = features.includes('glow') ? 'glow' : 'metal'

  const edge = (geometry: THREE.BufferGeometry, options: Omit<Placement, 'color'>) =>
    hand.add(mesh(geometry, { ...options, color: colors.blade, finish: steel }))

  const shaft = (radius: number, length: number, at: [number, number, number]) =>
    hand.add(limb(radius, length, { at, color: colors.grip, finish: 'leather' }))

  /** Lâmina reta com guarda em asas e pomo facetado. */
  const straightBlade = (length: number, width: number, guard: number) => {
    edge(bladeGeometry(length, width), { at: [0, 2.6, 0] })

    // Canal central: fio duplo em vez de chapa lisa.
    edge(new THREE.BoxGeometry(width * 0.22, length * 0.82, width * 0.42), {
      at: [0, 2.9 + length * 0.41, 0],
    })

    for (const side of [-1, 1]) {
      edge(new THREE.ConeGeometry(0.42, guard / 2, 4), {
        at: [(side * guard) / 4, 2.4, 0],
        rotate: [0, 0, (side * Math.PI) / 2],
      })
    }

    edge(new THREE.OctahedronGeometry(0.46), { at: [0, 2.4, 0] })
    edge(new THREE.OctahedronGeometry(0.42), { at: [0, 0.3, 0] })
    shaft(0.3, 1.7, [0, 1.3, 0])
  }

  if (shape === 'club') {
    shaft(0.34, 9, [0, 3.4, 0])
    edge(new THREE.CylinderGeometry(0.7, 0.55, 1.4, 8), { at: [0, 8.2, 0] })

    for (const side of [-1, 1]) {
      edge(new THREE.ConeGeometry(0.22, 0.9, 5), {
        at: [side * 0.7, 8.2, 0],
        rotate: [0, 0, side * 1.57],
      })
    }
  }

  if (shape === 'dagger') {
    edge(bladeGeometry(4.6, 0.9), { at: [0, 2.2, 0] })
    edge(new THREE.BoxGeometry(2, 0.34, 0.5), { at: [0, 2.2, 0] })
    shaft(0.26, 1.3, [0, 1.4, 0])
  }

  if (shape === 'twin_daggers') {
    for (const [index, offset] of [-0.9, 0.9].entries()) {
      const tilt = index === 0 ? -0.25 : 0.25

      edge(bladeGeometry(4.8, 0.8), {
        at: [offset, 2.2, index * 0.5 - 0.25],
        rotate: [0, 0, tilt],
      })
      edge(new THREE.BoxGeometry(1.5, 0.3, 0.45), { at: [offset, 2.1, index * 0.5 - 0.25] })
      shaft(0.24, 1.2, [offset, 1.4, index * 0.5 - 0.25])
    }
  }

  if (shape === 'katana') {
    // Curvatura: um arco fino de toro faz o dorso da lâmina.
    edge(new THREE.TorusGeometry(9, 0.24, 5, 22, Math.PI * 0.34), {
      at: [-7.4, 1.6, 0],
      rotate: [0, 0, 0.6],
    })
    edge(new THREE.BoxGeometry(1.8, 0.3, 0.5), { at: [0, 2.2, 0] })
    shaft(0.26, 2.4, [0, 1.1, 0])
  }

  if (shape === 'claws') {
    hand.add(
      mesh(new THREE.CylinderGeometry(1, 0.85, 2.6, 8), {
        at: [0, 1.4, 0],
        color: colors.grip,
        finish: 'leather',
      }),
    )

    for (const [index, offset] of [-0.8, 0, 0.8].entries()) {
      edge(new THREE.ConeGeometry(0.26, 4.6 - Math.abs(index - 1) * 0.9, 4), {
        at: [offset, 4.4, 0.9],
        rotate: [0.35, 0, offset * 0.18],
      })
    }
  }

  if (shape === 'sword') straightBlade(7.6, 0.85, 3.2)
  if (shape === 'greatsword') straightBlade(11.4, 1.5, 4.6)

  if (shape === 'axe' || shape === 'axe_double') {
    shaft(0.34, 8.6, [0, 3.6, 0])

    for (const side of shape === 'axe_double' ? [1, -1] : [1]) {
      const blade = mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.45, 12, 1, false, 0, Math.PI * 0.8), {
        at: [0, 7.8, side * 0.9],
        rotate: [Math.PI / 2, side > 0 ? 0 : Math.PI, Math.PI / 2],
        color: colors.blade,
        finish: steel,
      })

      hand.add(blade)
    }

    edge(new THREE.ConeGeometry(0.36, 1.5, 6), { at: [0, 9.1, 0] })
  }

  if (shape === 'hammer') {
    shaft(0.38, 8, [0, 3.4, 0])
    edge(new THREE.BoxGeometry(3.4, 2.6, 2.6), { at: [0, 8.2, 0] })
    edge(new THREE.ConeGeometry(0.34, 1.2, 6), { at: [0, 9.9, 0] })
  }

  if (shape === 'spear' || shape === 'polearm') {
    shaft(0.32, 13.4, [0, 5, 0])
    edge(new THREE.ConeGeometry(0.62, 4.2, 4), { at: [0, 13.6, 0] })

    if (shape === 'polearm') {
      edge(new THREE.TorusGeometry(1.2, 0.2, 6, 14, Math.PI), {
        at: [0, 11.4, 0.9],
        rotate: [Math.PI / 2, 0, 0],
      })
    } else {
      for (const side of [-1, 1]) {
        edge(new THREE.ConeGeometry(0.28, 1.6, 4), {
          at: [side * 0.7, 11.4, 0],
          rotate: [0, 0, side * 0.5],
        })
      }
    }
  }

  if (shape === 'staff' || shape === 'orb_staff') {
    shaft(0.32, 13, [0, 5, 0])

    if (shape === 'staff') {
      edge(new THREE.OctahedronGeometry(0.95), { at: [0, 12.3, 0] })

      for (const side of [-1, 1]) {
        hand.add(
          limb(0.2, 1.8, {
            at: [side * 0.7, 11.6, 0],
            rotate: [0, 0, side * 0.8],
            color: colors.grip,
            finish: 'leather',
          }),
        )
      }
    } else {
      // Garras de ferro segurando o orbe suspenso.
      for (let index = 0; index < 4; index += 1) {
        const angle = (index / 4) * Math.PI * 2

        edge(new THREE.TorusGeometry(1.1, 0.16, 5, 12, Math.PI * 0.7), {
          at: [Math.cos(angle) * 0.7, 12.4, Math.sin(angle) * 0.7],
          rotate: [Math.PI / 2, angle, 1.2],
        })
      }

      hand.add(
        mesh(new THREE.IcosahedronGeometry(1.15, 1), {
          at: [0, 13.2, 0],
          color: colors.blade,
          finish: 'glow',
        }),
      )
    }
  }

  if (shape === 'scythe') {
    shaft(0.32, 14, [0, 5.2, 0])

    const curve = mesh(new THREE.TorusGeometry(3.4, 0.28, 6, 20, Math.PI * 0.55), {
      at: [-1.2, 12.6, 0],
      rotate: [0, 0, -0.5],
      color: colors.blade,
      finish: steel,
    })

    hand.add(curve)
    edge(new THREE.ConeGeometry(0.4, 1.8, 4), { at: [-4.3, 14.2, 0], rotate: [0, 0, 1.1] })
    edge(new THREE.OctahedronGeometry(0.6), { at: [0, 12.4, 0] })
  }

  if (shape === 'bow' || shape === 'recurve_bow') {
    const arc = mesh(
      new THREE.TorusGeometry(4.6, 0.24, 6, 24, Math.PI * (shape === 'bow' ? 1.1 : 1.25)),
      {
        at: [0, 5.4, 0],
        rotate: [0, Math.PI / 2, Math.PI * (shape === 'bow' ? 0.45 : 0.38)],
        color: colors.blade,
        finish: steel,
      },
    )

    hand.add(arc)

    // Corda tensionada de ponta a ponta.
    hand.add(
      limb(0.07, 8.6, { at: [0, 5.4, 1.6], color: '#cfd6df' }),
    )

    if (shape === 'recurve_bow') {
      for (const side of [-1, 1]) {
        edge(new THREE.TorusGeometry(1, 0.2, 5, 12, Math.PI * 0.8), {
          at: [0, 5.4 + side * 4.4, -0.3],
          rotate: [0, Math.PI / 2, side * 1.9],
        })
      }
    }
  }

  if (shape === 'crossbow') {
    hand.add(
      panel(0.9, 6.4, 1, { at: [0, 4, 0], color: colors.grip, finish: 'leather' }),
    )

    edge(new THREE.TorusGeometry(3.6, 0.22, 6, 20, Math.PI * 0.7), {
      at: [0, 6.6, 0.6],
      rotate: [Math.PI / 2, 0, Math.PI * 0.65],
    })

    hand.add(limb(0.07, 6.4, { at: [0, 6.6, -0.9], color: '#cfd6df' }))
    edge(new THREE.BoxGeometry(0.5, 4.4, 0.4), { at: [0, 6.4, 0.1] })
    edge(new THREE.ConeGeometry(0.3, 1.2, 4), { at: [0, 9, 0.1] })
  }

  applyWeaponPose(hand, shape)

  return hand
}

/**
 * Toda arma é modelada crescendo em +Y a partir da mão; sem girar o grupo ela
 * fica apontada para o céu. Aqui cada família recebe a pose de porte: lâmina
 * caída à frente, haste plantada de leve e projétil apontado para frente.
 */
function applyWeaponPose(hand: THREE.Group, shape: string) {
  // Lâmina/impacto: ponta para frente e para baixo, como quem carrega a arma.
  const blade: [number, number, number] = [2.25, 0, -0.16]

  // Haste longa: quase em pé, inclinada para frente para não virar poste.
  const polearm: [number, number, number] = [-0.16, 0, -0.1]

  const aimed: [number, number, number] = [-1.35, 0, 0]

  const poses: Record<string, [number, number, number]> = {
    sword: blade,
    greatsword: [2.15, 0, -0.14],
    dagger: [2.35, 0, -0.2],
    twin_daggers: [2.35, 0, -0.2],
    katana: [2.2, 0, -0.16],
    claws: [1.5, 0, -0.1],
    axe: [2.35, 0, -0.12],
    axe_double: [2.35, 0, -0.12],
    hammer: [2.4, 0, -0.12],
    club: [2.4, 0, -0.12],
    spear: polearm,
    polearm,
    staff: polearm,
    orb_staff: polearm,
    scythe: polearm,
    bow: [0, 0, -0.12],
    recurve_bow: [0, 0, -0.12],
    crossbow: aimed,
  }

  hand.rotation.set(...(poses[shape] ?? blade))
}

export function hasAura(catalog: Catalog, equipped: AvatarEquipped): boolean {
  return piece(catalog, 'outfit', equipped.outfit)?.features.includes('aura') ?? false
}

/** Monta o boneco completo, com o centro do corpo na origem. */
export function buildFigure(catalog: Catalog, equipped: AvatarEquipped): THREE.Group {
  const colors = palette(catalog, equipped)
  const outfit = piece(catalog, 'outfit', equipped.outfit)
  const weapon = piece(catalog, 'weapon', equipped.weapon)

  const features = outfit?.features ?? []

  const figure = new THREE.Group()

  // Plataforma de invocação sob os pés.
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(5.8, 0.18, 6, 40),
    new THREE.MeshStandardMaterial({
      color: colors.accent,
      emissive: new THREE.Color(colors.accent),
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.65,
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
      features.includes('helmet') ||
        features.includes('helmet_horned') ||
        features.includes('hood'),
    ),
  )
  figure.add(buildFeatures(features, colors))

  if (equipped.weapon !== 'nenhuma') {
    figure.add(buildWeapon(weapon?.features ?? [], colors))
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

/** Luzes da cena: chave quente lateral, contraluz fria e pouca luz de base. */
export function addLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0x6f83a6, 0x05060a, 0.5))

  const key = new THREE.DirectionalLight(0xffd0a0, 2.4)

  key.position.set(14, 22, 16)
  scene.add(key)

  // Dois contraluzes desenham a silhueta da armadura contra o fundo escuro.
  const rim = new THREE.DirectionalLight(0x6d8cff, 2.2)

  rim.position.set(-16, 14, -12)
  scene.add(rim)

  const rimWarm = new THREE.DirectionalLight(0xff7a3c, 1.1)

  rimWarm.position.set(12, 6, -14)
  scene.add(rimWarm)

  const fill = new THREE.DirectionalLight(0x9fb6ff, 0.3)

  fill.position.set(0, -8, 14)
  scene.add(fill)
}
