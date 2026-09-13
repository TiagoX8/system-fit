import { useEffect, useRef } from 'react'

import type { AvatarEquipped, AvatarPiece, AvatarSlot } from '../types'
import { drawAvatar, hasAura } from './render'

interface Props {
  catalog: Record<AvatarSlot, AvatarPiece[]>
  equipped: AvatarEquipped
  scale?: number
}

export default function PixelAvatar({ catalog, equipped, scale = 6 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current) {
      drawAvatar(canvasRef.current, catalog, equipped, scale)
    }
  }, [catalog, equipped, scale])

  return (
    <canvas
      ref={canvasRef}
      className={hasAura(catalog, equipped) ? 'pixel-avatar pixel-avatar--aura' : 'pixel-avatar'}
      role="img"
      aria-label="Avatar do Caçador"
    />
  )
}
