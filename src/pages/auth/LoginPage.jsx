import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function LoginPage() {
  const { signIn, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error: err, profile: p } = await signIn({ email, password })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    const latest = p || (await refreshProfile())
    if (latest && latest.email_verified === false) {
      navigate('/verify-email')
      return
    }
    const role = String(latest?.role || '')
      .trim()
      .toLowerCase()
    navigate(role === 'admin' ? '/admin' : '/app')
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <p className="brand">SYNVEX FORGE</p>
        <h1>Sign in</h1>
        <p className="muted">Sign in to continue.</p>

        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="auth-foot">
          No account? <Link to="/signup">Create one</Link>
        </p>
      </form>
    </div>
  )
}
