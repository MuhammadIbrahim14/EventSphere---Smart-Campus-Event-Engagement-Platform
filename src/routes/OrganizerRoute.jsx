import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { homePathForRole } from '../constants/roles'

/** Only profiles with role === 'organizer' (assigned by admin). */
export function OrganizerRoute() {
  const { isOrganizer, loading, profile, role } = useAuth()

  if (loading) {
    return (
      <div className="page-center">
        <p className="muted">Checking access…</p>
      </div>
    )
  }

  if (!profile || !isOrganizer) {
    return <Navigate to={homePathForRole(role)} replace />
  }

  return <Outlet />
}
