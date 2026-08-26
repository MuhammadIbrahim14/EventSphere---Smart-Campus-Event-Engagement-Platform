import {
  ArrowRight,
  Bookmark,
  CalendarDays,
  Clock,
  Copy,
  MapPin,
  Pencil,
  Ticket,
  Trash2,
  XCircle,
} from 'lucide-react'
import { getEventPhase } from '@/lib/eventDate'
import { eventRequiresPayment, pricingLabel } from '@/lib/eventMappers'
import { bannerForEvent, characterForEvent } from '@/constants/campusCharacters'
import EsReveal from './EsReveal'

function Badge({ status }) {
  const label = status || 'Pending'
  return (
    <span className={`badge badge-${String(label).toLowerCase()}`}>
      {label}
    </span>
  )
}

/**
 * Design-system event card. Same callbacks as legacy EventCard — presentation only.
 */
export default function EsEventCard({
  event,
  saved,
  onSave,
  onOpen,
  role,
  onEdit,
  onDelete,
  onDuplicate,
  onPublish,
  onPostpone,
  onCancel,
  reveal = false,
}) {
  const seats =
    event.seatsAvailable ?? Math.max(0, (event.capacity || 0) - (event.registrations || 0))
  const phase = getEventPhase(event)
  const timeLabel = event.endTime
    ? `${event.time || '—'}–${event.endTime}`
    : event.time || '—'
  const mascot = characterForEvent(event)
  const banner = bannerForEvent(event)

  const artStyle = banner
    ? {
        backgroundImage: `linear-gradient(120deg, rgba(7,6,12,.55), rgba(7,6,12,.2)), url(${banner})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : undefined

  const card = (
    <article className="es-event-card" data-testid={`card-event-${event.id}`}>
      <div
        className={`es-event-card__art${banner ? ' es-event-card__art--banner' : ''}`}
        style={artStyle}
      >
        <span className="badge" style={{ background: 'rgba(7,9,18,.55)', color: '#fff' }}>
          {event.category}
        </span>
        <img
          className="es-event-card__mascot"
          src={mascot.src}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
        {role === 'student' || role === 'organizer' ? (
          <button
            className="icon-btn"
            style={{
              position: 'absolute',
              right: 12,
              top: 12,
              zIndex: 2,
              background: 'rgba(7,9,18,.35)',
              color: saved ? 'var(--es-hot)' : '#fff',
            }}
            onClick={() => onSave?.(event.id)}
            aria-label={saved ? 'Remove bookmark' : 'Bookmark event'}
            data-testid={`button-bookmark-${event.id}`}
            type="button"
          >
            <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />
          </button>
        ) : null}
      </div>
      <div className="es-event-card__info">
        <div className="es-event-card__meta">
          <span className="event-category">{event.organizer}</span>
          <Badge status={event.status} />
          {eventRequiresPayment(event) ? (
            <span className="badge" style={{ background: 'rgba(154,123,255,.18)', color: 'var(--violet)' }}>
              {pricingLabel(event)}
            </span>
          ) : (
            <span className="badge badge-draft">Free</span>
          )}
          {phase === 'live' && (
            <span className="badge" style={{ background: 'rgba(182,239,159,.18)', color: 'var(--lime)' }}>
              Live
            </span>
          )}
          {phase === 'starting_soon' && (
            <span className="badge" style={{ background: 'rgba(84,216,232,.18)', color: 'var(--cyan)' }}>
              Soon
            </span>
          )}
          {phase === 'ended' && (
            <span className="badge" style={{ background: 'rgba(135,144,179,.2)', color: 'var(--muted)' }}>
              Ended
            </span>
          )}
        </div>
        <h3>{event.title}</h3>
        <div className="es-event-card__line">
          <CalendarDays size={13} />
          {event.date} · {timeLabel}
        </div>
        <div className="es-event-card__line">
          <MapPin size={13} />
          {event.venue}
        </div>
        <div className="es-event-card__line">
          <Ticket size={13} />
          {phase === 'ended'
            ? 'Registration closed'
            : `${event.capacity || 0} Total Seats | ${event.registrations || 0} Registered | ${seats} Seats Remaining`}
        </div>
        <div className="es-event-card__actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => onOpen?.(event.id)}
            data-testid={`button-view-${event.id}`}
          >
            {phase === 'ended' ? (
              'View ended event'
            ) : (
              <>
                View event <ArrowRight size={13} />
              </>
            )}
          </button>
          {role === 'organizer' && (
            <>
              <button className="btn" type="button" onClick={() => onEdit?.(event)} aria-label="Edit event" data-testid={`button-edit-${event.id}`}>
                <Pencil size={13} />
              </button>
              <button className="btn" type="button" onClick={() => onPostpone?.(event)} aria-label="Postpone event" data-testid={`button-postpone-${event.id}`} disabled={phase === 'ended'}>
                <Clock size={13} />
              </button>
              <button className="btn" type="button" onClick={() => onCancel?.(event)} aria-label="Cancel event" data-testid={`button-cancel-event-${event.id}`} disabled={phase === 'ended'}>
                <XCircle size={13} />
              </button>
              <button className="btn btn-danger" type="button" onClick={() => onDelete?.(event)} aria-label="Delete event" data-testid={`button-delete-${event.id}`}>
                <Trash2 size={13} />
              </button>
            </>
          )}
          {role === 'organizer' && event.status === 'Draft' && (
            <button className="btn" type="button" onClick={() => onPublish?.(event.id)} data-testid={`button-publish-${event.id}`}>
              Publish
            </button>
          )}
          {role === 'organizer' && event.status === 'Rejected' && (
            <button className="btn" type="button" onClick={() => onPublish?.(event.id)} data-testid={`button-resubmit-${event.id}`}>
              Resubmit
            </button>
          )}
          {role === 'organizer' && (
            <button className="btn" type="button" onClick={() => onDuplicate?.(event)} aria-label="Duplicate event" data-testid={`button-duplicate-${event.id}`}>
              <Copy size={13} />
            </button>
          )}
        </div>
      </div>
    </article>
  )

  if (!reveal) return card
  return (
    <EsReveal y={28} scale={0.98}>
      {card}
    </EsReveal>
  )
}
