import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** Student panel layout — top bar + section nav. */
export function UserLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="user-layout">
      <header className="user-topbar">
        <p className="brand">SYNVEX FORGE</p>
        <nav className="user-topbar-nav">
          <NavLink to="/app" end>
            Home
          </NavLink>
          <NavLink to="/app/events">Events</NavLink>
          <NavLink to="/app/registrations">Registrations</NavLink>
          <NavLink to="/app/announcements">Announcements</NavLink>
          <NavLink to="/app/profile">Profile</NavLink>
          <NavLink to="/app/settings">Settings</NavLink>
        </nav>
        <div className="user-topbar-right">
          <span className="user-topbar-name">
            {profile?.full_name || profile?.email || 'Student'}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>
      <main className="user-main">
        <Outlet />
      </main>
    </div>
  )
}
