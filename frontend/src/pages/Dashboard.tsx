import { useCallback, useEffect, useState } from 'react'
import { useAuth } from 'auth-lite-react'

import { apiFetch } from '../api'
import { enablePushNotifications } from '../push'
import { DAY_LABELS, type CompleteWorkoutResult, type Progress, type Workout } from '../types'

const RANKS = ['E', 'D', 'C', 'B', 'A', 'S', 'Monarca das Sombras']

function todayIndex(): number {
  return (new Date().getDay() + 6) % 7
}

export default function Dashboard() {
  const { token } = useAuth()

  const [progress, setProgress] = useState<Progress | null>(null)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!token) return

    try {
      const [progressData, workoutsData] = await Promise.all([
        apiFetch<Progress>('/progress/', token),
        apiFetch<Workout[]>('/workouts/', token),
      ])

      setProgress(progressData)
      setWorkouts(workoutsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar o Sistema')
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!token) return

    enablePushNotifications(token)
      .then((result) => setMessage(result))
      .catch((err: unknown) =>
        setMessage(err instanceof Error ? err.message : 'Falha ao ativar notificações'),
      )
  }, [token])

  async function complete(workout: Workout) {
    if (!token) return

    setBusyId(workout.id)
    setError('')

    try {
      const result = await apiFetch<CompleteWorkoutResult>(
        `/workouts/${workout.id}/complete`,
        token,
        { method: 'POST' },
      )

      setProgress(result.progress)
      setMessage(
        result.unlocked_rewards.length > 0
          ? `${result.message} Recompensa liberada: ${result.unlocked_rewards
              .map((reward) => reward.title)
              .join(', ')}.`
          : result.message,
      )

      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao concluir treino')
    } finally {
      setBusyId(null)
    }
  }

  const today = todayIndex()
  const todaysWorkouts = workouts.filter(
    (workout) => workout.days_of_week.length === 0 || workout.days_of_week.includes(today),
  )

  return (
    <div className="stack">
      {error && <p className="alert alert--danger">{error}</p>}
      {message && <p className="alert alert--info">{message}</p>}

      <section className="system-panel">
        <p className="panel-tag">Janela de Status</p>

        <div className="status-grid">
          <div className="status-rank">
            <span className="status-label">Rank</span>
            <strong className="rank-value">{progress?.rank ?? '—'}</strong>
            <div className="rank-track">
              {RANKS.map((rank) => (
                <span
                  key={rank}
                  className={
                    progress && RANKS.indexOf(progress.rank) >= RANKS.indexOf(rank)
                      ? 'rank-pip rank-pip--on'
                      : 'rank-pip'
                  }
                  title={rank}
                />
              ))}
            </div>
          </div>

          <div className="status-metric">
            <span className="status-label">XP</span>
            <strong>{progress?.xp ?? 0}</strong>
            {progress?.next_rank && (
              <small>
                Faltam {progress.xp_to_next_rank} XP para {progress.next_rank}
              </small>
            )}
          </div>

          <div className="status-metric">
            <span className="status-label">Sequência</span>
            <strong>{progress?.current_streak ?? 0} dias</strong>
            <small>Recorde: {progress?.longest_streak ?? 0} dias</small>
          </div>

          <div className="status-metric">
            <span className="status-label">Semanas completas</span>
            <strong>{progress?.weeks_completed ?? 0}</strong>
            <small>{progress?.rewards.filter((reward) => reward.unlocked).length ?? 0} recompensas</small>
          </div>
        </div>
      </section>

      <section className="system-panel">
        <p className="panel-tag">Missão diária</p>

        {todaysWorkouts.length === 0 && (
          <p className="muted">Nenhuma missão para hoje. Cadastre treinos em "Missões".</p>
        )}

        <ul className="quest-list">
          {todaysWorkouts.map((workout) => (
            <li key={workout.id} className={workout.completed_today ? 'quest quest--done' : 'quest'}>
              <div>
                <p className="quest-title">{workout.title}</p>
                <p className="quest-desc">{workout.description}</p>
                <p className="quest-meta">
                  {workout.scheduled_time.slice(0, 5)} ·{' '}
                  {workout.days_of_week.length === 0
                    ? 'todos os dias'
                    : workout.days_of_week.map((day) => DAY_LABELS[day]).join(' ')}
                </p>
              </div>

              <button
                type="button"
                className="system-button"
                disabled={workout.completed_today || busyId === workout.id}
                onClick={() => void complete(workout)}
              >
                {workout.completed_today ? 'Concluído' : 'Concluir treino'}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
