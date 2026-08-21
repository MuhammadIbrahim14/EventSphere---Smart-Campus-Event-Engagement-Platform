import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** Guests see children. Logged-in users go to OTP / app / admin — never flash wrong page. */
export function GuestOnly({ children }) {
  const { user, isAdmin, loading, configured, profile } = useAuth()

  if (!configured) return children

  if (loading) {
    return (
      <div className="page-center">
        <p className="muted">Loading…</p>
      </div>
    )
  }

  if (user) {
    // Wait for profile so we know verification status
    if (!profile) {
      return (
        <div className="page-center">
          <p className="muted">Loading…</p>
        </div>
      )
    }

    if (profile.email_verified === false) {
      return <Navigate to="/verify-email" replace />
    }

    return <Navigate to={isAdmin ? '/admin' : '/app'} replace />
  }

  return children
}
