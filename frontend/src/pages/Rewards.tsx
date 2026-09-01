import { useEffect, useState } from 'react'
import { useAuth } from 'auth-lite-react'

import { apiFetch } from '../api'
import type { Punishment, Reward } from '../types'

export default function Rewards() {
  const { token } = useAuth()

  const [rewards, setRewards] = useState<Reward[]>([])
  const [punishments, setPunishments] = useState<Punishment[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return

    Promise.all([
      apiFetch<Reward[]>('/rewards/', token),
      apiFetch<Punishment[]>('/punishments/', token),
    ])
      .then(([rewardsData, punishmentsData]) => {
        setRewards(rewardsData)
        setPunishments(punishmentsData)
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Erro ao carregar recompensas'),
      )
  }, [token])

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
            </li>
          ))}
        </ul>
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
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
