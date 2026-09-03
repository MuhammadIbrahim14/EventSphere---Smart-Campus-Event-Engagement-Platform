import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { ArrowRight, KeyRound } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { homePathForRole } from '@/constants/roles'
import { resolvePostAuthPath } from '@/lib/authReturn'
import { passwordStrengthHints, validatePasswordStrength } from '@/lib/authValidation'
import AuthStage from '@/components/auth/AuthStage'

export default function SetPasswordForm() {
  const { user, profile, loading, completeForcedPasswordChange, refreshProfile } = useAuth()
  const [, setLocation] = useLocation()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const hints = useMemo(() => passwordStrengthHints(password), [password])

  useEffect(() => {
    if (loading) return
    if (!user) {
      setLocation('/login')
      return
    }
    if (profile && !profile.must_change_password) {
      setLocation(resolvePostAuthPath(homePathForRole(profile.role)))
    }
  }, [loading, user, profile, setLocation])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    const pw = validatePasswordStrength(password)
    if (!pw.ok) {
      setError(pw.message)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    const { error: err, profile: p } = await completeForcedPasswordChange(password)
    setBusy(false)
    if (err) {
      setError(err.message || 'Could not update password')
      return
    }
    const latest = p || (await refreshProfile())
    setLocation(resolvePostAuthPath(homePathForRole(latest?.role)))
  }

  return (
    <AuthStage
      mode="login"
      mood={error ? 'error' : busy ? 'busy' : 'idle'}
      eyebrow="Secure your pass"
      title="Set a new password"
      subtitle="Your admin gave you a temporary password. Choose a new one before entering campus tools."
    >
      <form onSubmit={onSubmit} className="es-auth__form" noValidate>
        <label className="label" htmlFor="set-pw">
          New password
        </label>
        <div className="es-auth__input-wrap">
          <KeyRound size={16} className="es-auth__input-icon" aria-hidden />
          <input
            id="set-pw"
            className="input es-auth__input--icon es-auth__input--pw"
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            data-testid="input-set-password"
            autoComplete="new-password"
          />
          <button
            type="button"
            className="es-auth__pw-toggle"
            onClick={() => setShowPw((v) => !v)}
          >
            {showPw ? 'Hide' : 'Show'}
          </button>
        </div>
        <ul className="es-auth__pw-hints" style={{ listStyle: 'none', padding: 0, margin: '8px 0' }}>
          {hints.map((h) => (
            <li key={h.key} className="muted" style={{ fontSize: 11, color: h.ok ? 'var(--lime)' : undefined }}>
              {h.ok ? '✓' : '○'} {h.label}
            </li>
          ))}
        </ul>

        <label className="label" htmlFor="set-pw-confirm">
          Confirm password
        </label>
        <input
          id="set-pw-confirm"
          className="input"
          type={showPw ? 'text' : 'password'}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          data-testid="input-set-password-confirm"
          autoComplete="new-password"
        />

        {error ? <p className="es-auth__alert es-auth__alert--danger">{error}</p> : null}

        <button type="submit" className="btn btn-primary es-auth__submit" disabled={busy} data-testid="button-set-password">
          {busy ? 'Saving…' : <>Save password <ArrowRight size={15} /></>}
        </button>
      </form>
    </AuthStage>
  )
}
