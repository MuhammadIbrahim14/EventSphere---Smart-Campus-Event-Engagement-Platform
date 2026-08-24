import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { homePathForRole } from '../../constants/roles'
import { useAuth } from '../../context/AuthContext'
import { sendEmailOtp, verifyEmailOtp } from '../../services/emailOtp'
import { isEmailJsConfigured } from '../../lib/emailjs'

export default function VerifyEmailPage() {
  const { profile, user, loading, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const autoSent = useRef(false)

  useEffect(() => {
    if (user) refreshProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Auto-send OTP after signup (or when landing here unverified)
  useEffect(() => {
    if (!user || !profile || profile.email_verified || autoSent.current) return
    if (!isEmailJsConfigured) {
      setError('EmailJS is not configured in .env')
      return
    }

    autoSent.current = true
    setSending(true)
    setError('')
    sendEmailOtp({
      email: profile.email || user.email,
      fullName: profile.full_name,
    })
      .then(({ error: err }) => {
        if (err) {
          setError(err.message)
          autoSent.current = false
        } else {
          setMessage('OTP sent to your email. Valid for 10 minutes.')
        }
      })
      .finally(() => setSending(false))
  }, [user, profile, location.key])

  if (loading || (user && !profile)) {
    return (
      <div className="page-center">
        <p className="muted">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (profile?.email_verified) {
    return <Navigate to={homePathForRole(profile.role)} replace />
  }

  async function resend() {
    setSending(true)
    setError('')
    setMessage('')
    const { error: err, toEmail } = await sendEmailOtp({
      email: profile?.email || user?.email,
      fullName: profile?.full_name || user?.user_metadata?.full_name,
    })
    setSending(false)
    if (err) {
      setError(err.message)
      return
    }
    setMessage(`New OTP sent to ${toEmail}. Check inbox/spam.`)
    await refreshProfile()
  }

  async function handleVerify(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    const { ok, error: err } = await verifyEmailOtp(otp)
    if (err) {
      setBusy(false)
      setError(err.message)
      return
    }
    if (!ok) {
      setBusy(false)
      setError('Invalid or expired OTP. Try again or resend.')
      return
    }
    await refreshProfile()
    setBusy(false)
    setMessage('Email verified.')
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleVerify}>
        <p className="brand">SYNVEX FORGE</p>
        <h1>Enter OTP</h1>
        <p className="muted">
          6-digit code for <strong>{profile?.email || user?.email}</strong>
        </p>

        {sending && <p className="muted">Sending OTP…</p>}

        {!isEmailJsConfigured && (
          <p className="banner warn">
            EmailJS keys missing in <code>.env</code>.
          </p>
        )}

        <label>
          OTP code
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="123456"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
          />
        </label>

        {error && <p className="form-error">{error}</p>}
        {message && <p className="form-ok">{message}</p>}

        <button type="submit" className="btn btn-primary" disabled={busy || otp.length !== 6}>
          {busy ? 'Checking…' : 'Verify OTP'}
        </button>

        <button type="button" className="btn btn-ghost" disabled={sending} onClick={resend}>
          {sending ? 'Sending…' : 'Resend OTP'}
        </button>

        <p className="auth-foot">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={async () => {
              await signOut()
              navigate('/', { replace: true })
            }}
          >
            Sign out
          </button>
          {' · '}
          <Link to="/">Home</Link>
        </p>
      </form>
    </div>
  )
}
