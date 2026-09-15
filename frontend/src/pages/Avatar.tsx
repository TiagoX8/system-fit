import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from 'auth-lite-react'

import { apiFetch } from '../api'
import Avatar3D from '../avatar/Avatar3D'
import { renderThumbnails } from '../avatar/snapshot'
import {
  AVATAR_SLOTS,
  AVATAR_SLOT_LABELS,
  type AvatarEquipped,
  type AvatarPiece,
  type AvatarSlot,
  type AvatarState,
} from '../types'

export default function AvatarPage() {
  const { token } = useAuth()

  const [state, setState] = useState<AvatarState | null>(null)
  const [draft, setDraft] = useState<AvatarEquipped | null>(null)
  const [slot, setSlot] = useState<AvatarSlot>('outfit')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!token) return

    try {
      const data = await apiFetch<AvatarState>('/avatar/', token)

      setState(data)
      setDraft(data.equipped)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar o avatar')
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  function choose(piece: AvatarPiece) {
    if (!draft || !piece.unlocked) return

    setDraft({ ...draft, [slot]: piece.id })
    setSaved(false)
  }

  async function save() {
    if (!token || !draft) return

    setError('')
    setSaving(true)

    try {
      const data = await apiFetch<AvatarState>('/avatar/', token, {
        method: 'PUT',
        body: JSON.stringify(draft),
      })

      setState(data)
      setDraft(data.equipped)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao equipar')
    } finally {
      setSaving(false)
    }
  }

  // Uma imagem por opção do slot atual, renderizada num único contexto WebGL.
  const thumbnails = useMemo(() => {
    if (!state || !draft) return null

    const combos = state.catalog[slot].map((piece) => ({ ...draft, [slot]: piece.id }))

    return renderThumbnails(state.catalog, combos)
  }, [state, draft, slot])

  if (!state || !draft) {
    return (
      <div className="stack">
        {error ? <p className="alert alert--danger">{error}</p> : <p>Invocando o avatar...</p>}
      </div>
    )
  }

  const dirty = AVATAR_SLOTS.some((key) => draft[key] !== state.equipped[key])
  const pieces = state.catalog[slot]

  return (
    <div className="stack">
      {error && <p className="alert alert--danger">{error}</p>}

      <section className="system-panel avatar-panel">
        <div className="avatar-stage">
          <Avatar3D catalog={state.catalog} equipped={draft} size={280} />

          <p className="panel-tag panel-tag--inline">Rank {state.rank}</p>
          <p className="card-meta">
            Arraste o boneco para girar. Sets e armas de rank acima do seu ficam bloqueados até
            você subir.
          </p>

          <div className="form-actions">
            <button
              type="button"
              className="system-button"
              onClick={() => void save()}
              disabled={!dirty || saving}
            >
              {saving ? 'Equipando...' : 'Equipar'}
            </button>

            {dirty && (
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setDraft(state.equipped)
                  setSaved(false)
                }}
              >
                Desfazer
              </button>
            )}
          </div>

          {saved && !dirty && <p className="card-meta">Avatar atualizado.</p>}
        </div>

        <div className="avatar-picker">
          <div className="avatar-tabs">
            {AVATAR_SLOTS.map((key) => (
              <button
                key={key}
                type="button"
                className={key === slot ? 'nav-link nav-link--active' : 'nav-link'}
                onClick={() => setSlot(key)}
              >
                {AVATAR_SLOT_LABELS[key]}
              </button>
            ))}
          </div>

          <ul className="avatar-options">
            {pieces.map((piece, index) => {
              const active = draft[slot] === piece.id

              const classes = ['avatar-option']

              if (active) classes.push('avatar-option--active')
              if (!piece.unlocked) classes.push('avatar-option--locked')

              return (
                <li key={piece.id}>
                  <button
                    type="button"
                    className={classes.join(' ')}
                    onClick={() => choose(piece)}
                    disabled={!piece.unlocked}
                    title={piece.unlocked ? piece.description : `Requer rank ${piece.rank}`}
                  >
                    {thumbnails && (
                      <img className="avatar-thumb" src={thumbnails[index]} alt="" />
                    )}

                    <span className="avatar-option-name">{piece.name}</span>
                    <span className="avatar-option-meta">
                      {piece.unlocked ? `Rank ${piece.rank}` : `🔒 Rank ${piece.rank}`}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </section>
    </div>
  )
}
