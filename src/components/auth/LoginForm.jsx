import { useEffect, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { ArrowRight, Lock, Mail, Moon, Sun } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { homePathForRole } from '@/constants/roles'
import { readNextFromSearch, resolvePostAuthPath, stashAuthNext } from '@/lib/authReturn'
import { validateLogin } from '@/lib/authValidation'
import AuthStage from '@/components/auth/AuthStage'

function FieldError({ message }) {
  if (!message) return null
  return <p className="es-auth__field-error">{message}</p>
}

/**
 * Login form — same auth behaviour as before, premium AuthStage chrome.
 */
export default function LoginForm({ theme, setTheme }) {
  const [, setLocation] = useLocation()
  const { signIn, refreshProfile, configured } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const next = readNextFromSearch(typeof window !== 'undefined' ? window.location.search : '')
    if (next) stashAuthNext(next)
  }, [])

  function patchField(key, value) {
    if (key === 'email') setEmail(value)
    if (key === 'password') setPassword(value)
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
    if (error) setError('')
  }

  async function doLogin(e) {
    e.preventDefault()
    setError('')

    const result = validateLogin({ email, password })
    if (!result.ok) {
      setFieldErrors(result.errors)
      setError(result.firstError)
      return
    }

    setFieldErrors({})

    if (!configured) {
      setError('Supabase is not configured. Add keys in .env')
      return
    }
    setBusy(true)
    const { error: err, profile: p } = await signIn({ email: email.trim(), password })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    const latest = p || (await refreshProfile())
    const search = typeof window !== 'undefined' ? window.location.search : ''
    if (latest && latest.email_verified === false) {
      const next = readNextFromSearch(search)
      if (next) stashAuthNext(next)
      setLocation('/verify-email')
      return
    }
    setLocation(resolvePostAuthPath(homePathForRole(latest?.role), search))
  }

  const signupHref = (() => {
    const search = typeof window !== 'undefined' ? window.location.search : ''
    const next = readNextFromSearch(search)
    return next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'
  })()

  return (
    <AuthStage
      mode="login"
      mood={error ? 'error' : busy ? 'busy' : 'idle'}
      eyebrow="Return pass"
      title="Step back into the sphere"
      subtitle="Campus email unlocks your orbit — student, organizer, guest, or admin."
      footer={
        <div className="es-auth__footer-row">
          <button type="button" className="btn btn-quiet" onClick={() => setLocation('/')}>
            Guest home
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => setLocation(signupHref)}>
            Create account
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
        <label className="label" htmlFor="login-email">
          Campus email
        </label>
        <div className="es-auth__input-wrap">
          <Mail size={16} className="es-auth__input-icon" aria-hidden />
          <input
            id="login-email"
            className={`input es-auth__input--icon ${fieldErrors.email ? 'is-invalid' : ''}`}
            type="email"
            value={email}
            onChange={(e) => patchField('email', e.target.value)}
            required
            data-testid="input-login-email"
            autoComplete="email"
            placeholder="you@campus.edu"
            aria-invalid={Boolean(fieldErrors.email)}
          />
        </div>
        <FieldError message={fieldErrors.email} />

        <div className="es-auth__field-row">
          <label className="label es-auth__field-row-label" htmlFor="login-password">
            Password
          </label>
          <Link href="/forgot-password" className="es-auth__inline-link">
            Forgot password?
          </Link>
        </div>
        <div className="es-auth__input-wrap">
          <Lock size={16} className="es-auth__input-icon" aria-hidden />
          <input
            id="login-password"
            className={`input es-auth__input--icon es-auth__input--pw ${fieldErrors.password ? 'is-invalid' : ''}`}
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => patchField('password', e.target.value)}
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
          New here? <Link href={signupHref}>Create a free pass</Link>
          {' · '}
          <Link href="/signup?intent=guest">Join as public guest</Link>
        </p>
      </form>
    </AuthStage>
  )
}
