import EsPageChrome from './EsPageChrome'
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Ticket,
} from 'lucide-react'
import EsReveal from './EsReveal'
import EsEventCard from './EsEventCard'
import { EVENT_STATUS } from '@/constants/domain'
import { getEventPhase, isEventEnded } from '@/lib/eventDate'

export default function OrganizerDashboard({
  events = [],
  saved = [],
  go,
  actions,
  setToast,
  onManage,
}) {
  const cards = [
    ['Total Events', String(events.length), 'live', CalendarDays, 'var(--es-ice)'],
    [
      'Upcoming',
      String(events.filter((e) => e.status === 'Approved').length),
      'approved',
      Clock,
      'var(--es-neon)',
    ],
    [
      'Pending',
      String(events.filter((e) => e.status === 'Pending').length),
      'review',
      Ticket,
      'var(--es-hot)',
    ],
    ['Saved', String(saved.length), 'bookmarks', CheckCircle2, 'var(--es-sun)'],
  ]
  const shown = [...(events || [])]
    .filter((e) => !isEventEnded(e))
    .sort((a, b) => {
      const rank = (e) => {
        const p = getEventPhase(e)
        if (p === 'live') return 0
        if (p === 'starting_soon') return 1
        if (p === 'upcoming') return 2
        return 3
      }
      const d = rank(a) - rank(b)
      if (d !== 0) return d
      return String(a.date || '').localeCompare(String(b.date || ''))
    })
    .slice(0, 4)

  return (
    <div className="es-role-dash" data-testid="organizer-dashboard-v2">
      <EsPageChrome
        eyebrow="01 · Organizer workspace"
        title="Organizer dashboard"
        description="The pulse of your events, registrations, and community — same campus frame as student orbit."
        action={
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => go('/organizer/create-event')}
            data-testid="button-primary-head"
          >
            Create event <ArrowRight size={15} />
          </button>
        }
      />
      <div className="es-role-dash__stats">
        {cards.map(([label, value, note, Icon, color]) => (
          <EsReveal key={label} className="es-role-dash__stat" y={24}>
            <div className="es-role-dash__stat-label">
              <span>{label}</span>
              <Icon size={14} style={{ color }} />
            </div>
            <div className="es-role-dash__stat-value" style={{ color }}>
              {value}
            </div>
            <div className="subtle" style={{ fontSize: 11, marginTop: 6 }}>
              {note}
            </div>
          </EsReveal>
        ))}
      </div>
      <div className="section">
        <div className="section-title">
          <h2>Your events</h2>
          <button className="btn btn-quiet" type="button" onClick={() => go('/organizer/events')} data-testid="button-view-all">
            View all
          </button>
        </div>
        <div className="grid-3 stagger">
          {shown.map((e) => (
            <EsEventCard
              key={e.id}
              event={e}
              saved={saved.includes(e.id)}
              onSave={async (id) => {
                const { saved: nowSaved, error } = await actions.toggleSave(id)
                setToast?.(
                  error
                    ? error.message
                    : nowSaved
                      ? 'Event saved to your orbit'
                      : 'Removed from saved events',
                )
              }}
              onOpen={(id) => go(`/organizer/event/${id}`)}
              role="organizer"
              onEdit={(ev) => onManage?.({ mode: 'edit', event: ev })}
              onDelete={(ev) => onManage?.({ mode: 'delete', event: ev })}
              onPostpone={(ev) => onManage?.({ mode: 'postpone', event: ev })}
              onCancel={(ev) => onManage?.({ mode: 'cancel', event: ev })}
              onDuplicate={async (event) => {
                const { error } = await actions.duplicateEvent(event)
                setToast?.(error ? error.message : 'Event duplicated as a draft')
              }}
              onPublish={async (id) => {
                const { error } = await actions.setStatus(id, EVENT_STATUS.PENDING)
                setToast?.(error ? error.message : 'Event submitted for admin approval')
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
