import { useEffect, useMemo, useState } from 'react'
import { useAuth } from 'auth-lite-react'

import { apiFetch } from '../api'
import type { Workout, WorkoutLog } from '../types'

const DAYS_SHOWN = 70
const SESSIONS_SHOWN = 14

const DAY_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
})

function formatDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number)

  return DAY_FORMAT.format(new Date(year, month - 1, day)).replace('.,', ',')
}

function isoDay(day: Date): string {
  const month = `${day.getMonth() + 1}`.padStart(2, '0')
  const dayOfMonth = `${day.getDate()}`.padStart(2, '0')

  return `${day.getFullYear()}-${month}-${dayOfMonth}`
}

function lastDays(count: number): Date[] {
  const days: Date[] = []
  const today = new Date()

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const day = new Date(today)
    day.setDate(today.getDate() - offset)
    days.push(day)
  }

  return days
}

/** 0 = segunda, como no backend (`Workout.days_of_week`). */
function systemWeekday(day: Date): number {
  return (day.getDay() + 6) % 7
}

export default function History() {
  const { token } = useAuth()

  const [logs, setLogs] = useState<WorkoutLog[]>([])
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return

    Promise.all([
      apiFetch<WorkoutLog[]>('/logs/', token),
      apiFetch<Workout[]>('/workouts/', token),
    ])
      .then(([logList, workoutList]) => {
        setLogs(logList)
        setWorkouts(workoutList)
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Erro ao carregar histórico'),
      )
  }, [token])

  const countsByDate = useMemo(() => {
    const counts = new Map<string, number>()

    for (const log of logs) {
      if (log.completed) {
        counts.set(log.date, (counts.get(log.date) ?? 0) + 1)
      }
    }

    return counts
  }, [logs])

  const sessions = useMemo(() => {
    const titleById = new Map(workouts.map((workout) => [workout.id, workout.title]))
    const byDate = new Map<string, string[]>()

    for (const log of logs) {
      if (!log.completed) continue

      const titles = byDate.get(log.date) ?? []
      titles.push(titleById.get(log.workout_id) ?? 'Treino removido')
      byDate.set(log.date, titles)
    }

    return [...byDate.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .slice(0, SESSIONS_SHOWN)
      .map(([date, titles]) => ({ date, titles }))
  }, [logs, workouts])

  const days = useMemo(() => lastDays(DAYS_SHOWN), [])
  const today = isoDay(new Date())

  const cells = useMemo(() => {
    // Antes do primeiro treino cadastrado não havia rotina para cumprir.
    const startedAt = workouts.reduce<string | null>((earliest, workout) => {
      const created = workout.created_at.slice(0, 10)

      return earliest === null || created < earliest ? created : earliest
    }, null)

    return days.map((day) => {
      const date = isoDay(day)
      const count = countsByDate.get(date) ?? 0
      const weekday = systemWeekday(day)
      const scheduled = workouts.some(
        (workout) =>
          (workout.days_of_week.length === 0 || workout.days_of_week.includes(weekday)) &&
          workout.created_at.slice(0, 10) <= date,
      )

      let status: 'today' | 'done' | 'failed' | 'idle'
      let label: string

      if (date === today) {
        status = 'today'
        label = count > 0 ? `hoje: ${count} treino(s)` : 'hoje: em andamento'
      } else if (count > 0) {
        status = 'done'
        label = `${count} treino(s)`
      } else if (scheduled && startedAt !== null && date >= startedAt) {
        status = 'failed'
        label = 'falhou'
      } else {
        status = 'idle'
        label = 'sem treino previsto'
      }

      return { date, status, label }
    })
  }, [countsByDate, days, today, workouts])

  return (
    <div className="stack">
      {error && <p className="alert alert--danger">{error}</p>}

      <section className="system-panel">
        <p className="panel-tag">Registro de caçadas</p>

        <div className="calendar">
          {cells.map((cell) => (
            <span
              key={cell.date}
              className={`calendar-cell calendar-cell--${cell.status}`}
              title={`${cell.date}: ${cell.label}`}
            />
          ))}
        </div>

        <ul className="calendar-legend">
          <li>
            <span className="calendar-cell calendar-cell--done" /> Concluído
          </li>
          <li>
            <span className="calendar-cell calendar-cell--failed" /> Falhou
          </li>
          <li>
            <span className="calendar-cell calendar-cell--today" /> Hoje
          </li>
        </ul>

        {sessions.length === 0 ? (
          <p className="muted">Nenhuma caçada registrada ainda.</p>
        ) : (
          <ul className="log-list">
            {sessions.map((session) => (
              <li key={session.date}>
                <span className="log-day">{formatDay(session.date)}</span>
                <span className="log-titles" title={session.titles.join(', ')}>
                  {session.titles.join(' · ')}
                </span>
                <span className="log-count">
                  {session.titles.length} treino{session.titles.length > 1 ? 's' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
