import { useEffect, useState } from 'react'
import { useLocation } from 'wouter'
import { ArrowRight, Moon, Sun } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { homePathForRole } from '@/constants/roles'
import { readNextFromSearch, resolvePostAuthPath, stashAuthNext } from '@/lib/authReturn'
import AuthStage from '@/components/auth/AuthStage'

/**
 * Login form — same auth behaviour as before, premium AuthStage chrome.
 */
export default function LoginForm({ theme, setTheme }) {
  const [, setLocation] = useLocation()
  const { signIn, refreshProfile, configured } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const next = readNextFromSearch(typeof window !== 'undefined' ? window.location.search : '')
    if (next) stashAuthNext(next)
  }, [])

  async function doLogin(e) {
    e.preventDefault()
    setError('')
    if (!configured) {
      setError('Supabase is not configured. Add keys in .env')
      return
    }
    setBusy(true)
    const { error: err, profile: p } = await signIn({ email, password })
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
      subtitle="Campus email unlocks your orbit — student, organizer, or admin. Separate tab per role (Ctrl+T)."
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={() => setLocation('/')}>
            Guest home
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => setLocation(signupHref)}>
            Create an account
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
        </>
      }
    >
      <form onSubmit={doLogin}>
        <label className="label">Campus email</label>
        <input
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          data-testid="input-login-email"
          autoComplete="email"
        />
        <label className="label">Password</label>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          data-testid="input-login-password"
          autoComplete="current-password"
        />
        {error ? (
          <p className="muted" style={{ color: 'var(--danger)', marginTop: 12 }}>
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', marginTop: 18 }}
          disabled={busy}
          data-testid="button-login"
        >
          {busy ? 'Signing in…' : <>Continue <ArrowRight size={15} /></>}
        </button>
      </form>
    </AuthStage>
  )
}
