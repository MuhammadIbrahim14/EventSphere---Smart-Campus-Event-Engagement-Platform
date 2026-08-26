import { useCallback, useEffect, useState } from 'react'
import { ASSIGNABLE_ROLES, ROLES } from '../../constants/roles'
import { TABLES } from '../../constants/domain'
import { useAuth } from '../../context/AuthContext'
import { getProfiles, updateProfileRole } from '../../services/profiles'
import { useRealtimeTables } from '../../hooks/useRealtimeTables'

/** Admin → Users / Organizers / Students: real Supabase profiles. */
export default function AdminUsersLive({ setToast, roleFilter = 'all' }) {
  const { user } = useAuth()
  const [profiles, setProfiles] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)

  const title =
    roleFilter === ROLES.ORGANIZER
      ? 'Organizers'
      : roleFilter === ROLES.USER
        ? 'Students'
        : 'Users'

  const load = useCallback(async (opts = {}) => {
    const silent = Boolean(opts.silent)
    if (!silent) setLoading(true)
    setError('')
    const { data, error: err } = await getProfiles()
    if (err) setError(err.message)
    else setProfiles(data || [])
    if (!silent) setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeTables([TABLES.PROFILES], () => load({ silent: true }), {
    channelName: 'es-admin-users',
  })

  async function changeRole(profile, nextRole) {
    if (profile.role === nextRole) return
    if (profile.id === user?.id && nextRole !== ROLES.ADMIN) {
      setError('You cannot demote yourself while signed in as admin.')
      return
    }
    setError('')
    setSavingId(profile.id)
    const { error: err } = await updateProfileRole(profile.id, nextRole)
    setSavingId(null)
    if (err) {
      setError(err.message)
      return
    }
    setToast?.(`${profile.email} → ${nextRole}`)
    await load()
  }

  const filtered =
    roleFilter === 'all'
      ? profiles
      : profiles.filter((p) => p.role === roleFilter)

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">People directory</div>
          <h1>{title}</h1>
          <p>
            {roleFilter === 'all'
              ? <>All profiles. Signup creates <code>user</code> (student). Only admins promote organizers.</>
              : roleFilter === ROLES.USER
                ? 'Accounts with role user (students / participants).'
                : 'Accounts with role organizer.'}
          </p>
        </div>
      </div>
      {error && (
        <p className="muted" style={{ color: 'var(--danger)', marginBottom: 12 }}>
          {error}
        </p>
      )}
      {loading ? (
        <p className="muted">Loading profiles…</p>
      ) : !filtered.length ? (
        <div className="surface" style={{ padding: 24 }}>
          <p className="muted" style={{ margin: 0 }}>No {title.toLowerCase()} found.</p>
        </div>
      ) : (
        <div className="surface table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Joined</th>
                {roleFilter === 'all' && <th>Assign</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.full_name || '—'}</strong>
                  </td>
                  <td>{p.email}</td>
                  <td>
                    <span className="badge badge-approved">{p.role}</span>
                  </td>
                  <td>{p.department || '—'}</td>
                  <td>{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                  {roleFilter === 'all' && (
                    <td>
                      <select
                        className="input"
                        style={{ width: 140, padding: '8px 10px' }}
                        value={p.role}
                        disabled={p.id === user?.id || savingId === p.id}
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
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
