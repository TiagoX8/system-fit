import { useEffect, useRef, useState } from 'react'
import { useAuth } from 'auth-lite-react'

import { apiFetch } from '../api'
import type { CoachMessage, CoachReply, CoachStatus } from '../types'

const SUGGESTIONS = [
  'Como melhorar minha prancha?',
  'Sugira um exercício sem equipamento para pernas.',
  'Como montar uma progressão de flexões?',
  'Quanto tempo devo descansar entre as séries?',
]

const WELCOME: CoachMessage = {
  role: 'assistant',
  content:
    'Conselheiro do Sistema ativo. Pergunte sobre execução, progressão ou peça sugestões de exercícios para a sua rotina.',
}

export default function CoachWidget() {
  const { token } = useAuth()

  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<CoachStatus | null>(null)
  const [messages, setMessages] = useState<CoachMessage[]>([WELCOME])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const feedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!token || !open || status !== null) return

    apiFetch<CoachStatus>('/coach/status', token)
      .then(setStatus)
      .catch(() => setStatus({ enabled: false, messages_per_day: 0 }))
  }, [open, status, token])

  useEffect(() => {
    const feed = feedRef.current

    if (feed) {
      feed.scrollTop = feed.scrollHeight
    }
  }, [messages, sending, open])

  async function send(text: string) {
    const question = text.trim()

    if (!question || sending || !token) return

    const history: CoachMessage[] = [...messages, { role: 'user', content: question }]

    setMessages(history)
    setDraft('')
    setError('')
    setSending(true)

    try {
      const answer = await apiFetch<CoachReply>('/coach/chat', token, {
        method: 'POST',
        body: JSON.stringify({
          messages: history.filter((message) => message !== WELCOME).slice(-12),
        }),
      })

      setMessages([...history, { role: 'assistant', content: answer.reply }])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'O Conselheiro não respondeu')
    } finally {
      setSending(false)
    }
  }

  const disabled = status !== null && !status.enabled

  return (
    <>
      <button
        type="button"
        className={open ? 'coach-fab coach-fab--open' : 'coach-fab'}
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Fechar o Conselheiro' : 'Abrir o Conselheiro do Sistema'}
        aria-expanded={open}
      >
        {open ? '✕' : '◈'}
      </button>

      {open && (
        <section className="coach-window system-panel">
          <header className="coach-header">
            <p className="panel-tag">Conselheiro do Sistema</p>
          </header>

          {disabled ? (
            <p className="muted">
              O Conselheiro está offline: falta configurar a chave da IA (GEMINI_API_KEY) no
              servidor.
            </p>
          ) : (
            <>
              <div className="chat-feed" ref={feedRef}>
                {messages.map((message, index) => (
                  <p
                    key={`${message.role}-${index}`}
                    className={`chat-bubble chat-bubble--${message.role}`}
                  >
                    {message.content}
                  </p>
                ))}

                {sending && (
                  <p className="chat-bubble chat-bubble--assistant muted">Analisando...</p>
                )}
              </div>

              {error && <p className="alert alert--danger">{error}</p>}

              {messages.length === 1 && (
                <div className="chat-suggestions">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="ghost-button"
                      disabled={sending}
                      onClick={() => void send(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}

              <form
                className="chat-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void send(draft)
                }}
              >
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={1000}
                  placeholder="Pergunte ao Sistema..."
                  aria-label="Mensagem para o Conselheiro"
                />
                <button
                  type="submit"
                  className="system-button"
                  disabled={sending || !draft.trim()}
                >
                  Enviar
                </button>
              </form>
            </>
          )}
        </section>
      )}
    </>
  )
}
