import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { ArrowRight, Mail } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { homePathForRole } from '../../constants/roles'
import { sendEmailOtp, verifyEmailOtp } from '../../services/emailOtp'
import { isEmailJsConfigured } from '../../lib/emailjs'
import { resolvePostAuthPath } from '@/lib/authReturn'
import AuthStage from '@/components/auth/AuthStage'

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
      const search = typeof window !== 'undefined' ? window.location.search : ''
      setLocation(resolvePostAuthPath(homePathForRole(profile.role), search))
    }
  }, [profile, setLocation])

  useEffect(() => {
    if (!loading && !user) setLocation('/login')
  }, [loading, user, setLocation])

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
    setMessage('Email verified — welcome aboard.')
    const search = typeof window !== 'undefined' ? window.location.search : ''
    setTimeout(
      () => setLocation(resolvePostAuthPath(homePathForRole(latest?.role), search)),
      600,
    )
  }

  if (loading || (user && !profile)) {
    return (
      <AuthStage mode="verify" mood="busy" title="Loading…" subtitle="">
        <p className="muted">Preparing verification…</p>
      </AuthStage>
    )
  }

  if (!user) return null

  const displayEmail = profile?.email || user?.email

  return (
    <AuthStage
      mode="verify"
      mood={error ? 'error' : busy || sending ? 'busy' : 'idle'}
      eyebrow="Orbit confirmation"
      title="Enter your 6-digit code"
      subtitle={
        <>
          We sent a one-time pass to{' '}
          <strong className="es-auth__email-chip">{displayEmail}</strong>. Valid for 10 minutes.
        </>
      }
      footer={
        <p className="muted es-auth__foot-note">
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
          <Link href="/">Public home</Link>
        </p>
      }
    >
      {!isEmailJsConfigured && (
        <p className="es-auth__alert es-auth__alert--danger">
          EmailJS is not configured in <code>.env</code>.
        </p>
      )}

      {sending && !message ? (
        <p className="es-auth__alert es-auth__alert--info">
          <Mail size={14} aria-hidden /> Sending OTP…
        </p>
      ) : null}

      <form onSubmit={handleVerify}>
        <label className="label" htmlFor="verify-otp">
          OTP code
        </label>
        <input
          id="verify-otp"
          className="input es-auth__otp"
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          required
          autoComplete="one-time-code"
          placeholder="000000"
        />
        {error ? <p className="es-auth__alert es-auth__alert--danger">{error}</p> : null}
        {message ? <p className="es-auth__alert es-auth__alert--ok">{message}</p> : null}
        <button
          className="btn btn-primary"
          style={{ width: '100%', marginTop: 18 }}
          disabled={busy || otp.length !== 6}
        >
          {busy ? 'Checking…' : <>Verify & continue <ArrowRight size={15} /></>}
        </button>
        <button
          type="button"
          className="btn es-auth__link-btn"
          style={{ width: '100%', marginTop: 10 }}
          disabled={sending}
          onClick={resend}
        >
          {sending ? 'Sending…' : 'Resend OTP'}
        </button>
      </form>
    </AuthStage>
  )
}
