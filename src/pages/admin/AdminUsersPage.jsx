import { useEffect, useState } from 'react'
import { ASSIGNABLE_ROLES, ROLES } from '../../constants/roles'
import { useAuth } from '../../context/AuthContext'
import { getProfiles, updateProfileRole } from '../../services/profiles'

export default function AdminUsersPage() {
  const { user } = useAuth()
  const [profiles, setProfiles] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)

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

  async function changeRole(profile, nextRole) {
    if (profile.role === nextRole) return
    if (profile.id === user.id && nextRole !== ROLES.ADMIN) {
      setError('You cannot demote yourself while signed in as admin.')
      return
    }
    setError('')
    setSavingId(profile.id)
    const { error: err } = await updateProfileRole(profile.id, nextRole)
    setSavingId(null)
    if (err) setError(err.message)
    else await load()
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Users</h1>
        <p className="muted">
          Assign roles. Only admins can promote organizers — signup always creates{' '}
          <code>user</code>.
        </p>
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
                <th>Assign</th>
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
                    <select
                      className="role-select"
                      value={p.role}
                      disabled={p.id === user.id || savingId === p.id}
                      onChange={(e) => changeRole(p, e.target.value)}
                      aria-label={`Role for ${p.email}`}
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
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
