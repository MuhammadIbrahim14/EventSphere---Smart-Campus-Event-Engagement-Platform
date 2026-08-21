import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute() {
  const { user, loading, configured, profile } = useAuth()
  const location = useLocation()

  if (!configured) {
    return <Navigate to="/setup" replace />
  }

  if (loading) {
    return (
      <div className="page-center">
        <p className="muted">Loading session…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // EmailJS confirmation gate (skip on verify/confirm routes — those are outside)
  if (profile && profile.email_verified === false) {
    return <Navigate to="/verify-email" replace />
  }

  return <Outlet />
}
