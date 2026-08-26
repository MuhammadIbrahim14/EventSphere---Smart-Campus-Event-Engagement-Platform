import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'wouter'
import { ArrowLeft, ArrowRight, CalendarDays, MapPin, Ticket } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { uiRoleFromProfile } from '@/constants/roles'
import { getEvent } from '@/services/events'
import {
  eventRequiresPayment,
  formatRegistrationCloses,
  isRegistrationClosed,
  pricingLabel,
} from '@/lib/eventMappers'
import { formatEventSchedule } from '@/lib/eventDate'
import { guestLoginHref, guestRegisterHref } from '@/lib/authReturn'
import PublicShell from '@/pages/public/PublicShell'

/**
 * Read-only public event detail. Register soft-gates to signup/login with next=.
 */
export default function GuestEventDetail() {
  const params = useParams()
  const id = params?.id
  const [, setLocation] = useLocation()
  const { user, profile } = useAuth()
  const ui = uiRoleFromProfile(profile?.role)
  const [event, setEvent] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!id) {
        setLoading(false)
        setError('Event not found')
        return
      }
      setLoading(true)
      const { data, error: err } = await getEvent(id)
      if (cancelled) return
      setLoading(false)
      if (err || !data) {
        setError(err?.message || 'Event not found')
        setEvent(null)
        return
      }
      if (data.dbStatus !== 'approved' && data.status !== 'Approved') {
        setError('This event is not available for public viewing.')
        setEvent(null)
        return
      }
      setEvent(data)
      setError('')
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const closed = event ? isRegistrationClosed(event) : false
  const closes = event ? formatRegistrationCloses(event) : ''
  const seatsLeft = event
    ? Math.max(0, (event.capacity || 0) - (event.registrations || 0))
    : 0

  const registerHref = (() => {
    if (!event) return '/signup'
    if (user && ui === 'student') return `/student/event/${event.id}`
    if (user && ui) return `/${ui}/dashboard`
    return guestRegisterHref(event.id)
  })()

  return (
    <PublicShell hideTitle wide>
      <button
        type="button"
        className="btn btn-quiet"
        style={{ marginBottom: 16 }}
        onClick={() => setLocation('/events')}
        data-testid="button-guest-back-events"
      >
        <ArrowLeft size={14} /> All events
      </button>

      {loading ? <p className="muted">Loading event…</p> : null}
      {error ? (
        <div className="surface" style={{ padding: 24 }}>
          <p className="muted" style={{ margin: 0 }}>
            {error}
          </p>
          <Link href="/events" className="btn" style={{ marginTop: 14 }}>
            Browse events
          </Link>
        </div>
      ) : null}

      {event && !loading ? (
        <article className="es-guest-event" style={{ maxWidth: 720 }} data-testid="guest-event-detail">
          <div className="eyebrow">{event.category}</div>
          <h1 style={{ margin: 0, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)' }}>{event.title}</h1>
          <div className="es-guest-event__meta" style={{ marginTop: 8 }}>
            <span>
              <CalendarDays size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {formatEventSchedule(event)}
            </span>
            <span>
              <MapPin size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {event.venue || 'Campus'}
            </span>
            <span>
              <Ticket size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {eventRequiresPayment(event) ? pricingLabel(event) : 'Free'} · {seatsLeft} seats left
              {event.capacity ? ` of ${event.capacity}` : ''}
            </span>
            {closes ? <span>{closed ? 'Registration closed' : `Registration closes ${closes}`}</span> : null}
          </div>

          {event.description ? (
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.65, marginTop: 16 }}>
              {event.description}
            </p>
          ) : null}

          <div className="es-guest-event__actions" style={{ marginTop: 20 }}>
            {closed ? (
              <button type="button" className="btn" disabled>
                Registration closed
              </button>
            ) : (
              <Link href={registerHref} className="btn btn-primary" data-testid="button-guest-register">
                {user && ui === 'student' ? (
                  <>
                    Register <ArrowRight size={14} />
                  </>
                ) : user ? (
                  <>
                    Open workspace <ArrowRight size={14} />
                  </>
                ) : (
                  <>
                    Register — create account <ArrowRight size={14} />
                  </>
                )}
              </Link>
            )}
            {!user ? (
              <Link href={guestLoginHref(event.id)} className="btn" data-testid="link-guest-login-event">
                Already have an account? Login
              </Link>
            ) : null}
          </div>
          {!user ? (
            <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
              Registration needs an EventSphere account (email OTP) so your seat counts for the organizer.
            </p>
          ) : null}
        </article>
      ) : null}
    </PublicShell>
  )
}
