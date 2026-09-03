import { useCallback, useEffect, useState } from 'react'
import { ASSIGNABLE_ROLES, ROLES } from '../../constants/roles'
import { TABLES } from '../../constants/domain'
import { useAuth } from '../../context/AuthContext'
import { getProfiles, updateProfileRole } from '../../services/profiles'
import { useRealtimeTables } from '../../hooks/useRealtimeTables'
import AdminStudentProvision, {
  adminResetStudentPassword,
} from '@/components/admin/AdminStudentProvision'
import { isSyntheticCampusEmail } from '@/lib/enrollmentAuth'

export default function AdminUsersLive({ setToast, roleFilter = 'all' }) {
  const { user } = useAuth()
  const [profiles, setProfiles] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [resettingId, setResettingId] = useState(null)

  const title =
    roleFilter === ROLES.ORGANIZER
      ? 'Organizers'
      : roleFilter === ROLES.USER
        ? 'Students'
        : roleFilter === ROLES.GUEST
          ? 'Public guests'
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

  async function resetTempPassword(profile) {
    const pwd = `Es${Math.random().toString(36).slice(2, 8)}9a`
    setResettingId(profile.id)
    const { error: err } = await adminResetStudentPassword({
      studentId: profile.id,
      tempPassword: pwd,
    })
    setResettingId(null)
    if (err) {
      setToast?.(err.message)
      return
    }
    setToast?.(
      `Temp password for ${profile.enrollment_no || profile.full_name}: ${pwd} (share securely)`,
    )
    await load()
  }

  const filtered =
    roleFilter === 'all'
      ? profiles
      : profiles.filter((p) => p.role === roleFilter)

  const showStudentCols = roleFilter === ROLES.USER || roleFilter === 'all'

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">People directory</div>
          <h1>{title}</h1>
          <p>
            {roleFilter === 'all'
              ? <>All profiles. Guests self-signup; campus students are admin-provisioned by enrollment.</>
              : roleFilter === ROLES.USER
                ? 'Campus students — provision by enrollment. They login with enrollment + password.'
                : roleFilter === ROLES.GUEST
                  ? 'Public guest accounts — hub-only access, no student dashboard or certificates.'
                  : 'Accounts with role organizer.'}
          </p>
        </div>
      </div>

      {roleFilter === ROLES.USER ? (
        <AdminStudentProvision setToast={setToast} onCreated={() => load()} />
      ) : null}

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
                {showStudentCols ? <th>Enrollment</th> : null}
                <th>Email</th>
                {showStudentCols ? <th>Personal email</th> : null}
                <th>Role</th>
                <th>Department</th>
                <th>Joined</th>
                {roleFilter === 'all' && <th>Assign</th>}
                {roleFilter === ROLES.USER && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const displayEmail = isSyntheticCampusEmail(p.email)
                  ? '—'
                  : p.email || '—'
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.full_name || '—'}</strong>
                      {p.provisioned ? (
                        <span className="badge" style={{ marginLeft: 8, fontSize: 10 }}>
                          provisioned
                        </span>
                      ) : null}
                      {p.must_change_password ? (
                        <span className="badge badge-pending" style={{ marginLeft: 6, fontSize: 10 }}>
                          must change pw
                        </span>
                      ) : null}
                    </td>
                    {showStudentCols ? <td>{p.enrollment_no || '—'}</td> : null}
                    <td>{displayEmail}</td>
                    {showStudentCols ? (
                      <td>
                        {p.personal_email_verified
                          ? p.personal_email
                          : p.personal_email
                            ? `${p.personal_email} (unverified)`
                            : '—'}
                      </td>
                    ) : null}
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
                    {roleFilter === ROLES.USER && (
                      <td>
                        <button
                          type="button"
                          className="btn btn-quiet"
                          style={{ fontSize: 11 }}
                          disabled={resettingId === p.id}
                          onClick={() => resetTempPassword(p)}
                          data-testid={`button-reset-student-${p.id}`}
                        >
                          {resettingId === p.id ? 'Resetting…' : 'Reset temp password'}
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
