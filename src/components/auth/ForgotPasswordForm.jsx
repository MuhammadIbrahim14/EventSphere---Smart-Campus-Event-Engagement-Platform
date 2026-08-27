import { useEffect, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { ArrowLeft, ArrowRight, KeyRound, Mail } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { isEmailJsConfigured } from '@/lib/emailjs'
import {
  completePasswordReset,
  requestPasswordResetOtp,
} from '@/services/passwordReset'
import AuthStage from '@/components/auth/AuthStage'

const RESET_EMAIL_KEY = 'es_reset_email'

export default function ForgotPasswordForm() {
  const { user, loading } = useAuth()
  const [, setLocation] = useLocation()
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && user) setLocation('/login')
  }, [loading, user, setLocation])

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(RESET_EMAIL_KEY)
      if (saved) setEmail(saved)
    } catch {
      /* ignore */
    }
  }, [])

  async function sendOtp(e) {
    e?.preventDefault?.()
    setError('')
    setMessage('')
    if (!isEmailJsConfigured) {
      setError('EmailJS is not configured in .env')
      return
    }
    setSending(true)
    const { error: err, toEmail } = await requestPasswordResetOtp(email)
    setSending(false)
    if (err) {
      setError(err.message)
      return
    }
    try {
      sessionStorage.setItem(RESET_EMAIL_KEY, toEmail)
    } catch {
      /* ignore */
    }
    setMessage(
      'If an account exists for that email, a 6-digit recovery code was sent. Check inbox and spam.',
    )
    setStep(2)
  }

  async function handleReset(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    const { ok, error: err } = await completePasswordReset({ email, otp, newPassword: password })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    if (!ok) {
      setError('Invalid or expired code. Request a new one and try again.')
      return
    }
    try {
      sessionStorage.removeItem(RESET_EMAIL_KEY)
    } catch {
      /* ignore */
    }
    setMessage('Password updated. Sign in with your new password.')
    setTimeout(() => setLocation('/login'), 1400)
  }

  const mood = error ? 'error' : busy || sending ? 'busy' : message && step === 1 ? 'idle' : 'idle'

  if (loading) {
    return (
      <AuthStage mode="forgot" mood="busy" title="Loading…" subtitle="">
        <p className="muted">Checking session…</p>
      </AuthStage>
    )
  }

  if (user) return null

  return (
    <AuthStage
      mode="forgot"
      mood={mood}
      eyebrow="Recovery airlock"
      title={step === 1 ? 'Reset your passcode' : 'Set a new password'}
      subtitle={
        step === 1
          ? 'We email a one-time 6-digit code via your existing EmailJS setup — no paid add-ons.'
          : `Enter the code sent to ${email || 'your email'} and choose a new password.`
      }
      footer={
        <p className="muted es-auth__foot-note">
          <Link href="/login">Back to sign in</Link>
          {' · '}
          <Link href="/signup">Create account</Link>
          {' · '}
          <Link href="/">Public home</Link>
        </p>
      }
    >
      <div className="es-auth__steps" aria-hidden>
        <span className={`es-auth__step ${step >= 1 ? 'is-on' : ''}`} />
        <span className={`es-auth__step ${step >= 2 ? 'is-on' : ''}`} />
      </div>

      {!isEmailJsConfigured && (
        <p className="es-auth__alert es-auth__alert--danger">
          Add EmailJS keys to <code>.env</code> before using password reset.
        </p>
      )}

      {step === 1 ? (
        <form onSubmit={sendOtp}>
          <label className="label" htmlFor="forgot-email">
            Account email
          </label>
          <div className="es-auth__input-wrap">
            <Mail size={16} className="es-auth__input-icon" aria-hidden />
            <input
              id="forgot-email"
              className="input es-auth__input--icon"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@email.com"
            />
          </div>
          {error ? <p className="es-auth__alert es-auth__alert--danger">{error}</p> : null}
          {message ? <p className="es-auth__alert es-auth__alert--ok">{message}</p> : null}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 18 }}
            disabled={sending}
          >
            {sending ? 'Sending code…' : <>Send recovery code <ArrowRight size={15} /></>}
          </button>
        </form>
      ) : (
        <form onSubmit={handleReset}>
          <label className="label" htmlFor="forgot-otp">
            Recovery code
          </label>
          <input
            id="forgot-otp"
            className="input es-auth__otp"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
            autoComplete="one-time-code"
            placeholder="000000"
          />
          <label className="label" htmlFor="forgot-password">
            New password
          </label>
          <div className="es-auth__input-wrap">
            <KeyRound size={16} className="es-auth__input-icon" aria-hidden />
            <input
              id="forgot-password"
              className="input es-auth__input--icon es-auth__input--pw"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              autoComplete="new-password"
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
          <label className="label" htmlFor="forgot-confirm">
            Confirm password
          </label>
          <input
            id="forgot-confirm"
            className="input"
            type={showPw ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={6}
            required
            autoComplete="new-password"
          />
          {error ? <p className="es-auth__alert es-auth__alert--danger">{error}</p> : null}
          {message ? <p className="es-auth__alert es-auth__alert--ok">{message}</p> : null}
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setError('')
                setMessage('')
                setStep(1)
              }}
            >
              <ArrowLeft size={14} /> Back
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={busy || otp.length !== 6}
            >
              {busy ? 'Updating…' : <>Save new password <ArrowRight size={15} /></>}
            </button>
          </div>
          <button
            type="button"
            className="btn es-auth__link-btn"
            style={{ width: '100%', marginTop: 10 }}
            disabled={sending}
            onClick={sendOtp}
          >
            {sending ? 'Sending…' : 'Resend recovery code'}
          </button>
        </form>
      )}
    </AuthStage>
  )
}
