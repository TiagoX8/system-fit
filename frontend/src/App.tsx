import { useAuth } from 'auth-lite-react'
import { Navigate, Route, Routes } from 'react-router-dom'

import Layout from './components/Layout'
import Coach from './pages/Coach'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Login from './pages/Login'
import Rewards from './pages/Rewards'
import Workouts from './pages/Workouts'

export default function App() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <div className="system-loading">Sincronizando com o Sistema...</div>
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/treinos" element={<Workouts />} />
        <Route path="/recompensas" element={<Rewards />} />
        <Route path="/historico" element={<History />} />
        <Route path="/conselheiro" element={<Coach />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  )
}
