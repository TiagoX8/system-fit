import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

import type { AvatarEquipped } from '../types'
import {
  FIGURE_HEIGHT,
  addLights,
  buildFigure,
  disposeFigure,
  hasAura,
  type Catalog,
} from './model3d'

interface Props {
  catalog: Catalog
  equipped: AvatarEquipped
  size?: number
  /** Permite girar o boneco arrastando o mouse/dedo. */
  interactive?: boolean
}

export default function Avatar3D({ catalog, equipped, size = 260, interactive = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const figureRef = useRef<THREE.Group | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const spinRef = useRef(0.5)
  const draggingRef = useRef(false)

  const [failed, setFailed] = useState(false)

  // Cena, câmera e loop de animação: montados uma vez por tamanho.
  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) return

    let renderer: THREE.WebGLRenderer

    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    } catch {
      setFailed(true)

      return
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(size, size * 1.15, false)

    const scene = new THREE.Scene()

    sceneRef.current = scene
    addLights(scene)

    const camera = new THREE.PerspectiveCamera(30, 1 / 1.15, 1, 200)

    camera.position.set(0, 2, FIGURE_HEIGHT * 2.75)
    camera.lookAt(0, 0, 0)

    const pivot = new THREE.Group()

    scene.add(pivot)

    let frame = 0
    const clock = new THREE.Clock()

    function loop() {
      const time = clock.getElapsedTime()

      if (!draggingRef.current) {
        spinRef.current += 0.004
      }

      pivot.rotation.y = spinRef.current
      pivot.position.y = Math.sin(time * 1.6) * 0.35

      const shell = pivot.getObjectByName('aura-shell')

      if (shell) {
        shell.rotation.y = time * 0.5
        shell.rotation.x = time * 0.2
      }

      renderer.render(scene, camera)
      frame = requestAnimationFrame(loop)
    }

    loop()

    // O boneco entra dentro do pivot, que é quem gira.
    sceneRef.current.userData.pivot = pivot

    return () => {
      cancelAnimationFrame(frame)

      if (figureRef.current) {
        disposeFigure(figureRef.current)
        figureRef.current = null
      }

      renderer.dispose()
      sceneRef.current = null
    }
  }, [size])

  // Troca o boneco quando o equipamento muda, mantendo a rotação atual.
  useEffect(() => {
    const scene = sceneRef.current
    const pivot = scene?.userData.pivot as THREE.Group | undefined

    if (!pivot) return

    if (figureRef.current) {
      pivot.remove(figureRef.current)
      disposeFigure(figureRef.current)
    }

    const figure = buildFigure(catalog, equipped)

    figureRef.current = figure
    pivot.add(figure)
  }, [catalog, equipped])

  function startDrag(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!interactive) return

    draggingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function drag(event: React.PointerEvent<HTMLCanvasElement>) {
    if (draggingRef.current) {
      spinRef.current += event.movementX * 0.01
    }
  }

  function endDrag() {
    draggingRef.current = false
  }

  if (failed) {
    return <p className="muted">Seu navegador não suporta o avatar 3D (WebGL desativado).</p>
  }

  return (
    <canvas
      ref={canvasRef}
      className={hasAura(catalog, equipped) ? 'avatar-3d avatar-3d--aura' : 'avatar-3d'}
      style={{ width: size, touchAction: 'pan-y' }}
      role="img"
      aria-label="Avatar 3D do Caçador"
      onPointerDown={startDrag}
      onPointerMove={drag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    />
  )
}
