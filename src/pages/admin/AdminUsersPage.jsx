import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getProfiles, updateProfileRole } from '../../services/profiles'

export default function AdminUsersPage() {
  const { user } = useAuth()
  const [profiles, setProfiles] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    setError('')
    const { data, error: err } = await getProfiles()
    if (err) setError(err.message)
    else setProfiles(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function toggleRole(profile) {
    const next = profile.role === 'admin' ? 'user' : 'admin'
    if (profile.id === user.id && next === 'user') {
      setError('You cannot demote yourself while signed in as admin.')
      return
    }
    setError('')
    const { error: err } = await updateProfileRole(profile.id, next)
    if (err) setError(err.message)
    else await load()
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Users</h1>
        <p className="muted">Promote or demote roles (admin only)</p>
      </header>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td>{p.full_name || '—'}</td>
                  <td>{p.email}</td>
                  <td>
                    <span className={`pill role-${p.role}`}>{p.role}</span>
                  </td>
                  <td>{new Date(p.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => toggleRole(p)}
                      disabled={p.id === user.id}
                    >
                      Make {p.role === 'admin' ? 'user' : 'admin'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
