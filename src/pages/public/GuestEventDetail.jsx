import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'wouter'
import { ArrowLeft, ArrowRight, CalendarDays, MapPin, Ticket } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { homePathForRole, uiRoleFromProfile } from '@/constants/roles'
import { getEvent } from '@/services/events'
import {
  eventRequiresPayment,
  formatRegistrationCloses,
  isPublicGuestEvent,
  isRegistrationClosed,
  pricingLabel,
} from '@/lib/eventMappers'
import { formatEventSchedule } from '@/lib/eventDate'
import {
  campusRegisterHref,
  publicGuestLoginHref,
  publicGuestRegisterHref,
} from '@/lib/authReturn'
import PublicShell from '@/pages/public/PublicShell'

/**
 * Read-only public event detail with campus vs guest CTAs.
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
      if (!isPublicGuestEvent(data)) {
        setError('This event is campus-only and not open to public guests.')
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
  const publicLeft = event?.publicSeatsAvailable != null
    ? event.publicSeatsAvailable
    : Math.max(0, Number(event?.publicCapacity || 0))
  const publicOpen = event ? isPublicGuestEvent(event) : false

  return (
    <PublicShell hideTitle>
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
              {eventRequiresPayment(event) ? pricingLabel(event) : 'Free'} · {publicLeft} public seats
            </span>
            {closes ? <span>{closed ? 'Registration closed' : `Registration closes ${closes}`}</span> : null}
          </div>

          {event.description ? (
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.65, marginTop: 16 }}>
              {event.description}
            </p>
          ) : null}

          {user && ui ? (
            <p className="subtle" style={{ marginTop: 14, fontSize: 12 }}>
              Signed in as {ui === 'guest' ? 'public guest' : `campus ${ui}`}
              {' · '}
              <Link href={homePathForRole(profile?.role)}>Open your hub</Link>
            </p>
          ) : null}

          <div className="es-guest-event__actions" style={{ marginTop: 20 }}>
            {closed ? (
              <button type="button" className="btn" disabled>
                Registration closed
              </button>
            ) : user && ui === 'student' ? (
              <Link href={`/student/event/${event.id}`} className="btn btn-primary">
                Register as student <ArrowRight size={14} />
              </Link>
            ) : user && ui === 'guest' ? (
              publicOpen ? (
                <Link href={`/guest?event=${encodeURIComponent(event.id)}`} className="btn btn-primary">
                  Register as guest <ArrowRight size={14} />
                </Link>
              ) : (
                <button type="button" className="btn" disabled>
                  No public seats — campus only
                </button>
              )
            ) : user && ui ? (
              <Link href={homePathForRole(profile?.role)} className="btn btn-primary">
                Open workspace <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link href={campusRegisterHref(event.id)} className="btn btn-primary" data-testid="button-campus-register">
                  Campus login <ArrowRight size={14} />
                </Link>
                {publicOpen ? (
                  <Link
                    href={publicGuestRegisterHref(event.id)}
                    className="btn"
                    data-testid="button-guest-register"
                  >
                    Public guest <ArrowRight size={14} />
                  </Link>
                ) : null}
              </>
            )}
            {!user ? (
              publicOpen ? (
                <Link href={publicGuestLoginHref(event.id)} className="btn btn-quiet">
                  Guest login
                </Link>
              ) : null
            ) : null}
          </div>
        </article>
      ) : null}
    </PublicShell>
  )
}
