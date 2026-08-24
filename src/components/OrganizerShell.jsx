import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Organizer panel mount point.
 * Teammate: replace this shell (or its children) with your organizer frontend
 * after git pull — keep route `/organizer` + OrganizerRoute guard.
 */
export function OrganizerShell() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-block">
          <p className="brand">SYNVEX FORGE</p>
          <p className="brand-sub">Organizer panel</p>
        </div>

        <nav className="side-nav">
          <span className="muted" style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
            Connect your routes here
          </span>
        </nav>

        <div className="sidebar-foot">
          <p className="user-chip">
            {profile?.full_name || profile?.email || 'Organizer'}
            <span>{profile?.role}</span>
          </p>
          <button type="button" className="btn btn-ghost" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
