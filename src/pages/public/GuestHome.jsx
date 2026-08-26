import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { ArrowRight, CalendarDays, MapPin } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { uiRoleFromProfile } from '@/constants/roles'
import { listApprovedEvents } from '@/services/events'
import {
  eventRequiresPayment,
  formatRegistrationCloses,
  isRegistrationClosed,
  pricingLabel,
} from '@/lib/eventMappers'
import { formatEventSchedule } from '@/lib/eventDate'
import { guestRegisterHref } from '@/lib/authReturn'
import EsSplash from '@/components/public/EsSplash'
import PublicShell from '@/pages/public/PublicShell'

function PublicEventCard({ event }) {
  const closed = isRegistrationClosed(event)
  const closes = formatRegistrationCloses(event)
  return (
    <article className="es-guest-event" data-testid={`guest-event-${event.id}`}>
      <div className="eyebrow">{event.category}</div>
      <h3>{event.title}</h3>
      <div className="es-guest-event__meta">
        <span>
          <CalendarDays size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          {formatEventSchedule(event)}
        </span>
        <span>
          <MapPin size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          {event.venue || 'Campus'}
        </span>
        <span>
          {eventRequiresPayment(event) ? pricingLabel(event) : 'Free'}
          {' · '}
          {Math.max(0, (event.capacity || 0) - (event.registrations || 0))} seats left
        </span>
        {closes ? <span>{closed ? 'Reg closed' : `Closes ${closes}`}</span> : null}
      </div>
      <div className="es-guest-event__actions">
        <Link href={`/events/${event.id}`} className="btn" data-testid={`link-guest-view-${event.id}`}>
          View event
        </Link>
        {!closed ? (
          <Link
            href={guestRegisterHref(event.id)}
            className="btn btn-primary"
            data-testid={`link-guest-register-${event.id}`}
          >
            Register <ArrowRight size={14} />
          </Link>
        ) : (
          <button type="button" className="btn" disabled>
            Registration closed
          </button>
        )}
      </div>
    </article>
  )
}

export function GuestEventsGrid({ limit } = {}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await listApprovedEvents()
    setLoading(false)
    if (err) {
      setError(err.message)
      setRows([])
      return
    }
    const list = data || []
    setRows(typeof limit === 'number' ? list.slice(0, limit) : list)
  }, [limit])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <p className="muted">Loading campus events…</p>
  if (error) return <p className="muted">{error}</p>
  if (!rows.length) {
    return (
      <div className="surface" style={{ padding: 24 }}>
        <p className="muted" style={{ margin: 0 }}>
          No approved public events yet. Check back soon — or create an account to stay in the orbit.
        </p>
      </div>
    )
  }

  return (
    <div className="es-guest-events">
      {rows.map((e) => (
        <PublicEventCard key={e.id} event={e} />
      ))}
    </div>
  )
}

/**
 * Guest home: splash (once per tab) + hero + public approved events.
 * Brand logo lives only in PublicShell header (not repeated in hero).
 */
export default function GuestHome() {
  const [, setLocation] = useLocation()
  const { user, profile, loading: authLoading } = useAuth()
  const ui = uiRoleFromProfile(profile?.role)
  const [splashDone, setSplashDone] = useState(false)
  const onSplashDone = useCallback(() => setSplashDone(true), [])

  useEffect(() => {
    if (authLoading) return
    if (user && ui) setLocation(`/${ui}/dashboard`)
  }, [authLoading, user, ui, setLocation])

  // Logged-in users skip splash / guest chrome while redirecting
  if (user && (ui || authLoading)) {
    return (
      <div className="landing es-public">
        <p className="muted">Opening your orbit…</p>
      </div>
    )
  }

  return (
    <>
      <EsSplash onDone={onSplashDone} />
      <PublicShell hideTitle wide>
        <section className="es-guest-hero" data-testid="guest-hero">
          <div className="eyebrow">The campus, in motion</div>
          <h1>
            Welcome to <span className="gradient-text">EventSphere</span>
          </h1>
          <p>
            Browse what is happening on campus. Create an account to register, get your pass, and join the orbit.
          </p>
          <div className="es-guest-hero__cta">
            <Link href="/events" className="btn btn-primary" data-testid="button-guest-browse-events">
              Browse events <ArrowRight size={15} />
            </Link>
            <Link href="/signup" className="btn" data-testid="button-guest-create-account">
              Create account
            </Link>
            <Link href="/login" className="btn btn-quiet">
              Login
            </Link>
          </div>
        </section>

        <section
          aria-labelledby="guest-events-heading"
          style={{ opacity: splashDone ? 1 : 0.88 }}
        >
          <div className="page-head" style={{ marginBottom: 16 }}>
            <div>
              <div className="eyebrow">Open to campus</div>
              <h2 id="guest-events-heading" style={{ margin: 0, fontSize: 22 }}>
                Public events
              </h2>
            </div>
            <Link href="/events" className="btn btn-quiet">
              View all
            </Link>
          </div>
          <GuestEventsGrid limit={6} />
        </section>
      </PublicShell>
    </>
  )
}

export function GuestEventsPage() {
  return (
    <PublicShell title="Campus events" eyebrow="Guest mode">
      <p className="muted" style={{ fontSize: 13, marginTop: -8, marginBottom: 18 }}>
        Approved events only. Registering requires an EventSphere account (email OTP) so seats stay real.
      </p>
      <GuestEventsGrid />
    </PublicShell>
  )
}
