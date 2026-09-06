import type { ReactNode } from 'react'
import { useAuth } from 'auth-lite-react'
import { NavLink } from 'react-router-dom'

const LINKS = [
  { to: '/dashboard', label: 'Status' },
  { to: '/treinos', label: 'Missões' },
  { to: '/recompensas', label: 'Recompensas' },
  { to: '/historico', label: 'Registro' },
  { to: '/conselheiro', label: 'Conselheiro' },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">◈</span>
          <div>
            <p className="brand-title">SISTEMA</p>
            <p className="brand-subtitle">Protocolo de Ascensão Diária</p>
          </div>
        </div>

        <nav className="app-nav">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="app-user">
          <span>{user?.name ?? user?.email}</span>
          <button type="button" className="ghost-button" onClick={logout}>
            Sair
          </button>
        </div>
      </header>

      <main className="app-main">{children}</main>
    </div>
  )
}
