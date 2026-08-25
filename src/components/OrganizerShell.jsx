import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** Organizer panel — only role === organizer (AdminRoute-style guard). */
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
          <NavLink to="/organizer" end>
            Overview
          </NavLink>
          <NavLink to="/organizer/events">Events</NavLink>
          <NavLink to="/organizer/attendance">Attendance</NavLink>
          <NavLink to="/organizer/categories">Categories</NavLink>
          <NavLink to="/organizer/reports">Reports</NavLink>
          <NavLink to="/organizer/announcements">Announcements</NavLink>
          <NavLink to="/organizer/profile">Profile</NavLink>
          <NavLink to="/organizer/settings">Settings</NavLink>
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
