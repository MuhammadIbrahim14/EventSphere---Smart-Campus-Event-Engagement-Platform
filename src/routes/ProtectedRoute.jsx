import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CampusBootLoader from '@/components/shared/CampusBootLoader'

export function ProtectedRoute() {
  const { user, loading, configured, profile } = useAuth()
  const location = useLocation()

  if (!configured) {
    return <Navigate to="/setup" replace />
  }

  if (loading) {
    return <CampusBootLoader phase="session" />
  }

  if (!user) {
    // Guest mode: public site at `/` (teammate frontend mounts there)
    return <Navigate to="/" replace state={{ from: location }} />
  }

  // EmailJS confirmation gate (skip on verify/confirm routes — those are outside)
  if (profile && profile.email_verified === false) {
    return <Navigate to="/verify-email" replace />
  }

  return <Outlet />
}
