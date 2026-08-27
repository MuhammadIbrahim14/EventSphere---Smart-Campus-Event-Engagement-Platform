import { ArrowRight, CalendarDays, MapPin, Sparkles } from 'lucide-react'
import { Link } from 'wouter'
import { bannerForEvent, characterForEvent } from '@/constants/campusCharacters'
import { featuredEvents, isEventFeatured } from '@/lib/featuredEvents'
import { formatEventSchedule } from '@/lib/eventDate'
import { eventRequiresPayment, isPublicGuestEvent, pricingLabel } from '@/lib/eventMappers'

/**
 * Hero strip for organizer-featured events (campus + public).
 */
export default function FeaturedEventsStrip({
  events = [],
  variant = 'campus',
  go,
  limit = 3,
  testId = 'featured-events-strip',
}) {
  const rows = featuredEvents(events).slice(0, limit)
  if (!rows.length) return null

  const isPublic = variant === 'public'

  return (
    <section className="es-featured-strip" data-testid={testId}>
      <div className="es-featured-strip__head">
        <div>
          <div className="eyebrow">
            <Sparkles size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Featured {isPublic ? 'public events' : 'on campus'}
          </div>
          <h2 className="es-featured-strip__title">Organizer spotlight</h2>
        </div>
        {!isPublic && go ? (
          <button type="button" className="btn btn-quiet" onClick={() => go('/student/discover?featured=1')}>
            View all featured
          </button>
        ) : null}
      </div>

      <div className="es-featured-strip__grid">
        {rows.map((event) => {
          const mascot = characterForEvent(event)
          const banner = bannerForEvent(event)
          const href = isPublic ? `/events/${event.id}` : go ? null : `/events/${event.id}`
          const publicOpen = isPublicGuestEvent(event)

          const inner = (
            <>
              <div
                className="es-featured-strip__art"
                style={
                  banner
                    ? {
                        backgroundImage: `linear-gradient(125deg, rgba(7,6,12,.78), rgba(7,6,12,.35)), url(${banner})`,
                      }
                    : undefined
                }
              >
                <span className="es-featured-strip__badge">Featured</span>
                {publicOpen ? <span className="es-featured-strip__guest">Public guests welcome</span> : null}
                <img className="es-featured-strip__mascot" src={mascot.src} alt="" aria-hidden />
              </div>
              <div className="es-featured-strip__body">
                <div className="eyebrow">{event.category || 'Campus'}</div>
                <h3>{event.title}</h3>
                <p className="es-featured-strip__meta">
                  <CalendarDays size={13} aria-hidden />
                  {isPublic ? formatEventSchedule(event) : `${event.date || 'TBA'} · ${event.time || ''}`}
                </p>
                <p className="es-featured-strip__meta">
                  <MapPin size={13} aria-hidden />
                  {event.venue || 'Campus'}
                </p>
                <p className="es-featured-strip__price">
                  {eventRequiresPayment(event) ? pricingLabel(event) : 'Free registration'}
                </p>
                <span className="btn btn-primary es-featured-strip__cta">
                  View event <ArrowRight size={14} />
                </span>
              </div>
            </>
          )

          if (href) {
            return (
              <Link key={event.id} href={href} className="es-featured-strip__card surface">
                {inner}
              </Link>
            )
          }

          return (
            <button
              key={event.id}
              type="button"
              className="es-featured-strip__card surface"
              onClick={() => go?.(`/student/event/${event.id}`)}
            >
              {inner}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export { isEventFeatured, featuredEvents }
