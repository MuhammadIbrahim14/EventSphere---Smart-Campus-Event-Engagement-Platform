import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function AdminDashboard() {
  const { profile } = useAuth()

  return (
    <div className="page">
      <header className="page-header">
        <h1>Admin overview</h1>
        <p className="muted">Signed in as {profile?.email}</p>
      </header>

      <div className="link-grid">
        <Link to="/admin/items" className="panel-link">
          <strong>Items</strong>
          <span>Create, edit, delete (CRUD)</span>
        </Link>
        <Link to="/admin/users" className="panel-link">
          <strong>Users</strong>
          <span>Assign user / organizer / admin</span>
        </Link>
      </div>
    </div>
  )
}
