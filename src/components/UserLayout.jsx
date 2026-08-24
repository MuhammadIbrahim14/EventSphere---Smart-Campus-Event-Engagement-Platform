import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** Simple user layout — top bar only, no admin-style sidebar. */
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
        <div className="user-topbar-right">
          <span className="user-topbar-name">
            {profile?.full_name || profile?.email || 'User'}
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
