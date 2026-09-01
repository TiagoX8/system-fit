import { useEffect, useMemo, useState } from 'react'
import { useAuth } from 'auth-lite-react'

import { apiFetch } from '../api'
import type { WorkoutLog } from '../types'

const DAYS_SHOWN = 70

function lastDays(count: number): string[] {
  const days: string[] = []
  const today = new Date()

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const day = new Date(today)
    day.setDate(today.getDate() - offset)
    days.push(day.toISOString().slice(0, 10))
  }

  return days
}

export default function History() {
  const { token } = useAuth()

  const [logs, setLogs] = useState<WorkoutLog[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return

    apiFetch<WorkoutLog[]>('/logs/', token)
      .then(setLogs)
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

  return (
    <div className="stack">
      {error && <p className="alert alert--danger">{error}</p>}

      <section className="system-panel">
        <p className="panel-tag">Registro de caçadas</p>

        <div className="calendar">
          {lastDays(DAYS_SHOWN).map((day) => {
            const count = countsByDate.get(day) ?? 0

            return (
              <span
                key={day}
                className={count > 0 ? 'calendar-cell calendar-cell--done' : 'calendar-cell'}
                title={`${day}: ${count} treino(s)`}
              />
            )
          })}
        </div>

        <ul className="log-list">
          {logs.slice(0, 30).map((log) => (
            <li key={log.id}>
              <span>{log.date}</span>
              <span>{log.completed ? 'concluído' : 'pendente'}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
