import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function AdminRoute() {
  const { isAdmin, loading, profile } = useAuth()

  if (loading) {
    return (
      <div className="page-center">
        <p className="muted">Checking access…</p>
      </div>
    )
  }

  if (!profile || !isAdmin) {
    return <Navigate to="/app" replace />
  }

  return <Outlet />
}
