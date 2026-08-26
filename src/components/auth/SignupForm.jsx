import { useEffect, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { isEmailJsConfigured } from '../../lib/emailjs'
import { STUDENT_INTERESTS } from '@/constants/domain'
import { readNextFromSearch, stashAuthNext } from '@/lib/authReturn'
import AuthStage from '@/components/auth/AuthStage'

export default function SignupForm() {
  const { signUp } = useAuth()
  const [, setLocation] = useLocation()
  const [step, setStep] = useState(1)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mobile, setMobile] = useState('')
  const [department, setDepartment] = useState('')
  const [enrollmentNo, setEnrollmentNo] = useState('')
  const [interests, setInterests] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const next = readNextFromSearch(typeof window !== 'undefined' ? window.location.search : '')
    if (next) stashAuthNext(next)
  }, [])

  const loginHref = (() => {
    const next = readNextFromSearch(typeof window !== 'undefined' ? window.location.search : '')
    return next ? `/login?next=${encodeURIComponent(next)}` : '/login'
  })()

  const toggleInterest = (tag) => {
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  function goNextStep(e) {
    e.preventDefault()
    setError('')
    if (!fullName.trim() || !email.trim() || password.length < 6) {
      setError('Name, email, and a password (6+ chars) are required.')
      return
    }
    setStep(2)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { data, error: err } = await signUp({
      email,
      password,
      fullName,
      mobile,
      department,
      enrollmentNo,
      interests,
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
      eyebrow="Issue a new pass"
      title="Claim your campus seat"
      subtitle="Students start here. Organizer access is granted by admin after you’re in the sphere."
      footer={
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          Already have an account? <Link href={loginHref}>Sign in</Link>
          {' · '}
          <Link href="/">Guest home</Link>
        </p>
      }
    >
      <div className="es-auth__steps" aria-hidden>
        <span className={`es-auth__step ${step >= 1 ? 'is-on' : ''}`} />
        <span className={`es-auth__step ${step >= 2 ? 'is-on' : ''}`} />
      </div>

      {!isEmailJsConfigured && (
        <p className="muted" style={{ color: 'var(--danger)', marginBottom: 12 }}>
          Add EmailJS keys to <code>.env</code> before signup.
        </p>
      )}

      {step === 1 ? (
        <form onSubmit={goNextStep}>
          <label className="label">Full name</label>
          <input
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
          />
          <label className="label">Campus email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            autoComplete="new-password"
          />
          {error ? (
            <p className="muted" style={{ color: 'var(--danger)', marginTop: 12 }}>
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 18 }}>
            Continue <ArrowRight size={15} />
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit}>
          <label className="label">Mobile</label>
          <input
            className="input"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="Optional"
            data-testid="input-signup-mobile"
          />
          <label className="label">Department</label>
          <input
            className="input"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="e.g. Computer Science"
            data-testid="input-signup-department"
          />
          <label className="label">Enrollment no.</label>
          <input
            className="input"
            value={enrollmentNo}
            onChange={(e) => setEnrollmentNo(e.target.value)}
            placeholder="Optional"
            data-testid="input-signup-enrollment"
          />
          <label className="label">Your interests</label>
          <p className="muted" style={{ fontSize: 11, margin: '4px 0 8px' }}>
            Pick a few — we will recommend matching campus events.
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
          {error ? (
            <p className="muted" style={{ color: 'var(--danger)', marginTop: 12 }}>
              {error}
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button type="button" className="btn" onClick={() => { setError(''); setStep(1) }}>
              <ArrowLeft size={14} /> Back
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={busy}
            >
              {busy ? 'Creating…' : <>Create account <ArrowRight size={15} /></>}
            </button>
          </div>
        </form>
      )}
    </AuthStage>
  )
}
