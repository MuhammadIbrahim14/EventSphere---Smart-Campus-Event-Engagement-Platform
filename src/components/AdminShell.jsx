import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** Admin panel shell — sidebar navigation. */
export function AdminShell() {
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
          <p className="brand-sub">Admin panel</p>
        </div>

        <nav className="side-nav">
          <NavLink to="/admin" end>
            Overview
          </NavLink>
          <NavLink to="/admin/users">Users</NavLink>
          <NavLink to="/admin/approvals">Approvals</NavLink>
          <NavLink to="/admin/items">Items</NavLink>
          <NavLink to="/admin/announcements">Announcements</NavLink>
          <NavLink to="/admin/profile">Profile</NavLink>
          <NavLink to="/admin/settings">Settings</NavLink>
        </nav>

        <div className="sidebar-foot">
          <p className="user-chip">
            {profile?.full_name || profile?.email || 'Admin'}
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
