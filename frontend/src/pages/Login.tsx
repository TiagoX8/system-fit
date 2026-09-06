import { useState } from 'react'
import { useAuth } from 'auth-lite-react'

import { registerUser } from '../api'

export default function Login() {
  const { login } = useAuth()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    setError('')
    setInfo('')
    setSubmitting(true)

    try {
      if (mode === 'register') {
        await registerUser(email, name, password)
        setInfo('Despertar concluído. Entrando...')
      }

      const result = await login(email, password)

      if (!result.success) {
        setError(result.error ?? 'Falha na autenticação')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="gate">
      <div className="gate-glow" />
      <div className="gate-beam" aria-hidden="true" />

      <form className="system-panel gate-panel" onSubmit={handleSubmit}>
        <div className="gate-window-content">
          <p className="panel-tag">Janela de Status</p>
          <h1 className="gate-title">SISTEMA</h1>
          <p className="gate-subtitle">
            {mode === 'login'
              ? 'Identifique-se, Caçador.'
              : 'Você recebeu a qualificação para despertar.'}
          </p>

          {mode === 'register' && (
            <label className="field">
              <span>Nome</span>
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
          )}

          <label className="field">
            <span>E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>Senha</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error && <p className="alert alert--danger">{error}</p>}
          {info && <p className="alert alert--info">{info}</p>}

          <button type="submit" className="system-button" disabled={submitting}>
            {submitting ? 'Processando...' : mode === 'login' ? 'Entrar' : 'Despertar'}
          </button>

          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setError('')
              setInfo('')
            }}
          >
            {mode === 'login' ? 'Ainda não desperto? Criar conta' : 'Já sou Caçador. Entrar'}
          </button>
        </div>
      </form>
    </div>
  )
}
