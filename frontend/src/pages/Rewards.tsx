import { useCallback, useEffect, useState } from 'react'
import { useAuth } from 'auth-lite-react'

import { apiFetch } from '../api'
import type { Punishment, PunishmentInput, Reward, RewardInput } from '../types'

const EMPTY_REWARD: RewardInput = { title: '', description: '', threshold_weeks: 1 }
const EMPTY_PUNISHMENT: PunishmentInput = { title: '', description: '', threshold_streak: 1 }

export default function Rewards() {
  const { token } = useAuth()

  const [rewards, setRewards] = useState<Reward[]>([])
  const [punishments, setPunishments] = useState<Punishment[]>([])
  const [error, setError] = useState('')

  const [rewardForm, setRewardForm] = useState<RewardInput>(EMPTY_REWARD)
  const [editingReward, setEditingReward] = useState<number | null>(null)

  const [punishmentForm, setPunishmentForm] = useState<PunishmentInput>(EMPTY_PUNISHMENT)
  const [editingPunishment, setEditingPunishment] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!token) return

    try {
      const [rewardsData, punishmentsData] = await Promise.all([
        apiFetch<Reward[]>('/rewards/', token),
        apiFetch<Punishment[]>('/punishments/', token),
      ])

      setRewards(rewardsData)
      setPunishments(punishmentsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar recompensas')
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  async function saveReward(event: React.FormEvent) {
    event.preventDefault()

    if (!token) return

    setError('')

    const body = JSON.stringify({
      ...rewardForm,
      description: rewardForm.description || null,
    })

    try {
      if (editingReward) {
        await apiFetch(`/rewards/${editingReward}`, token, { method: 'PUT', body })
      } else {
        await apiFetch('/rewards/', token, { method: 'POST', body })
      }

      setRewardForm(EMPTY_REWARD)
      setEditingReward(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar recompensa')
    }
  }

  async function removeReward(reward: Reward) {
    if (!token) return

    try {
      await apiFetch(`/rewards/${reward.id}`, token, { method: 'DELETE' })

      if (editingReward === reward.id) {
        setEditingReward(null)
        setRewardForm(EMPTY_REWARD)
      }

      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover recompensa')
    }
  }

  async function savePunishment(event: React.FormEvent) {
    event.preventDefault()

    if (!token) return

    setError('')

    const body = JSON.stringify({
      ...punishmentForm,
      description: punishmentForm.description || null,
    })

    try {
      if (editingPunishment) {
        await apiFetch(`/punishments/${editingPunishment}`, token, { method: 'PUT', body })
      } else {
        await apiFetch('/punishments/', token, { method: 'POST', body })
      }

      setPunishmentForm(EMPTY_PUNISHMENT)
      setEditingPunishment(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar penalidade')
    }
  }

  async function removePunishment(punishment: Punishment) {
    if (!token) return

    try {
      await apiFetch(`/punishments/${punishment.id}`, token, { method: 'DELETE' })

      if (editingPunishment === punishment.id) {
        setEditingPunishment(null)
        setPunishmentForm(EMPTY_PUNISHMENT)
      }

      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover penalidade')
    }
  }

  return (
    <div className="stack">
      {error && <p className="alert alert--danger">{error}</p>}

      <section className="system-panel">
        <p className="panel-tag">Recompensas</p>

        <ul className="card-list">
          {rewards.map((reward) => (
            <li key={reward.id} className={reward.unlocked ? 'card card--unlocked' : 'card'}>
              <p className="card-title">{reward.title}</p>
              <p className="card-desc">{reward.description}</p>
              <p className="card-meta">
                {reward.unlocked
                  ? 'Desbloqueada'
                  : `Requer ${reward.threshold_weeks} semana(s) consecutiva(s)`}
              </p>

              <div className="quest-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setEditingReward(reward.id)
                    setRewardForm({
                      title: reward.title,
                      description: reward.description ?? '',
                      threshold_weeks: reward.threshold_weeks,
                    })
                  }}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="ghost-button ghost-button--danger"
                  onClick={() => void removeReward(reward)}
                >
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>

        <p className="panel-tag panel-tag--inline">
          {editingReward ? 'Editar recompensa' : 'Nova recompensa'}
        </p>

        <form className="form-grid" onSubmit={saveReward}>
          <label className="field">
            <span>Recompensa</span>
            <input
              value={rewardForm.title}
              onChange={(event) => setRewardForm({ ...rewardForm, title: event.target.value })}
              placeholder="1 refeição livre no fim de semana"
              maxLength={120}
              required
            />
          </label>

          <label className="field">
            <span>Semanas consecutivas</span>
            <input
              type="number"
              min={1}
              max={104}
              value={rewardForm.threshold_weeks}
              onChange={(event) =>
                setRewardForm({ ...rewardForm, threshold_weeks: Number(event.target.value) })
              }
              required
            />
          </label>

          <label className="field field--wide">
            <span>Detalhes</span>
            <input
              value={rewardForm.description}
              onChange={(event) =>
                setRewardForm({ ...rewardForm, description: event.target.value })
              }
              placeholder="Escolha um prato ou sobremesa sem culpa"
              maxLength={500}
            />
          </label>

          <div className="form-actions">
            <button type="submit" className="system-button">
              {editingReward ? 'Salvar alterações' : 'Adicionar recompensa'}
            </button>

            {editingReward && (
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setEditingReward(null)
                  setRewardForm(EMPTY_REWARD)
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="system-panel system-panel--danger">
        <p className="panel-tag">Penalidades da Sistema</p>

        <ul className="card-list">
          {punishments.map((punishment) => (
            <li
              key={punishment.id}
              className={punishment.unlocked ? 'card card--punished' : 'card'}
            >
              <p className="card-title">{punishment.title}</p>
              <p className="card-desc">{punishment.description}</p>
              <p className="card-meta">
                {punishment.unlocked
                  ? 'Aplicada'
                  : `Dispara após ${punishment.threshold_streak} dia(s) de falha`}
              </p>

              <div className="quest-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setEditingPunishment(punishment.id)
                    setPunishmentForm({
                      title: punishment.title,
                      description: punishment.description ?? '',
                      threshold_streak: punishment.threshold_streak,
                    })
                  }}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="ghost-button ghost-button--danger"
                  onClick={() => void removePunishment(punishment)}
                >
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>

        <p className="panel-tag panel-tag--inline">
          {editingPunishment ? 'Editar penalidade' : 'Nova penalidade'}
        </p>

        <form className="form-grid" onSubmit={savePunishment}>
          <label className="field">
            <span>Penalidade</span>
            <input
              value={punishmentForm.title}
              onChange={(event) =>
                setPunishmentForm({ ...punishmentForm, title: event.target.value })
              }
              placeholder="Nada de doces por 7 dias"
              maxLength={120}
              required
            />
          </label>

          <label className="field">
            <span>Dias de falha</span>
            <input
              type="number"
              min={1}
              max={60}
              value={punishmentForm.threshold_streak}
              onChange={(event) =>
                setPunishmentForm({
                  ...punishmentForm,
                  threshold_streak: Number(event.target.value),
                })
              }
              required
            />
          </label>

          <label className="field field--wide">
            <span>Detalhes</span>
            <input
              value={punishmentForm.description}
              onChange={(event) =>
                setPunishmentForm({ ...punishmentForm, description: event.target.value })
              }
              placeholder="Sem chocolate, sobremesa ou refrigerante"
              maxLength={500}
            />
          </label>

          <div className="form-actions">
            <button type="submit" className="system-button">
              {editingPunishment ? 'Salvar alterações' : 'Adicionar penalidade'}
            </button>

            {editingPunishment && (
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setEditingPunishment(null)
                  setPunishmentForm(EMPTY_PUNISHMENT)
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  )
}
