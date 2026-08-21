import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function UserDashboard() {
  const { profile, isAdmin } = useAuth()

  return (
    <div className="user-simple">
      <p className="eyebrow">Welcome</p>
      <h1>Hello, {profile?.full_name || 'there'}</h1>
      <p className="muted">
        You are signed in as <strong>{profile?.email || '—'}</strong>. This is the user home —
        competition features will appear here when the brief arrives.
      </p>

      {isAdmin && (
        <p style={{ marginTop: '1.25rem' }}>
          <Link to="/admin" className="btn btn-primary">
            Open admin panel
          </Link>
        </p>
      )}
    </div>
  )
}
