import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { ArrowRight, CalendarDays, MapPin } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { homePathForRole, uiRoleFromProfile } from '@/constants/roles'
import { listPublicGuestEvents } from '@/services/events'
import {
  eventRequiresPayment,
  formatRegistrationCloses,
  isPublicGuestEvent,
  isRegistrationClosed,
  pricingLabel,
} from '@/lib/eventMappers'
import { formatEventSchedule, isEventEnded } from '@/lib/eventDate'
import { publicGuestRegisterHref } from '@/lib/authReturn'
import { characterForEvent } from '@/constants/campusCharacters'
import EsSplash from '@/components/public/EsSplash'
import FeaturedEventsStrip from '@/components/shared/FeaturedEventsStrip'
import PublicShell from '@/pages/public/PublicShell'
import {
  PublicMascotHero,
  PublicMascotBadge,
  PublicMascotEmpty,
  resolvePublicMascot,
} from '@/components/public/PublicMascotScene'
import { TABLES } from '@/constants/domain'
import { useRealtimeTables } from '@/hooks/useRealtimeTables'
import { useMascotLibrary } from '@/context/MascotLibraryContext'
import { isEventFeatured } from '@/lib/featuredEvents'
import '@/styles/eventsphere-discover-featured.css'

function seatsLine(event) {
  const publicLeft =
    event.publicSeatsAvailable != null
      ? event.publicSeatsAvailable
      : Math.max(0, Number(event.publicCapacity || 0))
  return `${publicLeft} public seats available`
}

function PublicEventCard({ event }) {
  const closed = isRegistrationClosed(event)
  const closes = formatRegistrationCloses(event)
  const mascot = characterForEvent(event)
  const featured = isEventFeatured(event)
  return (
    <article className={`es-guest-event surface${featured ? ' es-guest-event--featured' : ''}`} data-testid={`guest-event-${event.id}`}>
      {featured ? <span className="es-guest-event__featured">Featured</span> : null}
      <img className="es-guest-event__mascot" src={mascot.src} alt="" aria-hidden="true" />
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
          {seatsLine(event)}
        </span>
        {closes ? <span>{closed ? 'Reg closed' : `Closes ${closes}`}</span> : null}
        <span>Open to public guests</span>
      </div>
      <div className="es-guest-event__actions">
        <Link href={`/events/${event.id}`} className="btn" data-testid={`link-guest-view-${event.id}`}>
          View event
        </Link>
        {!closed ? (
          <Link
            href={publicGuestRegisterHref(event.id)}
            className="btn btn-primary"
            data-testid={`link-guest-register-${event.id}`}
          >
            Guest register <ArrowRight size={14} />
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

export function FeaturedPublicEvents() {
  const [events, setEvents] = useState([])

  const load = useCallback(async () => {
    const { data } = await listPublicGuestEvents()
    setEvents((data || []).filter((e) => !isEventEnded(e)))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeTables([TABLES.EVENTS], () => load(), { channelName: 'es-guest-featured' })

  return <FeaturedEventsStrip events={events} variant="public" limit={2} testId="public-featured-events" />
}

export function GuestEventsGrid({ limit } = {}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { enabledLibrary } = useMascotLibrary()

  const load = useCallback(async (opts = {}) => {
    const silent = Boolean(opts.silent)
    if (!silent) setLoading(true)
    const { data, error: err } = await listPublicGuestEvents()
    if (!silent) setLoading(false)
    if (err) {
      if (!silent) setError(err.message)
      setRows([])
      return
    }
    setError('')
    const list = (data || []).filter((e) => !isEventEnded(e))
    setRows(typeof limit === 'number' ? list.slice(0, limit) : list)
  }, [limit])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeTables([TABLES.EVENTS, TABLES.REGISTRATIONS], () => load({ silent: true }), {
    channelName: 'es-guest-events',
  })

  if (loading) return <p className="muted">Loading campus events…</p>
  if (error) return <p className="muted">{error}</p>
  if (!rows.length) {
    return (
      <PublicMascotEmpty
        library={enabledLibrary}
        message="No public events open to guests right now. Organizers can enable Allow public guests when creating events."
      />
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
 * Public landing: splash + dual campus/guest paths + approved events.
 */
export default function GuestHome() {
  const [, setLocation] = useLocation()
  const { user, profile, loading: authLoading } = useAuth()
  const ui = uiRoleFromProfile(profile?.role)
  const [splashDone, setSplashDone] = useState(false)
  const onSplashDone = useCallback(() => setSplashDone(true), [])
  const { enabledLibrary } = useMascotLibrary()
  const campusMascot = resolvePublicMascot('hero', enabledLibrary)
  const guestMascot = resolvePublicMascot('robot', enabledLibrary)

  useEffect(() => {
    if (authLoading) return
    if (!user || !ui) return
    const t = window.setTimeout(() => setLocation(homePathForRole(profile?.role)), 600)
    return () => window.clearTimeout(t)
  }, [authLoading, user, ui, profile?.role, setLocation])

  if (user && (ui || authLoading)) {
    const isGuest = ui === 'guest'
    return (
      <div className="landing es-public" style={{ padding: 24, maxWidth: 480, margin: '10vh auto' }}>
        <div className="eyebrow">{isGuest ? 'Public guest' : 'Campus account'}</div>
        <h2 style={{ margin: '8px 0 10px', fontSize: 22 }}>
          {isGuest ? 'Continue to your guest pass hub' : "You're signed in with a campus account"}
        </h2>
        <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
          {isGuest
            ? 'Registrations, QR pass, and referral live on your secure guest page.'
            : 'Opening your EventSphere workspace (student / organizer / admin).'}
        </p>
        <Link href={homePathForRole(profile?.role)} className="btn btn-primary">
          {isGuest ? 'Open guest hub' : 'Go to dashboard'} <ArrowRight size={14} />
        </Link>
      </div>
    )
  }

  return (
    <>
      <EsSplash onDone={onSplashDone} />
      <PublicShell hideTitle>
        <section className="es-guest-hero surface" data-testid="guest-hero">
          <div className="es-guest-hero__copy">
            <div className="eyebrow">Smart campus events</div>
            <h1>
              Welcome to <span className="gradient-text">EventSphere</span>
            </h1>
            <p>
              Campus members sign in with their EventSphere email. Teachers, family, and visitors continue as
              public guests — one secure hub for passes, no student dashboard.
            </p>
            <div className="es-guest-hero__cta">
              <Link href="/events" className="btn btn-primary" data-testid="button-guest-browse-events">
                Browse events <ArrowRight size={15} />
              </Link>
            </div>
          </div>
          <PublicMascotHero library={enabledLibrary} />
        </section>

        <div className="es-guest-paths" style={{ opacity: splashDone ? 1 : 0.9 }}>
          <article className="es-guest-path surface" data-testid="path-campus">
            <div className="es-guest-path__copy">
              <div className="eyebrow">Campus member</div>
              <h3>Student · Organizer · Admin</h3>
              <p className="muted" style={{ fontSize: 12, margin: '0 0 12px' }}>
                Campus students use enrollment login (issued by admin). Organizers and admins use email — full workspace, certificates, and campus seats.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link href="/login" className="btn btn-primary">
                  Campus login
                </Link>
              </div>
            </div>
            <PublicMascotBadge mascot={campusMascot} size="md" />
          </article>
          <article className="es-guest-path surface" data-testid="path-public-guest">
            <div className="es-guest-path__copy">
              <div className="eyebrow">Public guest</div>
              <h3>Teachers · Family · Visitors</h3>
              <p className="muted" style={{ fontSize: 12, margin: '0 0 12px' }}>
                OTP-verified guest account. Register for events with public seats, get your pass — nothing else.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link href="/signup?intent=guest" className="btn btn-primary" data-testid="button-continue-as-guest">
                  Continue as guest
                </Link>
                <Link href="/login" className="btn">
                  Guest login
                </Link>
              </div>
            </div>
            <PublicMascotBadge mascot={guestMascot} size="md" />
          </article>
        </div>

        <FeaturedPublicEvents />

        <section aria-labelledby="guest-events-heading" style={{ opacity: splashDone ? 1 : 0.88 }}>
          <div className="page-head" style={{ marginBottom: 16 }}>
            <div>
              <div className="eyebrow">Open to visitors</div>
              <h2 id="guest-events-heading" style={{ margin: 0, fontSize: 22 }}>
                Public guest events
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
    <PublicShell title="Public events" eyebrow="Guest mode">
      <p className="muted" style={{ fontSize: 13, marginTop: -8, marginBottom: 18 }}>
        Events open to teachers, family, and visitors. Campus-only gatherings are not listed here.
      </p>
      <FeaturedPublicEvents />
      <GuestEventsGrid />
    </PublicShell>
  )
}
