import { useCallback, useEffect, useState } from 'react'
import { useAuth } from 'auth-lite-react'

import { apiFetch } from '../api'
import { DAY_LABELS, type Workout, type WorkoutInput } from '../types'

const EMPTY_FORM: WorkoutInput = {
  title: '',
  description: '',
  scheduled_time: '07:00',
  days_of_week: [0, 1, 2, 3, 4],
}

export default function Workouts() {
  const { token } = useAuth()

  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [form, setForm] = useState<WorkoutInput>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!token) return

    try {
      setWorkouts(await apiFetch<Workout[]>('/workouts/', token))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar treinos')
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  function toggleDay(day: number) {
    setForm((current) => ({
      ...current,
      days_of_week: current.days_of_week.includes(day)
        ? current.days_of_week.filter((value) => value !== day)
        : [...current.days_of_week, day].sort(),
    }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (!token) return

    setError('')

    const body = JSON.stringify({
      ...form,
      scheduled_time: `${form.scheduled_time}:00`.slice(0, 8),
    })

    try {
      if (editingId) {
        await apiFetch(`/workouts/${editingId}`, token, { method: 'PUT', body })
      } else {
        await apiFetch('/workouts/', token, { method: 'POST', body })
      }

      setForm(EMPTY_FORM)
      setEditingId(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar treino')
    }
  }

  function startEdit(workout: Workout) {
    setEditingId(workout.id)
    setForm({
      title: workout.title,
      description: workout.description ?? '',
      scheduled_time: workout.scheduled_time.slice(0, 5),
      days_of_week: workout.days_of_week,
    })
  }

  async function remove(workout: Workout) {
    if (!token) return

    try {
      await apiFetch(`/workouts/${workout.id}`, token, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover treino')
    }
  }

  return (
    <div className="stack">
      {error && <p className="alert alert--danger">{error}</p>}

      <section className="system-panel">
        <p className="panel-tag">{editingId ? 'Editar missão' : 'Nova missão'}</p>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field">
            <span>Exercício (peso do corpo)</span>
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Flexões, agachamento, prancha..."
              required
            />
          </label>

          <label className="field">
            <span>Horário do lembrete</span>
            <input
              type="time"
              value={form.scheduled_time}
              onChange={(event) => setForm({ ...form, scheduled_time: event.target.value })}
              required
            />
          </label>

          <label className="field field--wide">
            <span>Descrição</span>
            <input
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="4 séries de 15 repetições"
            />
          </label>

          <div className="field field--wide">
            <span>Dias da semana</span>
            <div className="day-picker">
              {DAY_LABELS.map((label, day) => (
                <button
                  key={label}
                  type="button"
                  className={form.days_of_week.includes(day) ? 'day day--on' : 'day'}
                  onClick={() => toggleDay(day)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="system-button">
              {editingId ? 'Salvar alterações' : 'Registrar missão'}
            </button>

            {editingId && (
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setEditingId(null)
                  setForm(EMPTY_FORM)
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="system-panel">
        <p className="panel-tag">Missões cadastradas</p>

        <ul className="quest-list">
          {workouts.map((workout) => (
            <li key={workout.id} className="quest">
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

              <div className="quest-actions">
                <button type="button" className="ghost-button" onClick={() => startEdit(workout)}>
                  Editar
                </button>
                <button
                  type="button"
                  className="ghost-button ghost-button--danger"
                  onClick={() => void remove(workout)}
                >
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
