import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { ArrowLeft, ArrowRight, KeyRound, Mail } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { isEmailJsConfigured } from '../../lib/emailjs'
import { STUDENT_INTERESTS } from '@/constants/domain'
import { readIntentFromSearch, readNextFromSearch, stashAuthNext } from '@/lib/authReturn'
import {
  passwordStrengthHints,
  validateSignupStep1,
  validateSignupStep2,
} from '@/lib/authValidation'
import AuthStage from '@/components/auth/AuthStage'

function FieldError({ message }) {
  if (!message) return null
  return <p className="es-auth__field-error">{message}</p>
}

export default function SignupForm() {
  const { signUp } = useAuth()
  const [, setLocation] = useLocation()
  const search = typeof window !== 'undefined' ? window.location.search : ''
  const intentGuest = useMemo(() => readIntentFromSearch(search) === 'guest', [search])
  const [step, setStep] = useState(1)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mobile, setMobile] = useState('')
  const [department, setDepartment] = useState('')
  const [enrollmentNo, setEnrollmentNo] = useState('')
  const [interests, setInterests] = useState([])
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const pwHints = useMemo(() => passwordStrengthHints(password), [password])

  useEffect(() => {
    const next = readNextFromSearch(search)
    if (next) stashAuthNext(next)
  }, [search])

  const loginHref = (() => {
    const next = readNextFromSearch(search)
    const base = next ? `/login?next=${encodeURIComponent(next)}` : '/login'
    return intentGuest ? `${base}${base.includes('?') ? '&' : '?'}intent=guest` : base
  })()

  // Campus students are admin-provisioned — block open student signup
  if (!intentGuest) {
    return (
      <AuthStage
        mode="signup"
        mood="idle"
        eyebrow="Closed campus"
        title="Students don’t self-register"
        subtitle="Your institute admin issues an enrollment number and temporary password. Public guests can still create an account."
        footer={
          <p className="muted es-auth__foot-note" style={{ margin: 0 }}>
            <Link href={loginHref}>Campus login</Link>
            {' · '}
            <Link href="/signup?intent=guest">Public guest signup</Link>
            {' · '}
            <Link href="/">Public home</Link>
          </p>
        }
      >
        <div className="es-auth__form" style={{ display: 'grid', gap: 12 }}>
          <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
            After first login with enrollment, you can set a new password and optionally link a
            personal email for privacy and password recovery.
          </p>
          <button
            type="button"
            className="btn btn-primary es-auth__submit"
            onClick={() => setLocation(loginHref)}
            data-testid="button-go-campus-login"
          >
            Go to campus login <ArrowRight size={15} />
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => setLocation('/signup?intent=guest')}
            data-testid="button-go-guest-signup"
          >
            Continue as public guest
          </button>
        </div>
      </AuthStage>
    )
  }

  const toggleInterest = (tag) => {
    setInterests((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag)
      if (prev.length >= 8) return prev
      return [...prev, tag]
    })
    setFieldErrors((prev) => {
      if (!prev.interests) return prev
      const next = { ...prev }
      delete next.interests
      return next
    })
  }

  function clearFieldError(key) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
    if (error) setError('')
  }

  function goNextStep(e) {
    e.preventDefault()
    setError('')
    const result = validateSignupStep1({ fullName, email, password, intentGuest })
    if (!result.ok) {
      setFieldErrors(result.errors)
      setError(result.firstError)
      return
    }
    setFieldErrors({})
    setStep(2)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const step1 = validateSignupStep1({ fullName, email, password, intentGuest })
    if (!step1.ok) {
      setFieldErrors(step1.errors)
      setError(step1.firstError)
      setStep(1)
      return
    }
    const step2 = validateSignupStep2({ mobile, intentGuest, interests })
    if (!step2.ok) {
      setFieldErrors(step2.errors)
      setError(step2.firstError)
      return
    }
    setFieldErrors({})
    setBusy(true)
    const { data, error: err } = await signUp({
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      mobile,
      department,
      enrollmentNo: intentGuest ? '' : enrollmentNo,
      interests: intentGuest ? [] : interests,
      intent: intentGuest ? 'guest' : 'student',
    })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    if (data?.user && !data.session) {
      setError(
        'Supabase Confirm email is still ON. Turn it OFF: Authentication → Providers → Email → Confirm email.',
      )
      return
    }
    setLocation('/verify-email')
  }

  return (
    <AuthStage
      mode="signup"
      mood={error ? 'error' : busy ? 'busy' : 'idle'}
      eyebrow={intentGuest ? 'Public guest pass' : 'Issue a new pass'}
      title={intentGuest ? 'Join as a public guest' : 'Claim your campus seat'}
      subtitle={
        intentGuest
          ? 'Public guests — OTP confirm, then your guest hub.'
          : 'Campus email required. Organizer access is granted by admin.'
      }
      footer={
        <p className="muted es-auth__foot-note" style={{ margin: 0 }}>
          Already have an account? <Link href={loginHref}>Sign in</Link>
          {' · '}
          <Link href="/forgot-password">Forgot password?</Link>
          {' · '}
          <Link href="/">Public home</Link>
          {!intentGuest ? (
            <>
              {' · '}
              <Link href="/signup?intent=guest">Continue as guest</Link>
            </>
          ) : (
            <>
              {' · '}
              <Link href="/login">Campus student login</Link>
            </>
          )}
        </p>
      }
    >
      <div className="es-auth__steps" aria-hidden>
        <span className={`es-auth__step ${step >= 1 ? 'is-on' : ''}`} />
        <span className={`es-auth__step ${step >= 2 ? 'is-on' : ''}`} />
      </div>

      {!isEmailJsConfigured && (
        <p className="es-auth__alert es-auth__alert--danger" style={{ marginBottom: 12 }}>
          Add EmailJS keys to <code>.env</code> before signup.
        </p>
      )}

      {step === 1 ? (
        <form onSubmit={goNextStep} noValidate>
          <label className="label" htmlFor="signup-name">
            Full name
          </label>
          <input
            id="signup-name"
            className={`input ${fieldErrors.fullName ? 'is-invalid' : ''}`}
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value)
              clearFieldError('fullName')
            }}
            required
            autoComplete="name"
            placeholder="Your full name"
            aria-invalid={Boolean(fieldErrors.fullName)}
          />
          <FieldError message={fieldErrors.fullName} />

          <label className="label" htmlFor="signup-email">
            Email
          </label>
          <div className="es-auth__input-wrap">
            <Mail size={16} className="es-auth__input-icon" aria-hidden />
            <input
              id="signup-email"
              className={`input es-auth__input--icon ${fieldErrors.email ? 'is-invalid' : ''}`}
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                clearFieldError('email')
              }}
              required
              autoComplete="email"
              placeholder="you@email.com"
              aria-invalid={Boolean(fieldErrors.email)}
            />
          </div>
          <FieldError message={fieldErrors.email} />

          <label className="label" htmlFor="signup-password">
            Password
          </label>
          <div className="es-auth__input-wrap">
            <KeyRound size={16} className="es-auth__input-icon" aria-hidden />
            <input
              id="signup-password"
              className={`input es-auth__input--icon ${fieldErrors.password ? 'is-invalid' : ''}`}
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                clearFieldError('password')
              }}
              minLength={8}
              required
              autoComplete="new-password"
              placeholder="Min. 8 chars, letter + number"
              aria-invalid={Boolean(fieldErrors.password)}
            />
          </div>
          <FieldError message={fieldErrors.password} />
          {password ? (
            <ul className="es-auth__pw-hints" aria-live="polite">
              {pwHints.map((h) => (
                <li key={h.key} className={h.ok ? 'is-ok' : 'is-bad'}>
                  {h.ok ? '✓' : '○'} {h.label}
                </li>
              ))}
            </ul>
          ) : null}

          {error ? <p className="es-auth__alert es-auth__alert--danger">{error}</p> : null}
          <button type="submit" className="btn btn-primary es-auth__submit">
            Continue <ArrowRight size={15} />
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <label className="label" htmlFor="signup-mobile">
            Mobile / phone
          </label>
          <input
            id="signup-mobile"
            className={`input ${fieldErrors.mobile ? 'is-invalid' : ''}`}
            value={mobile}
            onChange={(e) => {
              setMobile(e.target.value)
              clearFieldError('mobile')
            }}
            placeholder={intentGuest ? '03XXXXXXXXX' : 'Optional · 03XXXXXXXXX'}
            inputMode="tel"
            data-testid="input-signup-mobile"
            aria-invalid={Boolean(fieldErrors.mobile)}
          />
          <FieldError message={fieldErrors.mobile} />

          {!intentGuest ? (
            <>
              <label className="label" htmlFor="signup-department">
                Department
              </label>
              <input
                id="signup-department"
                className="input"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Computer Science"
                data-testid="input-signup-department"
              />
              <label className="label" htmlFor="signup-enrollment">
                Enrollment no.
              </label>
              <input
                id="signup-enrollment"
                className="input"
                value={enrollmentNo}
                onChange={(e) => setEnrollment(e.target.value)}
                placeholder="Optional"
                data-testid="input-signup-enrollment"
              />
              <label className="label">Your interests</label>
              <p className="muted" style={{ fontSize: 11, margin: '4px 0 8px' }}>
                Pick up to 8 — we will recommend matching campus events.
              </p>
              <div className="chips" style={{ flexWrap: 'wrap', gap: 8 }} data-testid="signup-interests">
                {STUDENT_INTERESTS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`chip ${interests.includes(tag) ? 'active' : ''}`}
                    onClick={() => toggleInterest(tag)}
                    data-testid={`chip-interest-${tag.toLowerCase()}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <FieldError message={fieldErrors.interests} />
            </>
          ) : (
            <>
              <label className="label" htmlFor="signup-guest-org">
                Organization / relation (optional)
              </label>
              <input
                id="signup-guest-org"
                className="input"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Parent · Teacher · Visitor"
                data-testid="input-signup-guest-org"
              />
            </>
          )}
          {error ? <p className="es-auth__alert es-auth__alert--danger">{error}</p> : null}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn" onClick={() => { setError(''); setFieldErrors({}); setStep(1) }}>
              <ArrowLeft size={14} /> Back
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={busy}
            >
              {busy ? 'Creating…' : <>{intentGuest ? 'Create guest account' : 'Create account'} <ArrowRight size={15} /></>}
            </button>
          </div>
        </form>
      )}
    </AuthStage>
  )
}
