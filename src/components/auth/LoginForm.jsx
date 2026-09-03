import { useEffect, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { ArrowRight, Hash, Lock, Mail, Moon, Sun } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { homePathForRole } from '@/constants/roles'
import { readNextFromSearch, resolvePostAuthPath, stashAuthNext } from '@/lib/authReturn'
import { validateEnrollmentLogin, validateLogin } from '@/lib/authValidation'
import AuthStage from '@/components/auth/AuthStage'

function FieldError({ message }) {
  if (!message) return null
  return <p className="es-auth__field-error">{message}</p>
}

export default function LoginForm({ theme, setTheme }) {
  const [, setLocation] = useLocation()
  const { signIn, signInWithEnrollment, refreshProfile, configured } = useAuth()
  const [mode, setMode] = useState('enrollment')
  const [email, setEmail] = useState('')
  const [enrollmentNo, setEnrollmentNo] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const next = readNextFromSearch(typeof window !== 'undefined' ? window.location.search : '')
    if (next) stashAuthNext(next)
  }, [])

  function clearError(key) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
    if (error) setError('')
  }

  function afterLogin(latest) {
    const search = typeof window !== 'undefined' ? window.location.search : ''
    if (latest?.must_change_password) {
      const next = readNextFromSearch(search)
      if (next) stashAuthNext(next)
      setLocation('/set-password')
      return
    }
    if (latest && latest.email_verified === false) {
      const next = readNextFromSearch(search)
      if (next) stashAuthNext(next)
      setLocation('/verify-email')
      return
    }
    setLocation(resolvePostAuthPath(homePathForRole(latest?.role), search))
  }

  async function doLogin(e) {
    e.preventDefault()
    setError('')

    if (!configured) {
      setError('Supabase is not configured. Add keys in .env')
      return
    }

    if (mode === 'enrollment') {
      const result = validateEnrollmentLogin({ enrollmentNo, password })
      if (!result.ok) {
        setFieldErrors(result.errors)
        setError(result.firstError)
        return
      }
      setFieldErrors({})
      setBusy(true)
      const { error: err, profile: p } = await signInWithEnrollment({
        enrollmentNo,
        password,
      })
      setBusy(false)
      if (err) {
        setError(err.message || 'Invalid enrollment or password')
        return
      }
      afterLogin(p || (await refreshProfile()))
      return
    }

    const result = validateLogin({ email, password })
    if (!result.ok) {
      setFieldErrors(result.errors)
      setError(result.firstError)
      return
    }
    setFieldErrors({})
    setBusy(true)
    const { error: err, profile: p } = await signIn({ email: email.trim(), password })
    setBusy(false)
    if (err) {
      setError(
        err.code === 'email_not_linked'
          ? err.message
          : err.message || 'Invalid email or password',
      )
      return
    }
    afterLogin(p || (await refreshProfile()))
  }

  return (
    <AuthStage
      mode="login"
      mood={error ? 'error' : busy ? 'busy' : 'idle'}
      eyebrow="Return pass"
      title="Step back into the sphere"
      subtitle="Campus students use enrollment. Staff and guests use email. Link a personal email later for recovery."
      footer={
        <div className="es-auth__footer-row">
          <button type="button" className="btn btn-quiet" onClick={() => setLocation('/')}>
            Guest home
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => setLocation('/signup?intent=guest')}
          >
            Public guest signup
          </button>
          {typeof setTheme === 'function' ? (
            <button
              type="button"
              className="btn btn-quiet"
              onClick={(e) => setTheme(theme === 'dark' ? 'light' : 'dark', e)}
            >
              {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}{' '}
              {theme === 'dark' ? 'Light' : 'Midnight'}
            </button>
          ) : null}
        </div>
      }
    >
      <form onSubmit={doLogin} className="es-auth__form" noValidate>
        <div className="es-auth__mode-toggle" role="tablist" aria-label="Login method">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'enrollment'}
            className={`btn btn-quiet ${mode === 'enrollment' ? 'active' : ''}`}
            onClick={() => {
              setMode('enrollment')
              setError('')
              setFieldErrors({})
            }}
            data-testid="tab-login-enrollment"
          >
            Enrollment
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'email'}
            className={`btn btn-quiet ${mode === 'email' ? 'active' : ''}`}
            onClick={() => {
              setMode('email')
              setError('')
              setFieldErrors({})
            }}
            data-testid="tab-login-email"
          >
            Email
          </button>
        </div>

        {mode === 'enrollment' ? (
          <>
            <label className="label" htmlFor="login-enrollment">
              Enrollment number
            </label>
            <div className="es-auth__input-wrap">
              <Hash size={16} className="es-auth__input-icon" aria-hidden />
              <input
                id="login-enrollment"
                className={`input es-auth__input--icon ${fieldErrors.enrollmentNo ? 'is-invalid' : ''}`}
                type="text"
                value={enrollmentNo}
                onChange={(e) => {
                  setEnrollmentNo(e.target.value)
                  clearError('enrollmentNo')
                }}
                required
                data-testid="input-login-enrollment"
                autoComplete="username"
                placeholder="e.g. 1544129"
                aria-invalid={Boolean(fieldErrors.enrollmentNo)}
              />
            </div>
            <FieldError message={fieldErrors.enrollmentNo} />
          </>
        ) : (
          <>
            <label className="label" htmlFor="login-email">
              Email
            </label>
            <div className="es-auth__input-wrap">
              <Mail size={16} className="es-auth__input-icon" aria-hidden />
              <input
                id="login-email"
                className={`input es-auth__input--icon ${fieldErrors.email ? 'is-invalid' : ''}`}
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  clearError('email')
                }}
                required
                data-testid="input-login-email"
                autoComplete="email"
                placeholder="you@email.com"
                aria-invalid={Boolean(fieldErrors.email)}
              />
            </div>
            <FieldError message={fieldErrors.email} />
          </>
        )}

        <div className="es-auth__field-row">
          <label className="label es-auth__field-row-label" htmlFor="login-password">
            Password
          </label>
          {mode === 'email' ? (
            <Link href="/forgot-password" className="es-auth__inline-link">
              Forgot password?
            </Link>
          ) : (
            <span className="es-auth__inline-link muted" style={{ cursor: 'default' }}>
              Ask admin if locked out
            </span>
          )}
        </div>
        <div className="es-auth__input-wrap">
          <Lock size={16} className="es-auth__input-icon" aria-hidden />
          <input
            id="login-password"
            className={`input es-auth__input--icon es-auth__input--pw ${fieldErrors.password ? 'is-invalid' : ''}`}
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              clearError('password')
            }}
            required
            minLength={6}
            data-testid="input-login-password"
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={Boolean(fieldErrors.password)}
          />
          <button
            type="button"
            className="es-auth__pw-toggle"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? 'Hide password' : 'Show password'}
          >
            {showPw ? 'Hide' : 'Show'}
          </button>
        </div>
        <FieldError message={fieldErrors.password} />

        {error ? <p className="es-auth__alert es-auth__alert--danger">{error}</p> : null}

        <button
          type="submit"
          className="btn btn-primary es-auth__submit"
          disabled={busy}
          data-testid="button-login"
        >
          {busy ? 'Signing in…' : <>Continue <ArrowRight size={15} /></>}
        </button>

        <p className="es-auth__foot-note muted">
          Campus students are provisioned by admin ·{' '}
          <Link href="/signup?intent=guest">Join as public guest</Link>
        </p>
      </form>
    </AuthStage>
  )
}
