import { useEffect, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { isEmailJsConfigured } from '../../lib/emailjs'
import { STUDENT_INTERESTS } from '@/constants/domain'
import { readNextFromSearch, stashAuthNext } from '@/lib/authReturn'

export default function SignupForm() {
  const { signUp } = useAuth()
  const [, setLocation] = useLocation()
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

  const toggleInterest = (tag) => {
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
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
    <div className="login-page">
      <div className="login-shell" style={{ gridTemplateColumns: '1fr', maxWidth: 480 }}>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="eyebrow">Join the sphere</div>
          <h2>Create account</h2>
          <p>New accounts start as student (<code>user</code>). Organizer is assigned by admin only.</p>
          {!isEmailJsConfigured && (
            <p className="muted" style={{ color: 'var(--danger)', marginBottom: 12 }}>
              Add EmailJS keys to <code>.env</code> before signup.
            </p>
          )}
          <label className="label">Full name</label>
          <input
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <label className="label" style={{ marginTop: 15 }}>
            Campus email
          </label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label className="label" style={{ marginTop: 15 }}>
            Mobile
          </label>
          <input
            className="input"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="Optional"
            data-testid="input-signup-mobile"
          />
          <label className="label" style={{ marginTop: 15 }}>
            Department
          </label>
          <input
            className="input"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="e.g. Computer Science"
            data-testid="input-signup-department"
          />
          <label className="label" style={{ marginTop: 15 }}>
            Enrollment no.
          </label>
          <input
            className="input"
            value={enrollmentNo}
            onChange={(e) => setEnrollmentNo(e.target.value)}
            placeholder="Optional"
            data-testid="input-signup-enrollment"
          />
          <label className="label" style={{ marginTop: 15 }}>
            Your interests
          </label>
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
          <label className="label" style={{ marginTop: 15 }}>
            Password
          </label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          {error && (
            <p className="muted" style={{ color: 'var(--danger)', marginTop: 12 }}>
              {error}
            </p>
          )}
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 19 }} disabled={busy}>
            {busy ? 'Creating…' : <>Create account <ArrowRight size={15} /></>}
          </button>
          <p className="muted" style={{ marginTop: 14, fontSize: 12 }}>
            Already have an account?{' '}
            <Link
              href={(() => {
                const next = readNextFromSearch(
                  typeof window !== 'undefined' ? window.location.search : '',
                )
                return next ? `/login?next=${encodeURIComponent(next)}` : '/login'
              })()}
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
