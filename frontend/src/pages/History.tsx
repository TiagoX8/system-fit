import { useEffect, useMemo, useState } from 'react'
import { useAuth } from 'auth-lite-react'

import { apiFetch } from '../api'
import type { Workout, WorkoutLog } from '../types'

const DAYS_SHOWN = 70

const SHORT_DATE = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })

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

function formatShort(day: Date): string {
  return SHORT_DATE.format(day)
}

type DayStatus = 'today' | 'done' | 'failed' | 'idle'

interface DayCell {
  date: string
  day: Date
  status: DayStatus
  label: string
}

interface WeekSummary {
  key: string
  range: string
  done: number
  failed: number
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

  const days = useMemo(() => lastDays(DAYS_SHOWN), [])
  const today = isoDay(new Date())

  const cells = useMemo<DayCell[]>(() => {
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

      let status: DayStatus
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

      return { date, day, status, label }
    })
  }, [countsByDate, days, today, workouts])

  const weeks = useMemo<WeekSummary[]>(() => {
    const groups = new Map<string, DayCell[]>()

    for (const cell of cells) {
      const monday = new Date(cell.day)
      monday.setDate(cell.day.getDate() - systemWeekday(cell.day))
      const key = isoDay(monday)

      const group = groups.get(key) ?? []
      group.push(cell)
      groups.set(key, group)
    }

    return [...groups.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([key, group]) => {
        const done = group.filter(
          (cell) => cell.status === 'done' || (cell.status === 'today' && countsByDate.has(cell.date)),
        ).length

        return {
          key,
          range: `${formatShort(group[0].day)} – ${formatShort(group[group.length - 1].day)}`,
          done,
          failed: group.filter((cell) => cell.status === 'failed').length,
        }
      })
      .filter((week) => week.done > 0 || week.failed > 0)
  }, [cells, countsByDate])

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

        {weeks.length === 0 ? (
          <p className="muted">Nenhuma caçada registrada ainda.</p>
        ) : (
          <ul className="log-list">
            {weeks.map((week) => (
              <li key={week.key}>
                <span className="log-day">{week.range}</span>
                <span className="log-titles">
                  {week.done} dia{week.done === 1 ? '' : 's'} feito{week.done === 1 ? '' : 's'}
                  {week.failed > 0 &&
                    ` · ${week.failed} falha${week.failed === 1 ? '' : 's'}`}
                </span>
                <span className={week.failed > 0 ? 'log-mark log-mark--fail' : 'log-mark'}>
                  {week.failed > 0 ? '✗' : '✓'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
