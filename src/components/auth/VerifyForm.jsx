import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { useAuth } from '../../context/AuthContext'
import { homePathForRole } from '../../constants/roles'
import { sendEmailOtp, verifyEmailOtp } from '../../services/emailOtp'
import { isEmailJsConfigured } from '../../lib/emailjs'

export default function VerifyForm() {
  const { profile, user, loading, signOut, refreshProfile } = useAuth()
  const [, setLocation] = useLocation()
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

  useEffect(() => {
    if (!user || !profile || profile.email_verified || autoSent.current) return
    if (!isEmailJsConfigured) {
      setError('EmailJS is not configured in .env')
      return
    }
    autoSent.current = true
    setSending(true)
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
  }, [user, profile])

  useEffect(() => {
    if (profile?.email_verified) {
      setLocation(homePathForRole(profile.role))
    }
  }, [profile, setLocation])

  useEffect(() => {
    if (!loading && !user) setLocation('/login')
  }, [loading, user, setLocation])

  if (loading || (user && !profile)) {
    return (
      <div className="login-page">
        <p className="muted">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return null
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
    const latest = await refreshProfile()
    setBusy(false)
    setMessage('Email verified.')
    setLocation(homePathForRole(latest?.role))
  }

  return (
    <div className="login-page">
      <div className="login-shell" style={{ gridTemplateColumns: '1fr', maxWidth: 480 }}>
        <form className="login-form" onSubmit={handleVerify}>
          <div className="eyebrow">Verify email</div>
          <h2>Enter OTP</h2>
          <p>
            6-digit code for <strong>{profile?.email || user?.email}</strong>
          </p>
          {sending && <p className="muted">Sending OTP…</p>}
          <label className="label">OTP code</label>
          <input
            className="input"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
          />
          {error && (
            <p className="muted" style={{ color: 'var(--danger)', marginTop: 12 }}>
              {error}
            </p>
          )}
          {message && (
            <p className="muted" style={{ color: 'var(--lime)', marginTop: 12 }}>
              {message}
            </p>
          )}
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 19 }}
            disabled={busy || otp.length !== 6}
          >
            {busy ? 'Checking…' : 'Verify OTP'}
          </button>
          <button
            type="button"
            className="btn"
            style={{ width: '100%', marginTop: 10 }}
            disabled={sending}
            onClick={resend}
          >
            {sending ? 'Sending…' : 'Resend OTP'}
          </button>
          <p className="muted" style={{ marginTop: 16, fontSize: 12 }}>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={async () => {
                await signOut()
                setLocation('/')
              }}
            >
              Sign out
            </button>
            {' · '}
            <Link href="/">Home</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
