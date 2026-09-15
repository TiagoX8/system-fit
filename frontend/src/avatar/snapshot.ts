import * as THREE from 'three'

import type { AvatarEquipped } from '../types'
import { FIGURE_HEIGHT, addLights, buildFigure, disposeFigure, type Catalog } from './model3d'

/**
 * Miniaturas do catálogo: em vez de uma cena WebGL por opção (dezenas de
 * contextos), renderiza cada combinação uma vez num renderer escondido e guarda
 * o resultado como PNG em data URL.
 */
export function renderThumbnails(
  catalog: Catalog,
  combos: AvatarEquipped[],
  size = 128,
): string[] | null {
  let renderer: THREE.WebGLRenderer

  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true })
  } catch {
    return null
  }

  renderer.setPixelRatio(2)
  renderer.setSize(size, size, false)

  const scene = new THREE.Scene()

  addLights(scene)

  const camera = new THREE.PerspectiveCamera(30, 1, 1, 200)

  camera.position.set(7, 3, FIGURE_HEIGHT * 2.35)
  camera.lookAt(0, 0.5, 0)

  const images: string[] = []

  for (const equipped of combos) {
    const figure = buildFigure(catalog, equipped)

    scene.add(figure)
    renderer.render(scene, camera)
    images.push(renderer.domElement.toDataURL('image/png'))

    scene.remove(figure)
    disposeFigure(figure)
  }

  renderer.dispose()

  return images
}
