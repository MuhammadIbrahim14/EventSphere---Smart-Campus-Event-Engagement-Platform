import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { isEmailJsConfigured } from '../../lib/emailjs'

export default function SignupPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)

    const { data, error: err } = await signUp({ email, password, fullName })
    setBusy(false)

    if (err) {
      setError(err.message)
      return
    }

    if (data?.user && !data.session) {
      setError(
        'Supabase Confirm email is still ON. Turn it OFF: Authentication → Providers → Email → Confirm email. Then sign up again.',
      )
      return
    }

    // Go straight to OTP screen (OTP is sent there — avoids user-panel flash)
    navigate('/verify-email', { replace: true, state: { autoSend: true } })
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <p className="brand">SYNVEX FORGE</p>
        <h1>Create account</h1>
        <p className="muted">Next step: enter the OTP sent to your email.</p>

        {!isEmailJsConfigured && (
          <p className="banner warn">
            Add EmailJS keys to <code>.env</code> before signup.
          </p>
        )}

        <label>
          Full name
          <input
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </label>

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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Creating…' : 'Sign up'}
        </button>

        <p className="auth-foot">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  )
}
